# `ecs`

O cluster Fargate, a task definition, o service e o autoscaling. Também cria as duas roles de IAM da task e o log group para onde o driver `awslogs` envia o stdout do container.

## Recursos

| Arquivo | Recursos |
|---|---|
| `cluster.tf` | `aws_ecs_cluster` com Container Insights |
| `task_definition.tf` | `aws_ecs_task_definition` com um container, variáveis de ambiente, segredos e log configuration |
| `service.tf` | `aws_ecs_service` com circuit breaker, grace period e registro no target group |
| `autoscaling.tf` | `aws_appautoscaling_target` e `aws_appautoscaling_policy` de target tracking |
| `iam.tf` | Execution role e task role, mais as policies de pull no ECR e leitura do segredo |
| `logs.tf` | `aws_cloudwatch_log_group` e a policy que permite escrever nele |

A execution role é do agente do ECS: puxa a imagem, escreve log e busca o segredo antes do container subir. A task role é do código da aplicação e hoje não tem policy nenhuma anexada.

O service tem `lifecycle.ignore_changes` em `desired_count` e `task_definition`, porque o autoscaling controla o primeiro e o workflow de deploy controla o segundo.

## Variáveis

| Variável | Tipo | Default | Descrição |
|---|---|---|---|
| `project`, `environment` | `string` | obrigatório | Prefixo de nome e tag |
| `app_port` | `number` | obrigatório | Porta que o container escuta |
| `image_tag` | `string` | obrigatório | Tag da imagem de bootstrap |
| `ecr_repository_url` / `ecr_repository_arn` | `string` | obrigatório | Repositório da imagem e escopo da policy de pull |
| `private_subnet_ids` | `list(string)` | obrigatório | Subnets onde as tasks rodam |
| `ecs_security_group_id` | `string` | obrigatório | Security group das tasks |
| `target_group_arn` | `string` | obrigatório | Target group onde o service registra |
| `alb_listener_arn` | `string` | obrigatório | Usado só como dependência de ordem |
| `alb_arn_suffix` / `target_group_arn_suffix` | `string` | obrigatório | Dimensões da métrica do autoscaling |
| `rds_master_secret_arn` | `string` | obrigatório | Segredo injetado como `DB_USERNAME` e `DB_PASSWORD` |
| `db_host`, `db_reader_host`, `db_port`, `db_name` | `string` e `number` | obrigatório | Conexão do banco, passada como variável de ambiente |
| `desired_count` | `number` | `2` | Contagem inicial de tasks |
| `min_capacity` / `max_capacity` | `number` | `2` / `10` | Limites do autoscaling |
| `requests_per_target_target_value` | `number` | `1000` | Alvo de requisições por minuto por task |
| `task_cpu` / `task_memory` | `string` | `256` / `512` | Combinação de CPU e memória do Fargate |
| `health_check_grace_period_seconds` | `number` | `120` | Tempo antes do scheduler julgar uma task nova |
| `enable_deployment_circuit_breaker` | `bool` | `true` | Detecta deploy falho e volta para o anterior |
| `container_insights` | `string` | `enabled` | `disabled`, `enabled` ou `enhanced` |
| `log_retention_days` | `number` | `14` | Retenção do log group da aplicação |

## Outputs

`cluster_arn`, `cluster_name`, `service_name`, `service_id`, `log_group_name`, `task_definition_family`, `container_name`, `execution_role_arn` e `task_role_arn`.
