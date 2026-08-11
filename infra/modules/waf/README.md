# `waf`

A Web ACL associada ao ALB, com rate limit por IP e quatro grupos de regras gerenciadas da AWS.

## Recursos

| Arquivo | Recursos |
|---|---|
| `main.tf` | `aws_wafv2_web_acl`, `aws_wafv2_web_acl_association`, log group e `aws_wafv2_web_acl_logging_configuration` |

A ação padrão é permitir. O rate limit tem prioridade 0 por ser a regra mais barata de avaliar. Os grupos gerenciados entram por `for_each` sobre `managed_rule_groups`, cada um em modo de bloqueio ou de contagem conforme `count_only`.

Os logs redigem os headers `authorization` e `cookie`.

## Variáveis

| Variável | Tipo | Default | Descrição |
|---|---|---|---|
| `project` | `string` | obrigatório | Prefixo de nome e tag |
| `environment` | `string` | obrigatório | Ambiente, usado em nome e tag |
| `alb_arn` | `string` | obrigatório | Balanceador ao qual a Web ACL é associada |
| `managed_rule_groups` | `list(object)` | 4 grupos | Nome, prioridade e modo de cada grupo gerenciado |
| `rate_limit_per_5min` | `number` | `2000` | Requisições de um mesmo IP em 5 minutos antes do bloqueio |
| `enable_logging` | `bool` | `true` | Envia os logs da Web ACL para o CloudWatch |
| `log_retention_days` | `number` | `7` | Retenção do log group da WAF |

O default de `managed_rule_groups` sobe `AmazonIpReputationList` e `KnownBadInputsRuleSet` bloqueando, e `CommonRuleSet` e `SQLiRuleSet` apenas contando.

## Outputs

`web_acl_arn` e `web_acl_name`.
