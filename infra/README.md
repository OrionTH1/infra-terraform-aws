# Infraestrutura — setup do remote state

Antes de rodar `terraform init`/`plan`/`apply` em qualquer ambiente (`environments/dev`, etc.), o bucket S3 que guarda o state precisa existir. Ele **não é gerenciado por Terraform** — de propósito: é o único recurso do projeto que deveria ser criado uma única vez e nunca mais alterado ou destruído, e colocá-lo sob o mesmo Terraform que ele mesmo faz o backend de teria o efeito colateral de deixá-lo sujeito a um `terraform destroy` rodado no diretório/ambiente errado. Criar manualmente elimina essa classe de acidente por completo, em vez de só mitigá-la com trava (`prevent_destroy` etc.).

Isso é um passo único por conta AWS — depois de criado, nenhum ambiente (`dev`, `staging`, `prod`) precisa recriar o bucket, só aponta pra ele com uma `key` diferente.

## 1. Descubra o Account ID

```bash
aws sts get-caller-identity --query Account --output text
```

O nome do bucket usa o Account ID como sufixo para garantir unicidade global (nomes de bucket S3 são únicos entre *todas* as contas AWS do mundo, não só a sua) — substitua `<ACCOUNT_ID>` pelo valor retornado em todos os comandos abaixo.

## 2. Crie o bucket

```bash
aws s3api create-bucket \
  --bucket ecs-portfolio-tfstate-<ACCOUNT_ID> \
  --region us-east-1
```

> Se o `aws-region` do projeto não for `us-east-1`, adicione `--create-bucket-configuration LocationConstraint=<region>` — `us-east-1` é o único caso em que esse parâmetro não é aceito.

## 3. Habilite versionamento

Protege contra sobrescrita/corrupção acidental do state — qualquer versão anterior fica recuperável.

```bash
aws s3api put-bucket-versioning \
  --bucket ecs-portfolio-tfstate-<ACCOUNT_ID> \
  --versioning-configuration Status=Enabled
```

## 4. Habilite criptografia at-rest

```bash
aws s3api put-bucket-encryption \
  --bucket ecs-portfolio-tfstate-<ACCOUNT_ID> \
  --server-side-encryption-configuration '{
    "Rules": [{ "ApplyServerSideEncryptionByDefault": { "SSEAlgorithm": "AES256" } }]
  }'
```

## 5. Bloqueie qualquer acesso público

O state contém, entre outras coisas, o CIDR da VPC e IDs de recursos — nada catastrófico, mas ainda assim não deveria ser público.

```bash
aws s3api put-public-access-block \
  --bucket ecs-portfolio-tfstate-<ACCOUNT_ID> \
  --public-access-block-configuration \
  BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true
```

## 6. Aponte o ambiente pro bucket

O nome real do bucket (já com o Account ID resolvido) precisa estar hardcoded no `backend.tf` de cada ambiente — o bloco `terraform { backend "s3" {...} }` é resolvido antes de qualquer variável existir, então não aceita `var.*`/interpolação. Edite `environments/dev/backend.tf` trocando `<ACCOUNT_ID>` pelo valor real:

```hcl
terraform {
  backend "s3" {
    bucket       = "ecs-portfolio-tfstate-<ACCOUNT_ID>"
    key          = "dev/terraform.tfstate"
    region       = "us-east-1"
    use_lockfile = true
    encrypt      = true
  }
}
```

Depois disso, `cd environments/dev && terraform init` já inicializa contra o backend remoto.

## Adicionando um novo ambiente (ex. `staging`)

Não recria o bucket — só usa uma `key` diferente dentro do mesmo bucket, para o state de cada ambiente ficar isolado:

```hcl
terraform {
  backend "s3" {
    bucket       = "ecs-portfolio-tfstate-<ACCOUNT_ID>"
    key          = "staging/terraform.tfstate"
    region       = "us-east-1"
    use_lockfile = true
    encrypt      = true
  }
}
```
