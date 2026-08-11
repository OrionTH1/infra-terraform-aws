# `ecr`

O repositório de imagem da aplicação, com scan na publicação e expiração automática de imagens antigas.

## Recursos

| Arquivo | Recursos |
|---|---|
| `main.tf` | `aws_ecr_repository`, `aws_ecr_lifecycle_policy` |

A tag é imutável, então republicar a mesma tag falha em vez de sobrescrever silenciosamente. A lifecycle policy expira imagem sem tag depois de 7 dias e mantém as 20 últimas.

## Variáveis

| Variável | Tipo | Default | Descrição |
|---|---|---|---|
| `project` | `string` | obrigatório | Prefixo do nome do repositório |
| `environment` | `string` | obrigatório | Ambiente, usado no nome |
| `force_delete` | `bool` | `true` | Permite destruir o repositório com imagens dentro |

## Outputs

`repository_url` para referência da imagem na task definition, `repository_arn` para escopo da policy de pull, e `repository_name` para o CI publicar.
