# `network`

A rede base do projeto: VPC, subnets em duas zonas de disponibilidade, roteamento, security groups e os VPC endpoints que substituem o NAT Gateway. A tabela de rotas privada não tem saída para internet, só a rota local da VPC.

## Recursos

| Arquivo | Recursos |
|---|---|
| `vpc.tf` | `aws_vpc`, `aws_subnet` (públicas e privadas), `aws_internet_gateway`, `aws_default_security_group` |
| `routes.tf` | `aws_route_table` pública e privada, `aws_route_table_association` |
| `security_groups.tf` | `aws_security_group` para ALB, ECS e RDS, mais as regras de ingress e egress entre eles |
| `vpc_endpoints.tf` | `aws_vpc_endpoint` gateway do S3, quatro interface endpoints, e o security group deles |
| `flow_logs.tf` | `aws_flow_log`, log group e a role que o serviço assume para escrever |

Os quatro interface endpoints são `ecr.api`, `ecr.dkr`, `logs` e `secretsmanager`, todos com `private_dns_enabled`.

## Variáveis

| Variável | Tipo | Default | Descrição |
|---|---|---|---|
| `project` | `string` | obrigatório | Prefixo de nome e tag |
| `environment` | `string` | obrigatório | Ambiente, usado em nome e tag |
| `app_port` | `number` | obrigatório | Porta da aplicação, usada nas regras de security group |
| `vpc_cidr` | `string` | `10.0.0.0/16` | CIDR da VPC |
| `public_subnet_cidrs` | `map(string)` | duas AZs | CIDR por AZ das subnets públicas |
| `private_subnet_cidrs` | `map(string)` | duas AZs | CIDR por AZ das subnets privadas |
| `enable_flow_logs` | `bool` | `true` | Liga os VPC flow logs |
| `flow_logs_traffic_type` | `string` | `REJECT` | Que tráfego registrar |
| `flow_logs_retention_days` | `number` | `14` | Retenção do log group dos flow logs |

## Outputs

`vpc_id`, `vpc_cidr_block`, `public_subnet_ids`, `private_subnet_ids`, `public_subnets_by_az`, `private_subnets_by_az`, `public_route_table_id`, `private_route_table_id`, e os quatro security groups: `alb_security_group_id`, `ecs_security_group_id`, `rds_security_group_id`, `vpc_endpoints_security_group_id`.
