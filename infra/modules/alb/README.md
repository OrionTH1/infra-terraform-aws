# `alb`

O Application Load Balancer público, o listener e o target group onde o ECS registra as tasks. O health check aponta para `/api/v1/health` e não toca o banco.

## Recursos

| Arquivo | Recursos |
|---|---|
| `main.tf` | `aws_lb`, `aws_lb_target_group`, `aws_lb_listener` |

O target group usa `least_outstanding_requests` e `target_type = "ip"`, que é o exigido pelo Fargate com `awsvpc`. O health check roda a cada 30s, com 2 sucessos para ficar saudável e 3 falhas para sair.

O listener é HTTP na porta 80. O de HTTPS depende de um certificado ACM e de um domínio, que ainda não existem.

## Variáveis

| Variável | Tipo | Default | Descrição |
|---|---|---|---|
| `project` | `string` | obrigatório | Prefixo de nome e tag |
| `environment` | `string` | obrigatório | Ambiente, usado em nome e tag |
| `vpc_id` | `string` | obrigatório | VPC onde o target group é criado |
| `public_subnet_ids` | `list(string)` | obrigatório | Subnets públicas do balanceador |
| `alb_security_group_id` | `string` | obrigatório | Security group do ALB |
| `app_port` | `number` | obrigatório | Porta para onde o target group encaminha |
| `deregistration_delay_seconds` | `number` | `30` | Tempo que um target fica drenando antes de sair |
| `enable_deletion_protection` | `bool` | `false` | Bloqueia a deleção do balanceador |

## Outputs

`alb_arn`, `alb_dns_name`, `alb_zone_id`, `target_group_arn`, `listener_arn`, e os sufixos `alb_arn_suffix` e `target_group_arn_suffix`, que o autoscaling e os alarmes consomem como dimensão de métrica.
