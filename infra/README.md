# infra/

Todo o Terraform do projeto, em duas camadas com states separados. O `bootstrap/` guarda o que precisa sobreviver a um destroy: o bucket de state, o registro de imagem e as roles que o CI assume. O `environments/dev/` guarda o workload, que é descartável.

A regra que separa as duas: **a credencial precisa sobreviver ao que ela gerencia.** Com o `github_oidc` dentro do workload, um destroy apagaria as roles que o próximo apply usa, e apagaria logo no começo, porque ele recebia outputs dos outros módulos e o Terraform destrói dependentes primeiro.

| Camada | Conteúdo | State | Quem aplica |
|---|---|---|---|
| `bootstrap/` | Bucket de state, ECR, provider OIDC, três roles, permissions boundary | `bootstrap/terraform.tfstate` | você, local, uma vez |
| `environments/dev/` | Rede, ALB, ECS, RDS, WAF, observabilidade | `dev/terraform.tfstate` | a pipeline |

Parada, a camada de bootstrap custa quase nada: IAM e o provider OIDC não cobram por existir, e sobra o armazenamento do state e das imagens.

## Os módulos

| Módulo | O que provisiona |
|---|---|
| [`network/`](modules/network/) | VPC, subnets em 2 AZs, route tables, security groups, VPC endpoints e flow logs |
| [`alb/`](modules/alb/) | Application Load Balancer, listener e target group com health check |
| [`ecs/`](modules/ecs/) | Cluster Fargate, task definition, service, autoscaling, IAM e log group |
| [`rds/`](modules/rds/) | Aurora Serverless v2, subnet group, parameter group e instâncias |
| [`ecr/`](modules/ecr/) | Repositório de imagem com scan on push e lifecycle policy. Vive no bootstrap |
| [`waf/`](modules/waf/) | Web ACL com rate limit e managed rule groups, associada ao ALB |
| [`observability/`](modules/observability/) | SNS, 9 alarmes, dashboard, metric filter e regras do EventBridge |
| [`github_oidc/`](modules/github_oidc/) | Provider OIDC e as três roles que o CI assume. Vive no bootstrap |

```
infra/
├── bootstrap/        # camada permanente, state próprio, aplicada à mão
├── environments/
│   └── dev/          # o workload, aplicado pela pipeline
└── modules/          # cada um com main/variables/outputs/versions e README próprio
```

## Antes do primeiro apply

O bootstrap cria o bucket que guarda o state, inclusive o dele mesmo. Isso é circular, e resolve com uma migração única.

### 1. Aplicar o bootstrap com state local

```bash
cd bootstrap
terraform init -backend=false
terraform apply
```

O `-backend=false` faz o Terraform ignorar o `backend.tf` e trabalhar com state local, que é o único jeito quando o bucket ainda não existe.

### 2. Mover o state do bootstrap para o bucket

```bash
terraform init -migrate-state
```

Ele detecta o state local, encontra o backend configurado e pergunta se deve copiar. A partir daqui o bootstrap guarda o próprio state no bucket que ele criou.

Se você mudou `state_bucket_name`, o nome novo precisa ser escrito à mão nos dois `backend.tf`, porque backend não aceita interpolação de variável.

### 3. Publicar a imagem de bootstrap

O `image_tag` do workload tem default `bootstrap`, e o service não sobe sem essa tag existir no registry. O ECR agora vive na camada permanente, então este passo acontece uma vez e a imagem sobrevive aos ciclos de destroy e apply do workload.

```bash
REPO_URL=$(terraform output -raw ecr_repository_url)

aws ecr get-login-password --region us-east-1 \
  | docker login --username AWS --password-stdin "${REPO_URL%/*}"

docker build -t "${REPO_URL}:bootstrap" ../../backend
docker push "${REPO_URL}:bootstrap"
```

### Requisitos

```bash
aws sts get-caller-identity    # precisa devolver uma identidade
terraform version              # ~> 1.15
docker version                 # daemon rodando, para a imagem de bootstrap
```

## Aplicar o workload

```bash
cd environments/dev
terraform init
terraform apply
```

Leva de 10 a 15 minutos, e o Aurora é o gargalo. Deu certo quando o `terraform plan` seguinte reporta `No changes`.

O workload lê o repositório de imagem com `data "aws_ecr_repository"`, então ele falha de imediato e com mensagem clara se o bootstrap não tiver rodado antes.

### Destruir

```bash
terraform destroy
```

Isso derruba só o workload. O bucket de state, o ECR com as imagens e as roles do CI continuam de pé, que é o ponto de terem state separado: depois do destroy, um PR aberto continua recebendo comentário de plan, e o apply seguinte pode correr pela própria pipeline.

Uma assinatura SNS não confirmada sobrevive ao destroy: ela sai do state e continua na conta, desaparecendo sozinha em cerca de três dias.

## Depois do apply, na mão

Duas coisas não são provisionáveis por Terraform porque não são recursos da AWS.

**A assinatura de e-mail dos alarmes.** Se `alarm_email` estiver preenchida, a AWS manda um link de confirmação e alguém precisa clicar. Até lá nenhum alarme notifica ninguém. Deixar a variável vazia evita criar a assinatura, e o tópico continua existindo normalmente.

**A configuração do GitHub.** O environment `production` com required reviewers, cujo nome tem que bater com o do módulo `github_oidc`, e as três variáveis de repositório `AWS_PLAN_ROLE_ARN`, `AWS_APPLY_ROLE_ARN` e `AWS_DEPLOY_ROLE_ARN`, preenchidas com os outputs do bootstrap:

```bash
cd bootstrap && terraform output
```

Isso é feito uma vez. As roles vivem na camada permanente, então destruir o workload não invalida nenhuma dessas variáveis.

## Exceções de segurança aceitas

O Checkov roda no CI sem credencial da AWS, só lendo os arquivos, e quebra o build em qualquer achado. Estado atual: **327 checks passando, 0 falhando, 36 suprimidos**.

Toda supressão é inline, ao lado do recurso, com a justificativa dentro do próprio `checkov:skip`. Nenhuma fica escondida num arquivo global. Os agrupamentos:

| Categoria | Por quê |
|---|---|
| HTTP sem TLS | Listener HTTPS e ACM são a fase pausada, esperando domínio |
| SG aberto para `0.0.0.0/0` | É o security group de um ALB público, e essa é a função dele. Tudo atrás só aceita o tier anterior |
| Chaves gerenciadas em vez de CMK | Uma CMK custa 1 USD por mês mais administração de chave, para proteger log de requisição e uma tabela de health check numa conta de desenvolvimento |
| Deletion protection desligada | Parametrizada. `false` em dev porque o ambiente é destruído entre sessões, e os tfvars de produção invertem |
| Enhanced Monitoring ausente | Cobrado por instância e sobreposto ao Performance Insights, que está ligado e é gratuito na retenção de 7 dias |
| AWS Backup ausente | Redundante com `backup_retention_period`, que já dá point-in-time recovery |
| SG "não anexado" | Falso positivo: os security groups são anexados em outro módulo, por variável, e o graph check não atravessa fronteira de módulo |
| IAM com `*` | O `Allow *` está no permissions boundary, que nunca concede permissão. Ele é o teto que os `Deny` recortam, e sem ele o boundary seria conjunto vazio |
