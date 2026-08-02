# Infraestrutura — setup do remote state

Antes de rodar `terraform init`/`plan`/`apply` em qualquer ambiente (`environments/dev`, etc.), o bucket S3 que guarda o state precisa existir. Ele **não é gerenciado por Terraform** — de propósito: é o único recurso do projeto que deveria ser criado uma única vez e nunca mais alterado ou destruído.

Isso é um passo único por conta AWS — depois de criado, nenhum ambiente (`dev`, `staging`, `prod`) precisa recriar o bucket, só aponta pra ele com uma `key` diferente.

> **`BUCKET_NAME`** nos comandos e arquivos abaixo é um placeholder — troque por um nome de bucket S3 realmente único (nomes de bucket são únicos entre *todas* as contas AWS do mundo, não só a sua.)
## 1. Crie o bucket

```bash
aws s3api create-bucket \
  --bucket BUCKET_NAME \
  --region us-east-1
```

> Se o `aws-region` do projeto não for `us-east-1`, adicione `--create-bucket-configuration LocationConstraint=REGION` — `us-east-1` é o único caso em que esse parâmetro não é aceito.

## 2. Habilite versionamento

Protege contra sobrescrita/corrupção acidental do state — qualquer versão anterior fica recuperável.

```bash
aws s3api put-bucket-versioning \
  --bucket BUCKET_NAME \
  --versioning-configuration Status=Enabled
```

## 3. Habilite criptografia at-rest

```bash
aws s3api put-bucket-encryption \
  --bucket BUCKET_NAME \
  --server-side-encryption-configuration '{
    "Rules": [{ "ApplyServerSideEncryptionByDefault": { "SSEAlgorithm": "AES256" } }]
  }'
```

## 4. Bloqueie qualquer acesso público

O state contém, entre outras coisas, o CIDR da VPC e IDs de recursos — nada catastrófico, mas ainda assim não deveria ser público.

```bash
aws s3api put-public-access-block \
  --bucket BUCKET_NAME \
  --public-access-block-configuration \
  BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true
```

## 5. Aponte o ambiente pro bucket

Mude `BUCKET_NAME` no `environments/dev/backend.tf` para o nome real do bucket escolhido:

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

Depois disso, `cd environments/dev && terraform init` já inicializa contra o backend remoto.

## Confirmação da assinatura de e-mail dos alarmes

Se `var.alarm_email` estiver preenchida, o `apply` cria uma assinatura SNS que fica em **`PendingConfirmation`** até alguém clicar no link que a AWS envia por e-mail. O Terraform não consegue confirmar isso — é um passo único por destinatário, análogo a validar um domínio.

Duas consequências práticas:

- Enquanto não confirmar, **nenhum alarme chega**.
- Uma assinatura não confirmada **não pode ser deletada pelo Terraform**: um `destroy` a remove do state mas ela permanece na conta (some sozinha em ~3 dias).

Deixe `alarm_email` vazia se não quiser criar assinatura nenhuma — o tópico é criado de qualquer forma e os alarmes continuam funcionando (só não notificam ninguém).

## Adicionando um novo ambiente (ex. `staging`)

Não recria o bucket — só usa uma `key` diferente dentro do mesmo bucket, para o state de cada ambiente ficar isolado:

```hcl
terraform {
  backend "s3" {
    bucket       = "BUCKET_NAME"
    key          = "staging/terraform.tfstate"
    region       = "us-east-1"
    use_lockfile = true
    encrypt      = true
  }
}
```
