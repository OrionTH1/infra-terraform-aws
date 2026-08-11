# `observability`

Os alarmes, o tópico SNS onde todos publicam, o dashboard, o metric filter de erros da aplicação e as regras de EventBridge para falhas que não têm métrica.

## Recursos

| Arquivo | Recursos |
|---|---|
| `sns.tf` | `aws_sns_topic` criptografado, assinatura de e-mail opcional e a topic policy |
| `alarms_alb.tf` | Alarmes de host não saudável, capacidade perdida, taxa de 5xx e latência p99 |
| `alarms_ecs.tf` | Alarmes de CPU, memória e contagem de tasks rodando |
| `alarms_rds.tf` | Alarme de conexões no banco |
| `logs.tf` | Metric filter de erro, o alarme sobre ele e três queries salvas do Logs Insights |
| `events.tf` | Regras de deploy falho e falha de posicionamento de task, com alvo no SNS |
| `dashboard.tf` | `aws_cloudwatch_dashboard` |

São nove alarmes no total, todos com `alarm_actions` e `ok_actions` no mesmo tópico. A taxa de erro usa metric math sobre `RequestCount` e as duas métricas de 5xx, com guarda de volume mínimo.

O alarme de contagem de tasks depende do Container Insights e some por `count` quando ele está desligado.

## Variáveis

| Variável | Tipo | Default | Descrição |
|---|---|---|---|
| `project`, `environment` | `string` | obrigatório | Prefixo de nome e tag |
| `alarm_email` | `string` | `""` | Destinatário da assinatura SNS. Vazio não cria assinatura |
| `alb_arn_suffix` / `target_group_arn_suffix` | `string` | obrigatório | Dimensões das métricas do ALB |
| `ecs_cluster_name`, `ecs_service_name`, `ecs_service_arn` | `string` | obrigatório | Alvo dos alarmes e das regras de evento |
| `log_group_name` | `string` | obrigatório | Log group onde o metric filter roda |
| `db_cluster_identifier` | `string` | obrigatório | Dimensão do alarme do Aurora |
| `container_insights_enabled` | `bool` | `true` | Controla a criação do alarme de tasks rodando |
| `ecs_min_running_tasks` | `number` | `2` | Piso de tasks e de hosts saudáveis |
| `error_rate_threshold_percent` | `number` | `5` | Percentual de 5xx que dispara |
| `error_rate_min_requests` | `number` | `30` | Volume mínimo para a taxa valer |
| `latency_p99_threshold_seconds` | `number` | `5` | Teto de latência p99 |
| `cpu_threshold_percent` / `memory_threshold_percent` | `number` | `85` / `80` | Tetos de CPU e memória |
| `app_error_threshold` | `number` | `10` | Linhas de erro em 5 minutos |
| `db_max_connections` | `number` | `50` | Teto de conexões no Aurora |

## Outputs

`alarm_topic_arn`, `dashboard_name`, `dashboard_url` e `stable_alarm_arns`, que lista os alarmes que não oscilam em ambiente ocioso.
