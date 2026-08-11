# `rds`

O cluster Aurora Serverless v2 em Postgres, com subnet group nas subnets privadas, parameter group de logging e as instâncias.

## Recursos

| Arquivo | Recursos |
|---|---|
| `cluster.tf` | `aws_rds_cluster`, e um data source que resolve a versão corrente do engine |
| `instances.tf` | `aws_rds_cluster_instance`, uma por `instance_count` |
| `subnet_group.tf` | `aws_db_subnet_group` |
| `parameter_group.tf` | `aws_rds_cluster_parameter_group` |

A senha do usuário master é gerada e rotacionada pelo RDS por `manage_master_user_password`, então ela nunca aparece em variável nem no state. A primeira instância é o writer e as demais são readers que o Aurora pode promover.

## Variáveis

| Variável | Tipo | Default | Descrição |
|---|---|---|---|
| `project`, `environment` | `string` | obrigatório | Prefixo de nome e tag |
| `private_subnet_ids` | `list(string)` | obrigatório | Subnets do subnet group, em ao menos 2 AZs |
| `rds_security_group_id` | `string` | obrigatório | Security group do cluster |
| `database_name` | `string` | `appdb` | Banco criado na inicialização |
| `master_username` | `string` | `dbadmin` | Usuário master |
| `instance_count` | `number` | `2` | Quantidade de instâncias do cluster |
| `min_capacity_acu` / `max_capacity_acu` | `number` | `0.5` / `4` | Faixa de ACU por instância |
| `backup_retention_days` | `number` | `7` | Retenção de backup automático |
| `deletion_protection` | `bool` | `false` | Bloqueia a deleção do cluster |
| `skip_final_snapshot` | `bool` | `true` | Pula o snapshot final no destroy |
| `log_statement` | `string` | `ddl` | Quais statements o Postgres registra |
| `log_min_duration_statement_ms` | `string` | `1000` | Registra statement mais lento que isso |
| `enabled_log_exports` | `list(string)` | `["postgresql"]` | Logs exportados para o CloudWatch |

## Outputs

`cluster_identifier`, `cluster_endpoint` (writer), `cluster_reader_endpoint`, `cluster_port`, `database_name` e `master_user_secret_arn`.
