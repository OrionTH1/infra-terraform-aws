# Módulo `network`

Provisiona a rede base do projeto: VPC, subnets públicas/privadas, roteamento, security groups e os VPC Endpoints que substituem o NAT Gateway. É a Fase 1 do roadmap descrito em [`ARCHITECTURE.md`](../../../ARCHITECTURE.md).

## O que este módulo cria

| Arquivo | Recursos | Responsabilidade |
|---|---|---|
| `vpc.tf` | `aws_vpc`, `aws_subnet` (public/private), `aws_internet_gateway` | A VPC em si e as subnets, uma por AZ definida em `public_subnet_cidrs`/`private_subnet_cidrs`. |
| `routes.tf` | `aws_route_table` (public/private), `aws_route_table_association` | Roteamento. A tabela pública tem rota `0.0.0.0/0` via IGW. A tabela privada **não tem nenhuma rota de saída** — só a rota `local` implícita da VPC. |
| `security_groups.tf` | `aws_security_group` + `aws_vpc_security_group_ingress_rule`/`egress_rule` | Os 3 security groups principais e as regras de tráfego entre eles (ver diagrama abaixo). |
| `vpc_endpoints.tf` | `data.aws_region`, `aws_vpc_endpoint` (Gateway + Interface), `aws_security_group.vpc_endpoints_sg` | Acesso da subnet privada a serviços AWS via PrivateLink, sem depender de internet/NAT. |
| `variables.tf` | — | Inputs do módulo. |
| `outputs.tf` | — | Valores expostos para outros módulos (`ecs`, `alb`, `rds`) consumirem. |

## Por que não tem NAT Gateway

A API deste projeto só responde `/api/health` — não faz chamadas de saída para a internet. Por isso, as subnets privadas ficam **100% isoladas de internet** (sem rota de saída) e o acesso a serviços AWS (ECR, CloudWatch Logs, Secrets Manager, S3) acontece via VPC Endpoints (PrivateLink), dentro da própria rede da AWS. Isso reduz a superfície de ataque e evita o custo/complexidade do NAT. Se no futuro a aplicação precisar chamar uma API de terceiros, essa decisão precisa ser revisitada — ver seção 1 do `ARCHITECTURE.md`.

### Gateway Endpoint vs. Interface Endpoint

- **Gateway Endpoint** (só existe para S3 e DynamoDB): não é uma ENI, é uma entrada na route table. Por isso é associado diretamente a `aws_route_table.private` via `route_table_ids`, não tem security group, e é gratuito.
- **Interface Endpoint** (ECR, CloudWatch Logs, Secrets Manager, etc.): cria uma ENI com IP privado em cada subnet listada em `subnet_ids`. Por ser uma ENI de verdade, tem security group (`vpc_endpoints_sg`, que só aceita tráfego do `ecs_sg` na porta 443) e é cobrado por hora/AZ + dados processados. `private_dns_enabled = true` faz o nome público do serviço (ex. `ecr.us-east-1.amazonaws.com`) resolver para o IP privado da ENI *quando consultado de dentro da VPC* — a aplicação não precisa saber disso, só continua chamando o hostname padrão do SDK/AWS CLI.

O `ecr.api` e o `ecr.dkr` são endpoints separados porque um `docker pull` usa os dois: `ecr.api` para autenticação/metadados, `ecr.dkr` para o protocolo do Docker registry em si (as layers, que fisicamente são blobs no S3 — por isso o endpoint do S3 também é necessário mesmo a aplicação nunca chamando S3 diretamente).

## Security Groups

```
allow_http (SG do ALB)                 ecs_sg                          rds_sg
  ingress 80/443 ← 0.0.0.0/0             ingress app_port ← allow_http    ingress 5432 ← ecs_sg
  egress  app_port → ecs_sg              egress  5432 → rds_sg

vpc_endpoints_sg
  ingress 443 ← ecs_sg
```

- `allow_http`: hoje representa o security group do ALB (o nome ficou do scaffold inicial — ao criar o módulo `alb`, considerar renomear para `alb_sg` para maior clareza, já que os outputs já expõem `alb_security_group_id`).
- `ecs_sg`: só aceita tráfego do ALB, na porta da aplicação (`var.app_port`); só sai para o RDS (5432) e para os VPC Endpoints (443).
- `rds_sg`: só aceita tráfego do `ecs_sg` na porta do Postgres (5432). Sem egress explícito — o RDS não precisa de saída (patches/backups são geridos pelo management plane da AWS, fora da VPC).

Nenhum SG tem regra `0.0.0.0/0` além do `allow_http` (que precisa aceitar tráfego público de entrada — é o único ponto de entrada da VPC).

## Inputs

| Nome | Tipo | Default | Descrição |
|---|---|---|---|
| `project` | `string` | — | Usado como prefixo em todos os nomes/tags. |
| `environment` | `string` | — | `dev`, `staging`, `prod`, etc. Usado em tags. |
| `vpc_cidr` | `string` | `10.0.0.0/16` | CIDR da VPC. |
| `public_subnet_cidrs` | `map(string)` | 2 AZs (`10.0.0.0/24`, `10.0.1.0/24`) | Uma entrada por AZ desejada; a chave é o nome da AZ. |
| `private_subnet_cidrs` | `map(string)` | 2 AZs (`10.0.10.0/24`, `10.0.11.0/24`) | Mesma lógica das públicas. Faixa numérica separada de propósito, para deixar espaço para novas subnets públicas sem precisar renumerar as privadas. |
| `app_port` | `number` | — (obrigatória) | Porta que o container da aplicação escuta. Usada nas regras de SG entre ALB e ECS — deve ser a mesma porta configurada na task definition do módulo `ecs`. |

## Outputs

Ver [`outputs.tf`](./outputs.tf) — todos com `description`. Resumo do que outros módulos vão consumir:

- `vpc_id`, `vpc_cidr_block`
- `public_subnet_ids` / `public_subnets_by_az` (o `alb` normalmente só precisa da lista; o mapa existe para quem precisar da associação por AZ)
- `private_subnet_ids` / `private_subnets_by_az` (o `ecs` e o `rds` consomem daqui)
- `public_route_table_id`, `private_route_table_id`
- `alb_security_group_id`, `ecs_security_group_id`, `rds_security_group_id`, `vpc_endpoints_security_group_id`

## Como usar

```hcl
module "network" {
  source = "../../modules/network"

  project     = var.project
  environment = var.environment
  app_port    = var.app_port
}
```

E, em outro módulo (ex. `ecs`):

```hcl
module "ecs" {
  source = "../../modules/ecs"

  vpc_id             = module.network.vpc_id
  private_subnet_ids = module.network.private_subnet_ids
  security_group_id  = module.network.ecs_security_group_id
  app_port           = var.app_port
}
```

## Desenvolvendo neste módulo

- **Adicionando uma subnet/AZ nova**: só adicionar uma entrada em `public_subnet_cidrs`/`private_subnet_cidrs` no `environments/<env>`, respeitando CIDRs que não se sobreponham. `for_each` cuida do resto (subnet, associação de rota, e os Interface Endpoints já cobrem a nova subnet automaticamente via `[for subnet in aws_subnet.private : subnet.id]`).
- **Adicionando um novo VPC Endpoint de serviço AWS** (ex. se o `rds` module vier a precisar de `rds` ou `monitoring`): adicionar o nome do serviço ao `toset([...])` em `aws_vpc_endpoint.interface` (`vpc_endpoints.tf`) — não precisa duplicar o resource.
- **Alterando a porta da aplicação**: mudar `var.app_port` no `environments/<env>`, não hardcode em nenhum `.tf` deste módulo. As regras de SG e a task definition (módulo `ecs`, quando existir) devem sempre referenciar essa mesma variável.
- **Antes de commitar**: `terraform fmt -recursive` e `terraform validate` (rodar a partir de `infra/environments/dev`, já que este módulo sozinho não tem `required_providers`).
- **Convenção de nomes de arquivo**: por assunto (`vpc.tf`, `routes.tf`, `security_groups.tf`, `vpc_endpoints.tf`), não por tipo de bloco Terraform. Ao crescer o módulo, prefira manter essa divisão em vez de voltar a um `main.tf` único.
