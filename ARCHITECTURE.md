# Arquitetura — ecs-terraform-infra

## Objetivo do projeto

Este projeto existe para demonstrar proficiência em infraestrutura AWS via Terraform. A aplicação em si é intencionalmente trivial: um servidor Express com um único endpoint, `GET /api/health`, que retorna `200 OK` quando tudo está saudável. Toda a complexidade e o esforço de engenharia devem estar na infraestrutura — rede, segurança, observabilidade, CI/CD e organização do Terraform — não no código da aplicação.

Pense na API como um "canário": ela só precisa existir e responder, para provar que o pipeline completo (build → deploy → rede → load balancer → auto scaling → banco) funciona de ponta a ponta.

## Visão geral da arquitetura

```
Internet
   │
   ▼
Route53 (hosted zone do domínio)
   │
   ▼
ACM Certificate (validação DNS) ── anexado ao listener HTTPS do ALB
   │
   ▼
Application Load Balancer (subnets públicas, multi-AZ)
   │  listener :443 (HTTPS) → target group
   │  listener :80 (HTTP)   → redirect 301 para :443
   ▼
ECS Fargate Service (subnets privadas, multi-AZ)
   │  tasks rodando o container Express
   │  health check do target group em /api/health
   ▼
Aurora Serverless v2 (subnets privadas, multi-AZ)
   │  credenciais via Secrets Manager
   ▼
CloudWatch Logs / Alarms (observabilidade transversal a tudo acima)
```

Tudo dentro de uma VPC dedicada, com subnets públicas (ALB, NAT Gateway) e privadas (ECS, RDS) distribuídas em pelo menos 2 AZs.

## 1. Rede (VPC)

- VPC dedicada ao projeto, CIDR próprio (ex.: `10.0.0.0/16`).
- Subnets públicas e privadas em 2–3 Availability Zones.
- Subnets públicas: hospedam apenas o ALB.
- Subnets privadas: hospedam as tasks ECS e as instâncias/writer do Aurora — **sem rota para internet**.
- Internet Gateway anexado à VPC para as subnets públicas.
- **Sem NAT Gateway**: a API não faz chamadas de saída para serviços externos (só responde `/api/health`), então não há necessidade de dar saída geral de internet às subnets privadas. Em vez de NAT, o acesso a serviços AWS a partir das tasks ECS é feito via **VPC Endpoints (PrivateLink)** — ver seção 1.1. Isso reduz superfície de ataque (subnets privadas 100% isoladas de internet) e evita o custo/complexidade do NAT Gateway. Se no futuro a API precisar chamar uma API de terceiros, essa decisão deve ser revisitada e um NAT Gateway (ou solução equivalente) introduzido.
- Route tables separadas para público (rota para IGW) e privado (sem rota de saída para internet — só rotas locais da VPC).
- Security Groups granulares, sem regras `0.0.0.0/0` além do necessário:
  - **SG do ALB**: entrada 443 (e 80 só para redirect) de `0.0.0.0/0`; saída para o SG do ECS na porta da aplicação.
  - **SG do ECS**: entrada apenas do SG do ALB, na porta da aplicação; saída para o SG do RDS e para internet (via NAT) para pulls/chamadas externas.
  - **SG do RDS**: entrada apenas do SG do ECS, na porta do Postgres/MySQL; sem saída necessária além do padrão.

### 1.1. VPC Endpoints (substituindo o NAT Gateway)

Como as subnets privadas não têm rota para internet, as tasks ECS precisam alcançar serviços AWS por dentro da própria rede da AWS, via PrivateLink. Endpoints necessários:

- `com.amazonaws.<region>.ecr.api` (**Interface Endpoint**) — chamadas de API do ECR (autenticação, metadados).
- `com.amazonaws.<region>.ecr.dkr` (**Interface Endpoint**) — protocolo do Docker registry usado no `pull` da imagem.
- `com.amazonaws.<region>.s3` (**Gateway Endpoint**, gratuito) — as camadas (layers) da imagem Docker são, na prática, blobs armazenados no S3; o ECR sozinho não entrega isso sem o S3.
- `com.amazonaws.<region>.logs` (**Interface Endpoint**) — para a task ECS enviar logs ao CloudWatch Logs sem sair pra internet.
- `com.amazonaws.<region>.secretsmanager` (**Interface Endpoint**) — para a task buscar as credenciais do Aurora em runtime.

Notas de implementação:
- Interface Endpoints criam uma ENI por AZ dentro das subnets privadas e têm custo por hora + por GB processado (comparável ao NAT, mas só se paga pelos serviços realmente usados).
- Gateway Endpoints (só existem para S3 e DynamoDB) não têm custo de hora nem de processamento — são associados diretamente às route tables das subnets privadas.
- Security Group dos Interface Endpoints deve permitir entrada na porta 443 a partir do SG do ECS.
- O RDS Aurora **não precisa de nenhum endpoint ou rota de saída**: patches, backups e manutenção são geridos pelo *management plane* da AWS, fora da VPC do cliente.

## 2. Compute — ECS Fargate

- Cluster ECS (Fargate, sem gerenciar EC2).
- Task Definition com:
  - Container da API Express.
  - `logConfiguration` apontando para CloudWatch Logs (driver `awslogs`).
  - Task Role (permissões que o *código da aplicação* usa, ex.: acessar Secrets Manager) separada da Execution Role (permissões que o *ECS agent* usa, ex.: pull de imagem do ECR, escrever logs).
- ECS Service:
  - Rodando nas subnets privadas.
  - Registrado no Target Group do ALB.
  - Desired count ≥ 2 para HA real entre AZs.
- Application Load Balancer:
  - Subnets públicas, multi-AZ.
  - Target Group com health check apontando para `/api/health` (ajustar threshold/interval para failover rápido, mas sem flapping).
  - Listener HTTPS (443) com certificado ACM; listener HTTP (80) redirecionando para HTTPS.
- Auto Scaling do ECS Service baseado em métrica de CPU/memória (Target Tracking) ou em request count por target do ALB — escolher uma e justificar.

## 3. Dados — Aurora Serverless v2

- Aurora Serverless v2 (engine Postgres ou MySQL — decidir e manter consistência com o driver usado na API).
- DB Subnet Group usando apenas as subnets privadas.
- Capacity range (ACU mínimo/máximo) configurado para permitir "escalar a quase zero" fora de uso, mostrando conhecimento do modelo serverless.
- Multi-AZ para o writer/instância, dentro do que o Serverless v2 oferece.
- Credenciais de banco **nunca** em `tfvars` versionado — usar Secrets Manager (idealmente com `manage_master_user_password` integrado do próprio RDS, ou secret gerenciado manualmente com rotação).
- Backups automáticos habilitados, com retenção definida explicitamente (não confiar no default).
- Deletion protection habilitada (ajuda a "provar" preocupação com produção, mesmo em projeto de portfólio).

## 4. Segurança (transversal)

- IAM: least privilege em todas as roles — nunca `*:*` ou políticas gerenciadas amplas demais sem necessidade.
- Segredos: só via Secrets Manager, injetados na Task Definition como `secrets` (não `environment`).
- Nenhum recurso privado (ECS, RDS) com IP público ou security group aberto para `0.0.0.0/0`.
- Opcional (bom diferencial): AWS WAF associado ao ALB com regras gerenciadas básicas (ex.: `AWSManagedRulesCommonRuleSet`).
- Tagging obrigatório em todo recurso: `Project`, `Environment`, `ManagedBy = terraform` (facilita cost explorer e mostra disciplina operacional).

## 5. HTTPS / DNS

- Route53 hosted zone para o domínio próprio (pode já existir ou ser criada pelo Terraform, dependendo de onde o domínio foi registrado).
- ACM Certificate para o domínio/subdomínio da API, validado via DNS (registro CNAME criado no Route53 via Terraform, não manual).
- Record Route53 tipo `A`/`ALIAS` apontando para o ALB.
- Listener HTTPS do ALB usando esse certificado; listener HTTP apenas redirecionando.

## 6. Observabilidade

- CloudWatch Log Group dedicado para os logs da task ECS, com retenção definida explicitamente (ex.: 14 ou 30 dias — não deixar infinito).
- Container Insights habilitado no cluster ECS.
- Alarmes CloudWatch mínimos:
  - Health check do target group falhando (unhealthy host count > 0).
  - Taxa de erros 5xx no ALB acima de um threshold.
  - CPU/memória da task acima de threshold (sinal de que o auto scaling não está dando conta ou está mal calibrado).
- Opcional (diferencial): tracing distribuído com AWS X-Ray ou OpenTelemetry Collector como sidecar.

## 7. Terraform como código profissional

- **Remote state**: backend S3 com versionamento habilitado + DynamoDB table para lock. Isso sozinho é um dos sinais mais fortes de maturidade em um repo de portfólio.
- **Estrutura modular**, algo como:
  ```
  modules/
    network/    # VPC, subnets, route tables, SGs
    alb/        # ALB, listeners, target groups
    ecs/        # cluster, task definition, service, auto scaling
    rds/        # Aurora Serverless v2, subnet group, secrets
    dns/        # Route53 + ACM
  environments/
    dev/        # compõe os módulos acima com variáveis do ambiente
  ```
- Cada módulo com `variables.tf`, `outputs.tf` e `main.tf` (ou split por recurso, se ficar grande).
- `versions.tf` fixando a versão do Terraform e dos providers (`required_providers`).
- Outputs bem definidos nos módulos (ex.: `alb_dns_name`, `ecs_cluster_id`, `rds_endpoint`) para composição limpa no ambiente.
- Lint de segurança: `tfsec` e/ou `checkov` rodando localmente e/ou no CI, com achados documentados ou suprimidos conscientemente (nunca ignorados silenciosamente).
- `terraform fmt` e `terraform validate` como parte do fluxo de trabalho padrão antes de qualquer `plan`.

## 8. CI/CD (GitHub Actions)

- **Workflow de aplicação**: build da imagem Docker da API → push para ECR (tag por commit SHA) → trigger de novo deploy no ECS (ex.: `aws ecs update-service --force-new-deployment` ou atualização da task definition).
- **Workflow de infraestrutura**:
  - Em Pull Request: `terraform fmt -check`, `terraform validate`, `terraform plan`, comentário do plano no PR.
  - No merge para `main`: `terraform apply`, idealmente com um gate de aprovação manual (GitHub Environments com required reviewers).
- Credenciais AWS no CI via OIDC (GitHub Actions ↔ IAM Role), evitando access keys estáticas — mais um diferencial de maturidade/segurança.

## 9. Estrutura de pastas sugerida (monorepo)

```
ecs-terraform-infra/
  api/                     # código Express (Dockerfile, src/, package.json)
  modules/
    network/
    alb/
    ecs/
    rds/
    dns/
  environments/
    dev/
      main.tf              # compõe os módulos
      variables.tf
      terraform.tfvars     # gitignored
      backend.tf           # config do remote state
  .github/
    workflows/
      api-deploy.yml
      terraform-plan.yml
      terraform-apply.yml
  ARCHITECTURE.md
  README.md
```

## 10. Roadmap sugerido de implementação

Implementar em camadas incrementais, validando cada uma antes de avançar — evita depurar tudo de uma vez:

1. **Rede**: VPC, subnets, route tables, IGW, VPC Endpoints (ECR api/dkr, S3 gateway, Logs, Secrets Manager), security groups vazios (sem regras específicas ainda).
2. **Banco**: Aurora Serverless v2 + subnet group + Secrets Manager, validando conectividade a partir de uma instância temporária ou bastion.
3. **Compute sem HTTPS**: ECS Fargate + ALB (só HTTP), API mínima respondendo em `/api/health` — validar o caminho internet → ALB → ECS.
4. **Conectar API ao banco**: mesmo que a API não use o banco de fato ainda, validar que a task consegue alcançar o Aurora pela rede/SG (ex.: endpoint de health check "estendido" que testa a conexão).
5. **HTTPS + domínio**: Route53 + ACM + listener HTTPS, redirect HTTP→HTTPS.
6. **CI/CD**: workflows de build/push da API e de plan/apply do Terraform.
7. **Observabilidade**: log retention, Container Insights, alarmes.
8. **Hardening extra**: WAF, tfsec/checkov no CI, revisão de IAM policies, deletion protection, backup retention.

Cada fase é um checkpoint natural para commit e, se quiser, para documentar no README o que foi adicionado e por quê — isso também reforça a narrativa de portfólio.
