# infra/

Todo o Terraform do projeto. Um ambiente em `environments/dev` compõe oito módulos, e cada módulo documenta as próprias decisões no README dele.

## Os módulos

| Módulo | O que provisiona |
|---|---|
| [`network/`](modules/network/) | VPC, subnets em 2 AZs, route tables, security groups, VPC endpoints e flow logs |
| [`alb/`](modules/alb/) | Application Load Balancer, listener e target group com health check |
| [`ecs/`](modules/ecs/) | Cluster Fargate, task definition, service, autoscaling, IAM e log group |
| [`rds/`](modules/rds/) | Aurora Serverless v2, subnet group, parameter group e instâncias |
| [`ecr/`](modules/ecr/) | Repositório de imagem com scan on push e lifecycle policy |
| [`waf/`](modules/waf/) | Web ACL com rate limit e managed rule groups, associada ao ALB |
| [`observability/`](modules/observability/) | SNS, 9 alarmes, dashboard, metric filter e regras do EventBridge |
| [`github_oidc/`](modules/github_oidc/) | Provider OIDC e as três roles que o CI assume |

```
infra/
├── environments/
│   └── dev/          # compõe os módulos, guarda o backend e os outputs
└── modules/          # cada um com main/variables/outputs/versions e README próprio
```

## Antes do primeiro apply

### O bucket do state

O backend S3 que guarda o state precisa existir antes de qualquer `terraform init`, e ele **não é gerenciado por Terraform**, de propósito: é o único recurso que deveria ser criado uma vez e nunca mais alterado. É um passo único por conta AWS, e os ambientes seguintes só apontam para uma `key` diferente dentro do mesmo bucket.

Troque `BUCKET_NAME` por um nome realmente único, porque nome de bucket é global entre todas as contas da AWS:

```bash
aws s3api create-bucket --bucket BUCKET_NAME --region us-east-1

aws s3api put-bucket-versioning --bucket BUCKET_NAME \
  --versioning-configuration Status=Enabled

aws s3api put-bucket-encryption --bucket BUCKET_NAME \
  --server-side-encryption-configuration '{"Rules":[{"ApplyServerSideEncryptionByDefault":{"SSEAlgorithm":"AES256"}}]}'

aws s3api put-public-access-block --bucket BUCKET_NAME \
  --public-access-block-configuration BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true
```

Fora de `us-east-1`, o `create-bucket` exige também `--create-bucket-configuration LocationConstraint=REGION`.

Depois é só apontar `environments/dev/backend.tf` para ele. O lock é nativo do backend S3 desde o Terraform 1.10, sem tabela DynamoDB:

```hcl
terraform {
  backend "s3" {
    bucket       = "BUCKET_NAME"
    key          = "dev/terraform.tfstate"
    region       = "us-east-1"
    use_lockfile = true
    encrypt      = true
  }
}
```

### Requisitos

```bash
aws sts get-caller-identity    # precisa devolver uma identidade
terraform version              # ~> 1.15
docker version                 # daemon rodando, para a imagem de bootstrap
```

## Como aplicar

Aplicar tudo de uma vez falha, e a causa não é óbvia. O `image_tag` tem default `bootstrap`, uma tag que ainda não existe no registry. Com o circuit breaker ligado no service, o deployment entra em `FAILED` sem versão anterior para onde voltar. O registry precisa vir primeiro.

**1. Só o ECR:**

```bash
cd environments/dev
terraform init
terraform apply -target=module.ecr
```

O aviso do Terraform sobre `-target` é esperado aqui.

**2. A imagem de bootstrap:**

```bash
REPO_URL=$(terraform output -raw ecr_repository_url)

aws ecr get-login-password --region us-east-1 \
  | docker login --username AWS --password-stdin "${REPO_URL%/*}"

docker build -t "${REPO_URL}:bootstrap" ../../../backend
docker push "${REPO_URL}:bootstrap"
```

**3. O resto:**

```bash
terraform apply
```

Leva de 10 a 15 minutos, e o Aurora é o gargalo. Deu certo quando o `terraform plan` seguinte reporta `No changes`.

### Destruir

```bash
terraform destroy
```

O bucket do state permanece de pé, porque ele nunca esteve sob o Terraform. Uma assinatura SNS não confirmada também sobrevive ao destroy: ela sai do state mas continua na conta, e desaparece sozinha em cerca de três dias.

## Depois do apply, na mão

Duas coisas não são provisionáveis por Terraform porque não são recursos da AWS.

**A assinatura de e-mail dos alarmes.** Se `alarm_email` estiver preenchida, a AWS manda um link de confirmação e alguém precisa clicar. Até lá nenhum alarme notifica ninguém. Deixar a variável vazia evita criar a assinatura, e o tópico continua existindo normalmente.

**A configuração do GitHub.** O environment `production` com required reviewers, cujo nome tem que bater com o do módulo `github_oidc`, e as três variáveis de repositório `AWS_PLAN_ROLE_ARN`, `AWS_APPLY_ROLE_ARN` e `AWS_DEPLOY_ROLE_ARN`, preenchidas com os outputs do apply. O primeiro apply roda local por necessidade: as roles que o CI usa são criadas por ele, então antes disso o CI não tem como se autenticar.

## Exceções de segurança aceitas

O Checkov roda no CI sem credencial da AWS, só lendo os arquivos, e quebra o build em qualquer achado. Estado atual: **305 checks passando, 0 falhando, 29 suprimidos**.

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
