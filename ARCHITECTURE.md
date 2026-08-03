# Arquitetura — ecs-terraform-infra

## Objetivo do projeto

Este projeto existe para demonstrar proficiência em infraestrutura AWS via Terraform. A aplicação em si é intencionalmente trivial: um servidor Express com um único endpoint, `GET /api/v1/health`, que retorna `200 OK` quando tudo está saudável. Toda a complexidade e o esforço de engenharia devem estar na infraestrutura — rede, segurança, observabilidade, CI/CD e organização do Terraform — não no código da aplicação.

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
   │  health check do target group em /api/v1/health
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
- **Sem NAT Gateway**: a API não faz chamadas de saída para serviços externos (só responde `/api/v1/health`), então não há necessidade de dar saída geral de internet às subnets privadas. Em vez de NAT, o acesso a serviços AWS a partir das tasks ECS é feito via **VPC Endpoints (PrivateLink)** — ver seção 1.1. Isso reduz superfície de ataque (subnets privadas 100% isoladas de internet) e evita o custo/complexidade do NAT Gateway. Se no futuro a API precisar chamar uma API de terceiros, essa decisão deve ser revisitada e um NAT Gateway (ou solução equivalente) introduzido.
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
  - Target Group com health check apontando para `/api/v1/health` (ajustar threshold/interval para failover rápido, mas sem flapping).
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

### 4.1. WAF: começar contando, não bloqueando

O módulo `waf` anexa uma Web ACL ao ALB com quatro managed rule groups da AWS mais um *rate limit* por IP. A decisão que importa aqui não é *quais* regras, é **como ligá-las**:

| Regra | Modo inicial |
|---|---|
| Rate limit por IP (2000 req/5min) | bloqueia |
| `AmazonIpReputationList` | bloqueia |
| `KnownBadInputsRuleSet` | bloqueia |
| `CommonRuleSet` | **conta** (`count {}`) |
| `SQLiRuleSet` | **conta** (`count {}`) |

Um WAF mal calibrado derruba tráfego legítimo silenciosamente — e o `CommonRuleSet` é o mais propenso a falso positivo (regras como `SizeRestrictions_BODY` quebram uploads legítimos). O caminho correto é subir em `count {}`, revisar os *sampled requests* no CloudWatch, e só então virar para bloqueio. O rate limit vem primeiro na ordem de prioridade porque é a regra mais barata de avaliar e protege contra o que de fato acontece com um endpoint público, independente de assinatura.

Os logs do WAF redigem os headers `authorization` e `cookie` — sem isso, credenciais de requisições bloqueadas iriam para o CloudWatch em texto claro.

### 4.2. Permissions boundary na role de apply

A role de apply do CI concede acesso amplo *por serviço* (`ec2:*`, `rds:*`, …) em vez de enumerar cada ação. Isso é uma escolha consciente: mapear cada chamada de API que o Terraform faz através de sete módulos é manutenção que desatualiza a cada upgrade de provider, e o resultado seria uma policy incompleta que quebra no `apply` seguinte.

O alcance é limitado por dois mecanismos em vez disso:

1. **Condition `aws:RequestedRegion`** em todos os statements amplos — nada fora da região do projeto é alcançável.
2. **Permissions boundary** (`permissions_boundary.tf`) — permissões efetivas são a *interseção* entre a policy e o boundary, então mesmo que a policy fosse ampliada por engano, o boundary continua negando: criação de usuários/access keys (caminhos de escalação de privilégio que sobreviveriam à sessão OIDC de 1h), ações de `organizations`/`account`/billing, destruição do bucket de state, e qualquer coisa fora da região.

O passo seguinte, não implementado, seria gerar a policy a partir do CloudTrail com o IAM Access Analyzer — inviável aqui porque exige ~90 dias de histórico numa infra que é destruída entre sessões.

### 4.3. Scanners no CI

- **Checkov** (`terraform-plan.yml`) analisa o IaC. Roda em job separado, **sem credenciais AWS** — só lê arquivos `.tf`, então não há motivo para ter acesso a nada.
- **Trivy** (`api-deploy.yml`) escaneia a imagem **antes** do push para o ECR. Isso complementa o `scan_on_push` do repositório: uma imagem vulnerável não chega ao registry, em vez de ser descoberta lá depois.
- Ambos publicam SARIF na aba **Security → Code scanning** do repositório (gratuito em repos públicos), que é evidência bem mais persuasiva que um check verde.
- Ambos falham o build em achados relevantes (`soft_fail: false`, Trivy em `HIGH,CRITICAL`). Um scanner que só reporta vira decoração: o build fica verde para sempre e ninguém abre o relatório.

### 4.4. Exceções de segurança aceitas

Estado atual: **305 checks passando, 0 falhando, 29 suprimidos**. Toda supressão é inline, ao lado do recurso, com a justificativa no próprio comentário `checkov:skip` — nunca escondida num arquivo global. As categorias:

| Categoria | Justificativa |
|---|---|
| `CKV_AWS_2`, `CKV_AWS_103`, `CKV2_AWS_20`, `CKV_AWS_378` (HTTP sem TLS) | Listener HTTPS + ACM é a Fase 5, pausada até haver domínio registrado. |
| `CKV_AWS_260` (SG aberto para `0.0.0.0/0`) | É o SG de um ALB *internet-facing* — aceitar 80/443 do mundo é a função dele. Tudo atrás só aceita tráfego do tier anterior. |
| `CKV_AWS_158`, `CKV_AWS_327`, `CKV_AWS_354`, `CKV_AWS_136` (KMS CMK) | Chaves gerenciadas pela AWS. Uma CMK custa $1/mês + administração de chave para proteger, neste caso, logs de requisição e uma tabela de health check numa conta de dev. Seria *security theater*. |
| `CKV_AWS_139`, `CKV_AWS_150` (deletion protection) | Parametrizado; `false` em dev porque o ambiente é destruído entre sessões. Os `tfvars` de prod invertem. |
| `CKV_AWS_118` (Enhanced Monitoring) | Cobrado por instância e sobreposto ao Performance Insights (habilitado, grátis em 7 dias) + alarmes CloudWatch. |
| `CKV2_AWS_8` (AWS Backup) | Redundante com `backup_retention_period`, que já dá point-in-time recovery. |
| `CKV2_AWS_5` (SG não anexado) | Falso positivo: os SGs são anexados em outros módulos, via variável — o graph check não atravessa fronteira de módulo. |
| `CKV_AWS_1`, `CKV_AWS_49`, `CKV_AWS_109`, `CKV_AWS_111`, `CKV_AWS_356`, `CKV2_AWS_40` (IAM com `*`) | O `Allow *` está no *permissions boundary*, que nunca concede permissão — é o teto que os `Deny` recortam. Sem ele o boundary seria conjunto vazio. Nas policies de leitura, `Describe*`/`List*` não suportam permissão por recurso na maioria dos serviços. |

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

### 6.1. Alarmes implementados

Tudo no módulo `observability`, publicando num único SNS topic (`alarm_actions` **e** `ok_actions` — receber o aviso de recuperação importa tanto quanto o de falha).

| Alarme | Métrica | Threshold | `treat_missing_data` |
|---|---|---|---|
| Targets não saudáveis | `UnHealthyHostCount` (Max) | `> 0` por 2min | `notBreaching` |
| Capacidade perdida | `HealthyHostCount` (Min) | `< 2` por 2min | `notBreaching` |
| Taxa de erro 5xx | metric math (ver abaixo) | `> 5%` por 10min | `notBreaching` |
| Latência | `TargetResponseTime` **p99** | `> 5s` por 15min | `notBreaching` |
| CPU | `AWS/ECS CPUUtilization` | `> 85%` por 5min | `notBreaching` |
| Memória | `AWS/ECS MemoryUtilization` | `> 80%` por 5min | `notBreaching` |
| Tasks rodando | `ECS/ContainerInsights RunningTaskCount` | `< 2` por 3min | **`breaching`** |
| Conexões no banco | `AWS/RDS DatabaseConnections` | `> 50` por 10min | `notBreaching` |
| Erros na aplicação | log metric filter (`$.level >= 50`) | `> 10` em 5min | `notBreaching` |

Complementando, dois eventos do EventBridge → SNS (`SERVICE_DEPLOYMENT_FAILED` e `SERVICE_TASK_PLACEMENT_FAILURE`), porque **falha de deploy não tem métrica CloudWatch** — só existe como evento.

### 6.2. Decisões e armadilhas

**`treat_missing_data` é a decisão mais importante de cada alarme.** Métricas do ALB só são publicadas quando há tráfego, e `HTTPCode_*_5XX_Count` especificamente só é publicada **quando é diferente de zero**. Num ambiente de portfólio que fica ocioso, isso significa:
- default (`missing`) → o alarme de 5xx vive em `INSUFFICIENT_DATA` e nunca volta limpo para `OK`;
- `breaching` → alarme dispara de madrugada porque ninguém acessou o site;
- **`notBreaching`** (o escolhido) → ausência de dado = sem erros = `OK`.

A exceção é `RunningTaskCount`, onde `breaching` é o correto: ali a ausência de dado **é** o incidente — nenhuma task reportando significa nenhuma task viva.

`UnHealthyHostCount` é o alarme mais confiável desta stack justamente por ser publicado mesmo sem tráfego, desde que haja targets registrados.

**Taxa de erro, não contagem absoluta.** "10 erros" significa coisas opostas a 100 req/min e a 100k req/min. A expressão usada é:

```
IF(m1 >= 30, 100 * (FILL(m2,0) + FILL(m3,0)) / m1, 0)
```

- `FILL(m2,0)` — sem isso a expressão inteira fica *missing* (não zero) sempre que não há erros, porque a métrica de 5xx é esparsa;
- `IF(m1 >= 30, ...)` — guarda de volume baixo: sem ela, 1 erro em 2 requisições vira "50% de taxa de erro";
- `m2` (`HTTPCode_ELB_5XX_Count`, gerado pelo ALB: 502/503/504) e `m3` (`HTTPCode_Target_5XX_Count`, gerado pela aplicação) são somados porque, do lado do usuário, a distinção é invisível.

**Por que alarmar CPU se já existe auto scaling?** Porque o auto scaling desta stack reage a `ALBRequestCountPerTarget` — ou seja, só adiciona capacidade quando o *volume de requisições* sobe. CPU alta **desacoplada** do volume (loop infinito, GC thrash, query patológica) é invisível para ele. E memória é ainda mais crítica: não existe auto scaling por memória nenhum aqui, então o alarme é o único aviso antes do OOM kill.

**Um único alarme no Aurora, de propósito.** Com `min_capacity = 0`, o cluster pausa quando ocioso e **para de publicar a maioria das métricas** (não reporta zero — some). Qualquer alarme com `breaching` dispararia toda noite. E `ACUUtilization` é inútil aqui: `max_capacity = 1` é uma decisão de custo, então bater 100% é a configuração funcionando, não um incidente. Sobra `DatabaseConnections`, que detecta *connection leak* no pool do Express — uma falha real e causada pela aplicação.

**Container Insights: `enabled`, não `enhanced`.** O modo `enhanced` acrescenta métricas por container — que, com um único container por task, são duplicatas das métricas de task, a ~5x a contagem de métricas cobradas. O modo `enabled` custa mais que zero (~$8-11/mês num ambiente 24/7), e a única métrica que realmente depende dele aqui é `RunningTaskCount`; por isso `var.container_insights` aceita `disabled` e o alarme correspondente some via `count` (o `HealthyHostCount`, gratuito, cobre o mesmo sinal de forma aproximada).

**Deployment circuit breaker** (`enable` + `rollback`) está ligado no service: sem ele, um deploy com imagem quebrada fica em loop infinito criando e matando tasks, silenciosamente. O módulo expõe `stable_alarm_arns` para quem quiser ligar `deployment_alarms` — deliberadamente só os alarmes que não oscilam num ambiente ocioso, já que um alarme ruidoso ali transforma todo deploy em roleta.

**Tracing distribuído: avaliado e deliberadamente não implementado.** X-Ray/OpenTelemetry responde "em qual dos N serviços está a latência". Esta topologia tem **um** serviço e **um** endpoint — o service map seria uma caixa e uma seta. O custo (sidecar consumindo CPU/memória da task, config do collector, instrumentação, permissões na task role) não se paga. É o próximo passo natural no dia em que existir um segundo serviço.

## 7. Terraform como código profissional

- **Remote state**: backend S3 com versionamento habilitado + locking nativo do próprio backend (`use_lockfile = true`, Terraform 1.10+) — sem DynamoDB table, já que o locking via DynamoDB está deprecated pela HashiCorp. Isso sozinho é um dos sinais mais fortes de maturidade em um repo de portfólio.
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
- Lint de segurança: `checkov` (IaC) e `trivy` (imagem) rodando no CI, com achados documentados ou suprimidos conscientemente (nunca ignorados silenciosamente). O `tfsec`, citado na versão original deste documento, foi descontinuado e absorvido pelo Trivy — não use.
- `terraform fmt` e `terraform validate` como parte do fluxo de trabalho padrão antes de qualquer `plan`.

## 8. CI/CD (GitHub Actions)

- **Workflow de aplicação**: build da imagem Docker da API → push para ECR (tag por commit SHA) → trigger de novo deploy no ECS (ex.: `aws ecs update-service --force-new-deployment` ou atualização da task definition).
- **Workflow de infraestrutura**:
  - Em Pull Request: `terraform fmt -check`, `terraform validate`, `terraform plan`, comentário do plano no PR.
  - No merge para `main`: `terraform apply`, idealmente com um gate de aprovação manual (GitHub Environments com required reviewers).
- Credenciais AWS no CI via OIDC (GitHub Actions ↔ IAM Role), evitando access keys estáticas — mais um diferencial de maturidade/segurança.

### 8.1. Decisões de implementação

Duas escolhas tomadas ao implementar esta seção, que valem estar registradas:

**Três IAM Roles, não uma.** Cada workflow assume uma role com escopo próprio, e a trust policy de cada uma usa `StringEquals` (nunca wildcard) num claim `sub` diferente:

| Role | Claim `sub` exigido | Permissões |
|---|---|---|
| `gha-plan` | `repo:OWNER/REPO:pull_request` | Só leitura (`Describe*`/`List*`/`Get*`) + lock do state |
| `gha-apply` | `repo:OWNER/REPO:environment:production` | Leitura/escrita nos serviços do projeto; `iam:*Role*` escopado a `ecs-portfolio-*` |
| `gha-deploy` | `repo:OWNER/REPO:ref:refs/heads/main` | Só push no ECR + `UpdateService` neste service + `PassRole` das roles do ECS |

A `gha-apply` depender do claim `environment:production` (e não de `ref:refs/heads/main`) faz o gate de aprovação do GitHub e a permissão da AWS serem a mesma trava: sem passar pelo required reviewer, a credencial nem é emitida.

**Deploy de imagem não passa por Terraform.** O `aws_ecs_task_definition` criado pelo Terraform é só o *molde inicial*; cada deploy real registra uma revisão nova via `aws ecs register-task-definition` (actions oficiais `amazon-ecs-render-task-definition` + `amazon-ecs-deploy-task-definition`). Para o Terraform não reverter isso no próximo apply de infra, `aws_ecs_service` tem `lifecycle.ignore_changes = [desired_count, task_definition]`.

Motivo: deploy de aplicação acontece várias vezes ao dia, mudança de infra é rara. Se ambos rodassem `terraform apply`, disputariam o lock do state a cada push, e um deploy de uma linha de código recalcularia VPC/ALB/RDS inteiros só para trocar a tag da imagem.

### 8.2. Configuração manual necessária no repositório

Não é possível provisionar via Terraform (é config do GitHub, não da AWS):

1. **Environment `production`** (`Settings → Environments`), com **Required reviewers** — o nome precisa bater com `var.github_environment` do módulo `github_oidc`.
2. **Repository Variables** (`Settings → Secrets and variables → Actions → Variables`), preenchidas com os outputs do `terraform apply`: `AWS_PLAN_ROLE_ARN`, `AWS_APPLY_ROLE_ARN`, `AWS_DEPLOY_ROLE_ARN`.
3. **Bootstrap**: o primeiro `terraform apply` roda localmente — as roles que o CI usa são criadas por ele, então o CI ainda não tem como se autenticar antes disso existir.

## 9. Estrutura de pastas sugerida (monorepo)

Estrutura real do repositório (atualizada conforme a implementação avançou):

```
ecs-terraform-infra/
  backend/                 # código Express (Dockerfile, src/, package.json)
  infra/
    README.md              # setup manual do bucket de remote state
    modules/
      network/             # VPC, subnets, route tables, SGs, VPC endpoints
      alb/                 # ALB, listener, target group
      ecr/                 # repositório de imagem + lifecycle policy
      ecs/                 # cluster, task definition, service, autoscaling, IAM, logs
      rds/                 # Aurora Serverless v2, subnet group, instances
      observability/       # SNS, alarmes, dashboard, log metric filter, EventBridge
      waf/                 # Web ACL, managed rule groups, rate limit, logging
      github_oidc/         # OIDC provider + roles de plan/apply/deploy do CI
      dns/                 # (pendente — Fase 5, aguardando domínio)
    environments/
      dev/
        main.tf            # compõe os módulos
        variables.tf
        outputs.tf
        backend.tf         # config do remote state
  .github/
    dependabot.yml         # github-actions + terraform + npm, semanal
    workflows/
      api-deploy.yml       # build → Trivy → push ECR → deploy ECS
      terraform-plan.yml   # Checkov + fmt/validate/plan comentado no PR
      terraform-apply.yml  # apply com gate de aprovação manual
  .checkov.yaml            # config do scanner (skips globais justificados)
  ARCHITECTURE.md
  README.md
```

## 10. Roadmap sugerido de implementação

Implementar em camadas incrementais, validando cada uma antes de avançar — evita depurar tudo de uma vez:

1. ✅ **Rede**: VPC, subnets, route tables, IGW, VPC Endpoints (ECR api/dkr, S3 gateway, Logs, Secrets Manager), security groups vazios (sem regras específicas ainda).
2. ✅ **Compute sem HTTPS**: ECS Fargate + ALB (só HTTP), API mínima respondendo em `/api/v1/health` — validar o caminho internet → ALB → ECS.
3. ✅ **Banco**: Aurora Serverless v2 + subnet group + Secrets Manager, validando conectividade a partir da própria task ECS (já em pé desde a etapa anterior) ou de uma instância temporária/bastion.
4. ✅ **Conectar API ao banco**: mesmo que a API não use o banco de fato ainda, validar que a task consegue alcançar o Aurora pela rede/SG (ex.: endpoint de health check "estendido" que testa a conexão).
5. ⏸️ **HTTPS + domínio** (em espera — aguardando aquisição de um domínio; ver nota abaixo): Route53 + ACM + listener HTTPS, redirect HTTP→HTTPS.
6. ✅ **CI/CD**: workflows de build/push da API e de plan/apply do Terraform.
7. ✅ **Observabilidade**: log retention, Container Insights, alarmes.
8. ✅ **Hardening extra**: WAF, Checkov/Trivy no CI, revisão de IAM policies, deletion protection, backup retention.

Cada fase é um checkpoint natural para commit e, se quiser, para documentar no README o que foi adicionado e por quê — isso também reforça a narrativa de portfólio.

**Nota sobre a Fase 5**: pausada de propósito até haver um domínio próprio registrado — não faz sentido gerar o hosted zone/certificado sem um domínio real pra validar. Isso não bloqueia o restante do roadmap: as Fases 6–8 não dependem de HTTPS/domínio (CI/CD builda e aplica normalmente com o ALB em HTTP puro; observabilidade é toda sobre ECS/CloudWatch; o WAF se anexa ao ALB independente do listener ser HTTP ou HTTPS). A ordem pode seguir 6 → 7 → 8 → 5 sem problema, retomando a Fase 5 assim que o domínio existir.
