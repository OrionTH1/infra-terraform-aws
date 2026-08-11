# `github_oidc`

O provider OIDC do GitHub Actions e as três roles que os workflows assumem. Nenhuma chave de acesso estática existe no projeto.

## Recursos

| Arquivo | Recursos |
|---|---|
| `provider.tf` | `aws_iam_openid_connect_provider`, com o thumbprint lido do certificado do emissor |
| `iam_plan_role.tf` | Role de leitura usada pelo workflow de plan |
| `iam_apply_role.tf` | Role de escrita usada pelo workflow de apply |
| `iam_deploy_role.tf` | Role de publicação de imagem e atualização do service |
| `permissions_boundary.tf` | Boundary anexado à role de apply |

Cada trust policy exige um claim `sub` diferente e usa `StringEquals`, nunca wildcard. A role de plan responde a pull request, a de apply ao environment do GitHub, e a de deploy à branch principal.

## Variáveis

| Variável | Tipo | Default | Descrição |
|---|---|---|---|
| `project`, `environment` | `string` | obrigatório | Prefixo de nome e tag |
| `github_repository` | `string` | obrigatório | Repositório no formato `owner/repo` |
| `github_environment` | `string` | `production` | Environment exigido no claim da role de apply |
| `state_bucket_arn` / `state_key` | `string` | obrigatório | Escopo do acesso ao state remoto |
| `ecr_repository_arn` | `string` | obrigatório | Repositório onde o deploy publica |
| `ecs_service_arn` | `string` | obrigatório | Service que o deploy atualiza |
| `ecs_execution_role_arn` / `ecs_task_role_arn` | `string` | obrigatório | Roles que o deploy pode passar ao ECS |

## Outputs

`plan_role_arn`, `apply_role_arn` e `deploy_role_arn`, que preenchem as variáveis de repositório do GitHub.
