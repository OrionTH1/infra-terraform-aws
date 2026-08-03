# Roteiro de validação end-to-end

Este documento existe para ser executado **uma vez**, do zero, contra uma conta AWS real — e para que qualquer pessoa (ou agente) sem contexto prévio consiga executá-lo e saber julgar se passou ou falhou.

---

## 1. Por que este teste é necessário

O projeto tem oito fases (ver `ARCHITECTURE.md` seção 10). Elas **não** foram validadas no mesmo grau:

| Fase | Estado | Como foi verificado |
|---|---|---|
| 1. Rede | ✅ testada na AWS | `curl` atravessando ALB → ECS em subnet privada |
| 2. Compute (ECS + ALB) | ✅ testada na AWS | `200 OK` pelo ALB; autoscaling observado sob carga real (`hey`) |
| 3. Banco (Aurora) | ✅ testada na AWS | cluster criado, writer + reader |
| 4. API ↔ banco | ✅ testada na AWS | health check executando `SELECT 1` de dentro da task |
| 5. HTTPS + domínio | ⏸️ pausada | aguardando registro de domínio |
| 6. CI/CD | ❌ **nunca executou** | apenas `terraform validate` / `plan` |
| 7. Observabilidade | ❌ **nunca aplicada** | apenas `validate` / `plan` |
| 8. Hardening | ❌ **nunca aplicada** | `validate` / `plan` + Checkov local |

Ou seja: **metade do projeto nunca tocou a AWS**. `terraform validate` prova que o HCL é sintaticamente válido e que as referências existem — não prova que a AWS aceita a configuração, que as permissões IAM bastam, que os alarmes recebem dados, nem que os workflows conseguem assumir as roles.

Além disso, três mudanças recentes alteram comportamento já testado e precisam de re-validação:

1. **`deployment_circuit_breaker` foi habilitado.** Antes, um deploy com imagem inexistente ficava retentando até a imagem aparecer — foi assim que o teste anterior se recuperou sozinho. Agora o ECS **desiste** e marca o deployment como `FAILED`. Isso muda a ordem correta de bootstrap (ver seção 4).
2. **`lifecycle.ignore_changes = [task_definition]` no ECS service.** Deploys de aplicação passaram a acontecer fora do Terraform, via `register-task-definition`. Nunca foi exercitado.
3. **`permissions_boundary` + condição `aws:RequestedRegion` na role de apply do CI.** Se alguma permissão faltar, o sintoma aparece só quando o workflow rodar — não no `apply` local, que usa as credenciais do seu usuário.

---

## 2. Contexto mínimo do projeto

Para quem chega sem histórico:

- **App**: API Express trivial (`backend/`), um endpoint `GET /api/v1/health` que executa `SELECT 1` no Aurora e devolve `200` (ou `503` se o banco não responder).
- **Infra**: `infra/environments/dev` compõe oito módulos em `infra/modules/` (network, alb, ecr, ecs, rds, observability, waf, github_oidc).
- **Região**: `us-east-1`. **Todos** os comandos abaixo dependem disso.
- **Remote state**: bucket S3 `ecs-portfolio-tfstate-b41d7649`, key `dev/terraform.tfstate`, lock nativo (`use_lockfile`). O bucket **não** é gerenciado por Terraform — ver `infra/README.md`.

Nomes de recursos (previsíveis, derivados de `${project}-${environment}`):

| Recurso | Nome |
|---|---|
| Cluster ECS | `ecs-portfolio-dev` |
| Service ECS | `ecs-portfolio-dev-backend` |
| Task definition (family) | `ecs-portfolio-dev-backend` |
| Repositório ECR | `ecs-portfolio-dev-backend` |
| Log group da app | `/ecs/ecs-portfolio-dev` |
| Dashboard | `ecs-portfolio-dev` |
| SNS de alarmes | `ecs-portfolio-dev-alarms` |
| Web ACL (WAF) | `ecs-portfolio-dev` |

---

## 3. Pré-requisitos

```bash
aws sts get-caller-identity          # precisa retornar uma identidade válida
terraform version                    # ~> 1.15
docker version                       # daemon rodando
aws s3api head-bucket --bucket ecs-portfolio-tfstate-b41d7649   # bucket do state precisa existir
```

Se o bucket não existir, siga `infra/README.md` antes de continuar.

> **Custo.** Container Insights (~$8-11/mês se ficar 24/7), 4 Interface VPC Endpoints (~$0,01/h cada por AZ), WAF (~$9/mês, rateado por hora), Aurora e Fargate. Como tudo é cobrado pro-rata, algumas horas de teste custam poucos centavos — **desde que você execute a seção 9 (destroy) ao terminar.**

---

## 4. Ordem de aplicação (a parte que tem armadilha)

O `image_tag` tem default `"bootstrap"`, uma tag que ainda não existe no ECR. Com o circuit breaker ligado, aplicar tudo de uma vez produz um serviço com deployment `FAILED` e **sem versão anterior para onde voltar**. A ordem correta cria o registry primeiro:

### 4.1. Criar apenas o ECR

```bash
cd infra/environments/dev
terraform init
terraform apply -target=module.ecr
```

Espere `Apply complete!`. Um aviso sobre `-target` é normal e esperado aqui.

### 4.2. Publicar a imagem de bootstrap

```bash
REPO_URL=$(terraform output -raw ecr_repository_url)

aws ecr get-login-password --region us-east-1 \
  | docker login --username AWS --password-stdin "${REPO_URL%/*}"

docker build -t "${REPO_URL}:bootstrap" ../../../backend
docker push "${REPO_URL}:bootstrap"
```

### 4.3. Aplicar o restante

```bash
terraform apply
```

Leva ~10-15 minutos (o Aurora é o gargalo). Ao final, guarde os outputs:

```bash
terraform output
```

**Critério de aprovação**: `Apply complete!` sem erro, e `terraform plan` logo em seguida reporta `No changes`.

---

## 5. Validar Fases 1-4 (regressão)

Isto já passou antes; aqui só confirmamos que nada quebrou.

```bash
# Espera o serviço estabilizar (running == desired). Ctrl+C se passar de ~5 min.
until [ "$(aws ecs describe-services --cluster ecs-portfolio-dev \
  --services ecs-portfolio-dev-backend --region us-east-1 \
  --query 'services[0].deployments[?status==`PRIMARY`].runningCount | [0]' --output text)" = "2" ]; do
  sleep 10; echo "aguardando..."
done

curl -i "http://$(terraform output -raw alb_dns_name)/api/v1/health"
```

**Critério de aprovação**: `HTTP/1.1 200 OK` com corpo `OK`.

Se vier **503**: a API subiu mas não alcança o Aurora — investigue security groups e o secret. Se **não responder**: as tasks não ficaram saudáveis; ver seção 10.

---

## 6. Validar Fase 7 — Observabilidade

### 6.1. Logs estruturados chegando

Esta é a primeira vez que o `pino` roda no ECS com o driver `awslogs`. O metric filter depende do formato exato.

```bash
STREAM=$(aws logs describe-log-streams --log-group-name /ecs/ecs-portfolio-dev \
  --region us-east-1 --order-by LastEventTime --descending --max-items 1 \
  --query 'logStreams[0].logStreamName' --output text)

aws logs get-log-events --log-group-name /ecs/ecs-portfolio-dev \
  --log-stream-name "$STREAM" --region us-east-1 --limit 5 --start-from-head \
  --query 'events[].message' --output text
```

**Critério de aprovação**: linhas em JSON contendo `"level":30` e `"msg":"Server started"`. Se aparecer texto puro em vez de JSON, o metric filter `{ $.level >= 50 }` nunca vai casar e o alarme de erros da aplicação é inútil.

### 6.2. Alarmes existem e saíram de INSUFFICIENT_DATA

```bash
aws cloudwatch describe-alarms --region us-east-1 \
  --alarm-name-prefix ecs-portfolio-dev \
  --query 'MetricAlarms[].{nome:AlarmName,estado:StateValue}' --output table
```

**Critério de aprovação**: 9 alarmes listados. Logo após o apply é normal vários estarem em `INSUFFICIENT_DATA`; **depois de ~10 minutos**, os que dependem de métricas contínuas (`unhealthy-hosts`, `healthy-hosts-low`, `ecs-cpu-high`, `ecs-memory-high`, `ecs-running-tasks-low`) devem estar em `OK`.

> Os alarmes de 5xx e latência podem permanecer em `INSUFFICIENT_DATA` sem tráfego — isso é esperado e está explicado em `ARCHITECTURE.md` seção 6.2 (métricas de erro do ALB só são publicadas quando não são zero).

### 6.3. Forçar um alarme a disparar (teste real de ponta a ponta)

Este é o único teste que prova que o caminho métrica → alarme → SNS → e-mail funciona.

**Pré-requisito**: aplicar com `-var="alarm_email=seu@email.com"` e **clicar no link de confirmação** que a AWS envia. Sem confirmar, nada chega.

Derrube as tasks para disparar `ecs-running-tasks-low` e `alb-healthy-hosts-low`:

```bash
aws ecs update-service --cluster ecs-portfolio-dev \
  --service ecs-portfolio-dev-backend --desired-count 0 --region us-east-1
```

Aguarde ~5 minutos e verifique:

```bash
aws cloudwatch describe-alarms --region us-east-1 \
  --alarm-names ecs-portfolio-dev-alb-healthy-hosts-low ecs-portfolio-dev-ecs-running-tasks-low \
  --query 'MetricAlarms[].{nome:AlarmName,estado:StateValue,motivo:StateReason}'
```

**Critério de aprovação**: pelo menos um em `ALARM`, e um e-mail recebido.

Restaure e confirme que volta a `OK` (o `ok_actions` também notifica):

```bash
aws ecs update-service --cluster ecs-portfolio-dev \
  --service ecs-portfolio-dev-backend --desired-count 2 --region us-east-1
```

> Nota: o autoscaling gerencia `desired_count` e pode reverter esse valor sozinho. Se a alteração não "colar", é o comportamento esperado — o alarme dispara do mesmo jeito durante a janela em que as tasks estiveram fora.

### 6.4. Dashboard

```bash
terraform output -raw dashboard_url
```

Abra no navegador. **Critério de aprovação**: 9 widgets renderizando, sem "no data" em ALB/ECS (Aurora pode estar vazio se o cluster tiver pausado).

---

## 7. Validar Fase 8 — Hardening

### 7.1. WAF está associado e avaliando

```bash
aws wafv2 list-web-acls --scope REGIONAL --region us-east-1 \
  --query 'WebACLs[?Name==`ecs-portfolio-dev`]'

# Gere algum tráfego antes desta consulta (ex.: o curl da seção 5)
aws cloudwatch get-metric-statistics --region us-east-1 \
  --namespace AWS/WAFV2 --metric-name AllowedRequests \
  --dimensions Name=WebACL,Value=ecs-portfolio-dev Name=Rule,Value=ALL Name=Region,Value=us-east-1 \
  --start-time "$(date -u -d '30 minutes ago' +%Y-%m-%dT%H:%M:%S)" \
  --end-time "$(date -u +%Y-%m-%dT%H:%M:%S)" \
  --period 300 --statistics Sum --output table
```

**Critério de aprovação**: a Web ACL existe e `AllowedRequests` tem datapoints — prova que o tráfego está passando **através** do WAF, não ao lado dele.

Teste que um ataque óbvio é registrado (as regras SQLi/Common estão em modo `count`, então **não** vai bloquear — apenas contar):

```bash
curl -s -o /dev/null -w "%{http_code}\n" \
  "http://$(terraform output -raw alb_dns_name)/api/v1/health?id=1'%20OR%20'1'='1"
```

**Critério de aprovação**: retorna `200` (esperado — está em `count`), e após alguns minutos o CloudWatch mostra contagem na regra `SQLiRuleSet`. Bloquear exigiria virar `count_only = false` — ver `ARCHITECTURE.md` seção 4.1.

### 7.2. VPC Flow Logs

```bash
aws logs describe-log-streams --log-group-name /aws/vpc/ecs-portfolio-dev \
  --region us-east-1 --max-items 3 --query 'logStreams[].logStreamName'
```

**Critério de aprovação**: pelo menos um stream. Como o `traffic_type` é `REJECT`, pode demorar (só registra tráfego recusado) — a ausência de streams aqui não é falha grave.

### 7.3. Permissions boundary anexado

```bash
aws iam get-role --role-name ecs-portfolio-dev-gha-apply \
  --query 'Role.PermissionsBoundary'
```

**Critério de aprovação**: retorna o ARN da policy `ecs-portfolio-dev-gha-apply-boundary`.

---

## 8. Validar Fase 6 — CI/CD

Esta é a fase com maior risco: nada aqui nunca rodou.

### 8.1. Configuração manual no GitHub (obrigatória)

1. **Environment**: `Settings → Environments → New environment` → nome exatamente **`production`** → habilitar **Required reviewers** e adicionar-se. O nome precisa bater com `var.github_environment`, senão a trust policy do OIDC não confere e o apply falha com `Not authorized to perform sts:AssumeRoleWithWebIdentity`.
2. **Repository Variables** (`Settings → Secrets and variables → Actions → aba Variables`):

```bash
terraform output -raw gha_plan_role_arn     # → AWS_PLAN_ROLE_ARN
terraform output -raw gha_apply_role_arn    # → AWS_APPLY_ROLE_ARN
terraform output -raw gha_deploy_role_arn   # → AWS_DEPLOY_ROLE_ARN
```

São **Variables**, não Secrets — ARN de role não é sensível.

### 8.2. Testar `terraform-plan.yml` (PR)

```bash
git checkout -b test/ci-validation
# mude algo inócuo, ex. a descrição de uma variável em infra/modules/network/variables.tf
git commit -am "test: validar workflow de plan"
git push -u origin test/ci-validation
# abra o PR pela UI do GitHub
```

**Critérios de aprovação**:
- Job `security-scan` passa e a aba **Security → Code scanning** mostra resultados do Checkov.
- Job `plan` comenta o plano no PR.
- O comentário **não** contém o endpoint do banco nem o ARN do secret (devem aparecer como `(sensitive value)`) — é a validação da correção de vazamento.
- Um segundo push no mesmo PR **atualiza** o comentário existente em vez de criar outro.

### 8.3. Testar `terraform-apply.yml` (merge)

Faça merge do PR. **Critérios de aprovação**:
- O workflow inicia e **pausa** aguardando aprovação (prova que o gate funciona).
- Após aprovar, o `apply` conclui sem erro de permissão — é aqui que o permissions boundary e a condição de região são realmente testados. Um erro `AccessDenied` neste ponto significa que falta permissão no boundary ou na policy da apply-role.

### 8.4. Testar `api-deploy.yml`

```bash
git checkout main && git pull
# mude algo em backend/, ex. uma mensagem de log em backend/src/app.ts
git commit -am "test: validar workflow de deploy"
git push
```

**Critérios de aprovação**:
- Trivy escaneia a imagem e o resultado aparece no Security tab (categoria `trivy-image`).
- A imagem é enviada ao ECR com a tag do commit SHA.
- O ECS recebe uma **revisão nova** da task definition e estabiliza:

```bash
aws ecs describe-services --cluster ecs-portfolio-dev --services ecs-portfolio-dev-backend \
  --region us-east-1 --query 'services[0].taskDefinition'
```

Deve apontar para uma revisão maior que a criada pelo Terraform.

- **O teste decisivo**: rode `terraform plan` localmente depois disso.

```bash
cd infra/environments/dev && terraform plan
```

**Critério de aprovação**: `No changes`. Se o Terraform quiser reverter `task_definition` para a revisão antiga, o `lifecycle.ignore_changes` não está funcionando e todo `apply` de infra desfaria o último deploy de aplicação.

---

## 9. Destruir (não pule)

```bash
cd infra/environments/dev
terraform destroy
```

Depois, confirme que nada sobrou cobrando:

```bash
aws ecs list-clusters --region us-east-1 --query 'clusterArns'
aws elbv2 describe-load-balancers --region us-east-1 --query 'LoadBalancers[].LoadBalancerName'
aws rds describe-db-clusters --region us-east-1 --query 'DBClusters[].DBClusterIdentifier'
aws ec2 describe-vpc-endpoints --region us-east-1 --query 'VpcEndpoints[].ServiceName'
```

Todos devem voltar vazios. **O bucket do state permanece** — é intencional, ele não é gerenciado pelo Terraform.

> Uma subscription SNS não confirmada não é removida pelo `destroy` (some sozinha em ~3 dias). Comportamento conhecido, documentado em `infra/README.md`.

---

## 10. Problemas conhecidos e como diagnosticar

| Sintoma | Causa provável | Ação |
|---|---|---|
| `Error acquiring the state lock` | Outro `plan`/`apply` rodando, ou lock órfão de um processo interrompido | Confirme que nada está rodando, então `terraform force-unlock <ID>` |
| Tasks em `PENDING` eternamente, `CannotPullContainerError` | Imagem não existe no ECR, ou egress do ECS para os VPC endpoints/S3 bloqueado | Confira se a tag existe no ECR; ver `network/security_groups.tf` |
| Deployment `FAILED` sem rollback | Circuit breaker desistiu e não há versão anterior — típico se a seção 4 foi feita fora de ordem | Envie a imagem e force: `aws ecs update-service --force-new-deployment` |
| Health check `503` | API no ar, Aurora inacessível | Verifique o SG do RDS e se o secret foi injetado na task definition |
| Workflow: `Not authorized to perform sts:AssumeRoleWithWebIdentity` | Environment `production` não criado, ou nome divergente do `var.github_environment` | Ver seção 8.1 |
| `apply` do CI falha com `AccessDenied` | Permissão faltando na apply-role ou barrada pelo permissions boundary | Leia a mensagem: ela nomeia a ação negada; ajuste `iam_apply_role.tf` ou `permissions_boundary.tf` |
| Alarme preso em `INSUFFICIENT_DATA` | Métrica sem datapoints (normal sem tráfego para 5xx/latência) | Ver `ARCHITECTURE.md` seção 6.2 antes de tratar como bug |
| `destroy` falha: `ECR repository not empty` | `force_delete` não aplicado no state atual | Rode `terraform apply` uma vez e destrua de novo |

---

## 11. Resumo do que este roteiro prova

Ao final, com todos os critérios atendidos, estará demonstrado que:

- a rede isolada funciona sem NAT (tasks em subnet privada puxam imagem e escrevem logs via VPC Endpoints);
- o caminho internet → ALB → ECS → Aurora responde de ponta a ponta;
- alarmes recebem dados reais e notificam de verdade — não são decorativos;
- o WAF está no caminho do tráfego;
- CI/CD autentica por OIDC sem nenhuma credencial estática, respeita o gate de aprovação, e o deploy de aplicação convive com o Terraform sem que um desfaça o outro.

O que continua **não** validado após este roteiro: a Fase 5 (HTTPS/domínio), pausada até haver um domínio registrado.
