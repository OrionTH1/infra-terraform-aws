# Plano — Simulador Visual da Infra (portfólio)

## 1. Objetivo

Complementar o `ecs-terraform-infra` com um site interativo que **explica visualmente** como a infra se comporta sob carga — sem nunca dar `terraform apply` em produção. Serve para apresentação (entrevistas, README, demo gravada), não como ambiente de execução real.

A narrativa de portfólio fica em duas camadas:
1. "Eu construí essa infra AWS via Terraform" (este repo).
2. "E construí uma ferramenta pra você *ver* as decisões de arquitetura funcionando, sem eu precisar manter a AWS rodando 24/7" (o simulador).

Isso é mais memorável do que só mostrar código Terraform, e é coerente com o espírito do projeto (a API é um "canário" trivial — a engenharia está na infra e em como ela é comunicada).

## 2. Escopo — o que é simulado, o que é real

**100% client-side, zero custo, zero AWS.** Nenhum request do simulador toca infraestrutura real. Todo o comportamento (distribuição de carga, scaling, WAF) é uma simulação matemática no navegador, mas **calibrada com os números reais deste repo** para ser defensável:

| Mecanismo simulado | Valor usado (extraído do `ARCHITECTURE.md`) |
|---|---|
| Auto Scaling do ECS Service | reage a `ALBRequestCountPerTarget` (não CPU) |
| WAF rate limit por IP | 2000 req / 5 min → bloqueia |
| WAF `AmazonIpReputationList`, `KnownBadInputsRuleSet` | bloqueia |
| WAF `CommonRuleSet`, `SQLiRuleSet` | modo `count` (não bloqueia, só loga) |
| Health check do Target Group | grace period antes de task virar "healthy" |
| Desired count mínimo | 2 tasks (HA) |

Isso evita o pior risco do projeto: simular números fictícios que não batem com a infra real do repo, o que mina a credibilidade em vez de reforçá-la.

## 3. Stack técnica sugerida

- **React + TypeScript + Vite** — SPA estática, deploy grátis (Vercel/Netlify/GitHub Pages).
- **`reactflow`** (React Flow) para o canvas de nodes/edges — já resolve drag, zoom, conexão de portas, edges animadas. É o que torna o screenshot de referência viável sem reinventar um motor de canvas do zero.
- **Zustand** (ou Context simples) para o estado da simulação.
- **Framer Motion** ou CSS para os "pulsos" de request viajando pelas edges.
- Sem backend, sem banco — todo o "tick" da simulação roda num loop `requestAnimationFrame`/`setInterval` no cliente.

## 4. Modelo da simulação

### 4.1 Cards de infra (fixos, não-editáveis quanto à topologia)
ALB → ECS Service (N tasks) → (Aurora, opcional/decorativo). Posição arrastável, mas conexões entre eles são fixas — reflete a arquitetura real, o usuário não pode "reconectar o RDS no ALB".

**Único ponto de entrada externo: o ALB.** É o único card com uma porta de input onde cards de interação podem plugar — reforça visualmente que é assim que a app real é exposta (subnets privadas sem rota de internet, tudo entra pelo ALB).

### 4.2 Cards de interação (criados pelo usuário, parametrizáveis)
- **User**: RPS, número de usuários simultâneos, padrão de tráfego (constante, rampa, burst).
- **Attacker**: RPS (ex.: 5000), número de IPs de origem (1 IP martelando vs. IPs distribuídos — isso importa porque o rate limit do WAF é *por IP*, então um attacker com 1 IP só sofre rate limit dele mesmo; com IPs distribuídos, o simulador deveria deixar isso visível como trade-off educativo).

### 4.3 Motor de simulação (tick loop)
1. Soma o RPS de todos os cards de interação conectados ao ALB.
2. Passa pelo WAF: aplica rate limit por IP (2000/5min) e as regras em modo block; tráfego bloqueado nunca chega ao ALB de fato — vira animação de "descartado" com contagem de bloqueios.
3. ALB distribui o tráfego restante entre as tasks ECS saudáveis (round-robin ou least-outstanding-requests, igual ao comportamento real do Target Group).
4. Cada task acumula `ALBRequestCountPerTarget`; se ultrapassar o threshold simulado por tempo suficiente, dispara scale-out (+1 task), que entra em estado "provisioning" → health check grace period → "healthy" → só então recebe tráfego.
5. Scale-in simétrico com cooldown, para não oscilar (flapping) visualmente.

## 5. Cenários pré-configurados (para a demo)
1. **Tráfego normal**: 3 users, RPS baixo, mostra distribuição round-robin simples, sem scaling.
2. **Pico de tráfego**: 3 users escalando RPS até estourar o threshold → autoscaling dispara → nova task fica healthy → ALB redistribui.
3. **Ataque DDoS**: attacker a 5000 RPS de 1 IP → WAF rate limit dispara em poucos segundos → maioria das requests é descartada antes do ALB, o serviço nem percebe o pico.
4. **Ataque distribuído** (bônus, mais avançado): attacker simula múltiplos IPs para mostrar por que rate limit por IP não é bala de prata sozinho — abre gancho pra falar de `AmazonIpReputationList` como camada complementar.

## 6. Painel de métricas (live)
- RPS total de entrada vs. RPS que chega às tasks (mostra o que o WAF descartou).
- Nº de tasks rodando / healthy / provisioning.
- Requests por task (prova visual da distribuição do ALB).
- Contador de requests bloqueadas pelo WAF, por regra.
- Latência simulada (sobe visivelmente durante o intervalo entre "threshold estourado" e "nova task healthy" — é o ponto pedagógico mais valioso: scaling não é instantâneo).

## 7. Roadmap e estimativa (part-time, solo)

| Fase | Entrega | Estimativa |
|---|---|---|
| 1. MVP canvas | Cards de infra fixos (ALB + ECS) + 1 card User conectável + animação de request simples, sem scaling | 3-5 dias |
| 2. Autoscaling | Lógica de threshold/scale-out/scale-in com grace period e cooldown, visual de task nova ficando healthy | 4-6 dias |
| 3. WAF + Attacker | Card Attacker, rate limit por IP, bloqueio visual, contadores | 3-4 dias |
| 4. Painel de métricas + cenários pré-configurados (botões "rodar cenário X") | 3-4 dias |
| 5. Polish visual (aesthetics, dark mode, tooltips explicativos tipo o da referência, responsividade) | 3-5 dias |
| 6. Deploy + README + gravação de demo (GIF/vídeo curto para o portfólio) | 1-2 dias |

**Total realista: ~3 a 4 semanas de noites/fins de semana.** Um MVP apresentável (fases 1-3) sai em ~2 semanas se o tempo for mais apertado.

## 8. Riscos / armadilhas a evitar
- **Números inventados**: sempre calibrar com os valores reais do `ARCHITECTURE.md` (2000 req/5min, não CPU-based scaling, etc.) — é o que dá credibilidade em entrevista.
- **Simplificar demais o timing**: se scaling e health check forem instantâneos na simulação, perde-se o ponto pedagógico mais importante (auto scaling tem latência real).
- **Escopo inflando**: resistir à tentação de simular Aurora/RDS ou HTTPS/DNS — o valor está em ALB → ECS → WAF, que é o que tem uma história visual clara de "carga chegando e sendo distribuída/bloqueada".

## 9. Deploy
Site estático em Vercel ou GitHub Pages, sem custo. Pode viver neste mesmo monorepo (ex.: `simulator/`) ou em repo próprio linkado no README principal — decisão de organização, não bloqueia o design acima.

## Falta

Nada aberto no momento.

## Revisão de agosto de 2026 — o que a auditoria achou

Levantamento feito recurso a recurso no `infra/` e constante a constante no simulador. Cinco itens, três no Terraform e dois no simulador. Os três primeiros mudam comportamento da infra real; os dois últimos são fidelidade do desenho.

- [x] **`health_check_grace_period_seconds` no `aws_ecs_service`.** Ausente, e o default é 0. Quem decide se a task vive é o scheduler do ECS lendo o estado do target no ALB — e o grace period é a única coisa que faz ele ignorar esse estado enquanto a task sobe. Sem ele, a janela que a task tem é só a do target group: `unhealthy_threshold = 3` × `interval = 30s` ≈ 90s. Um backend de produção com pool de conexões e warmup atravessa 90s sem esforço, e o modo de falha é auto-sustentado: a task morre antes de ficar pronta, o ECS cria outra, que também não chega a tempo. Nenhum alarme resolve — `RunningTaskCount` dispara e continua disparando.

- [x] **`deregistration_delay.timeout_seconds` no target group.** Ausente, default 300s. Cinco minutos de drain por task, em todo scale-in e em toda onda de deploy, com o Fargate cobrando o tempo inteiro. E é o número que o simulador contradiz: `TASK_LIFECYCLE.drainingMs` desenha 5s. O valor certo é o request mais longo que a aplicação atende, não mais.

- [x] **`required_providers` por módulo.** Não é bug: um módulo sem a declaração assume `hashicorp/<nome>`, que é o endereço certo. É promessa do `ARCHITECTURE.md` seção 7 que o código não cumpre, e um módulo que não declara suas dependências não é reutilizável fora do root onde nasceu. O caso concreto que existe hoje: `github_oidc` usa o provider `tls` sem declarar em lugar nenhum do módulo.

- [x] **Fail open do target group.** O `splitAtTheDoor` zera tudo em `turnedAway` quando não há target saudável. O ALB faz o oposto: `unhealthy_state_routing.minimum_healthy_targets.count` tem default 1, e a doc é explícita — *"if a target group contains only unhealthy registered targets, the load balancer routes requests to all those targets"*. Este é o único ponto em que o simulador **afirma** algo que a AWS não faz, e afirma na cena mais assistida da demo. A história certa não é "o load balancer recusa tudo", é "o load balancer tenta mesmo assim, e o que volta é 5xx da aplicação em vez de 503 do balanceador".

- [x] **`TASK_LIFECYCLE.drainingMs` sem origem.** O `CALIBRATION.md` se compromete a listar todo número que não vem do Terraform, da AWS ou de premissa declarada. Os 5s do drain não estavam em nenhuma das três nem na seção de exceções. Sai de graça junto com o `deregistration_delay`.

## Resolvido
- [x] Representações visuais de response de volta — toda request faz o circuito completo até o usuário, com anel verde na volta e faixas deslocadas para ida e volta não se sobreporem.
- [x] Performance no zoom do ECS Cluster — a causa era `transition: transform` nos quatro tipos de node do cluster, que promovia camadas de composição a cada frame. De 25,8 fps para 77 fps em produção.
- [x] S3 no caminho do image pull — com round trip completo, portas de VPC endpoint e o ECR devolvendo URL pré-assinada em vez de bytes.
- [x] Destino de `logs` e `secretsmanager` — CloudWatch Logs e Secrets Manager têm node, aresta e ativação condicional. As quatro portas do interface endpoint entregam quatro caminhos.
- [x] **O bug do writer deletado.** Confirmado e corrigido. A causa não era o roteamento, que já estava certo: era `usePacketFlow`, na reação a uma aresta que some. Quando a rota de um pacote quebrava, a única saída prevista era desviar para o writer — e o guard `if (writeLegs === null) continue` apagava o pacote quando era justamente o writer que tinha morrido. Matar o writer derruba as duas instâncias durante a janela de failover (`promoting` + `provisioning`), o que tira as arestas do banco do grafo de uma vez e faz *toda* request em voo cair nesse `continue`. O caso do reader nunca apareceu porque ali havia writer para onde desviar.

  A correção é `abandonDatabaseTrip`: em vez de sumir, o pacote desiste do que está à frente, mantém as pernas que já percorreu e volta pelo caminho que ainda existe, marcado com a cor `rejected`. É o que um 5xx é — a request entrou, o app não alcançou o banco, a resposta volta. Apagar o pacote no meio do voo afirmava que a request nunca existiu.

- [x] **Mostrar alarme disparando.** Os 9 alarmes do `modules/observability` e o tópico SNS onde eles caem agora existem na tela. Cuidado com a confusão fácil, que continua valendo: o `alarms OK` do card do Application Auto Scaling é outro mecanismo — são os AlarmHigh/AlarmLow do target tracking, que a AWS cria sozinha.

  **O motor** é `simulation/observability-alarms.ts`: carrega as 9 definições com o endereço Terraform de cada uma e reproduz a semântica do CloudWatch — período, `evaluation_periods`, estatística por período (`Minimum` para HealthyHostCount, `Maximum` para UnHealthyHostCount, `Sum` para as linhas de log), `treat_missing_data`, e os três estados OK / ALARM / INSUFFICIENT_DATA. O store amostra a cada tick.

  **A parte visual** são dois nodes de control plane à direita, na mesma faixa do WAF e do Auto Scaling: `CloudWatchAlarmsNode` lista as 9 linhas com estado e condição (`< 2 · 2×1m`), e `SnsTopicNode` acende junto. A única aresta entre eles é o `alarm_actions`, que vira `Publish` em vermelho quando algo dispara. Nenhuma aresta de métrica entra no card: o CloudWatch puxa cada métrica de quem a publica, não fica num caminho de request — desenhar seta de entrada seria mentira topológica.

  **4 dos 9 são alimentáveis** com o que a simulação produz hoje — `no_healthy_hosts`, `running_tasks_low`, `latency_p99` e `error_rate`. Explodir todas as tasks acende `no_healthy_hosts` de verdade, depois de dois períodos de um minuto, e ele volta a OK sozinho quando as substitutas ficam healthy. Os outros 5 dependem de métricas que o simulador não modela (CPU, memória, conexões do Aurora, linhas de erro de log) e de `UnHealthyHostCount`, que precisa do estado `unhealthy` adiado acima. Ficam em INSUFFICIENT_DATA e aparecem esmaecidos, de propósito: melhor um alarme honestamente sem dado do que um número inventado.

## Decidido não fazer
- **Simular o S3 da aplicação.** Estava listado como "uma rota do backend lendo ou gravando num bucket próprio", para separar visualmente o S3 da aplicação do S3 onde o ECR guarda as camadas. A premissa não se sustenta: o `backend/` não fala com S3, e o único acesso a S3 desta arquitetura é o pull de camadas — que nem é da aplicação, é o ECS agent seguindo a URL pré-assinada que o ECR devolve, antes do container existir.

  Implementar exigiria três invenções encadeadas: um bucket no `infra/` que nada escreve, uma policy na task role que nada exercita, e uma fração de requests percorrendo um caminho que o código não tem. Três fabricações para uma distinção que o tooltip do card de S3 já faz em uma frase — *"This bucket belongs to ECR, not to this project, which owns no bucket of its own."* Construir o bucket tornaria essa frase falsa. O item não era só desnecessário: ia na direção contrária do que o desenho já afirma certo.

  Se um dia a aplicação precisar de um bucket de verdade — upload de usuário, export de relatório — o caminho de rede já está pronto e não muda nada: o gateway endpoint e a regra `allow_egress_to_s3_gateway` no `ecs_sg` já existem por causa do ECR, e o consumidor novo entra pela mesma porta, sem NAT e sem regra adicional. Aí o bucket teria consumidor, e o item volta a fazer sentido.
- **Ejetar target que ficou não saudável (adiado, não rejeitado).** O `aws_lb_target_group` tem `unhealthy_threshold = 3` e o simulador só modela o `healthy_threshold`. Estava listado como lacuna, mas não é: `unhealthy_threshold` não aparece em lugar nenhum da tela — o único tooltip que fala de health check (`useTaskColumnLayout.ts`) descreve só a direção saudável. Não há promessa quebrada, há feature ausente, e o caminho `failed` do blast já entrega a lição inteira (task morre, ECS repõe, cold start de 80s, latência sobe no intervalo) e é fiel: container essencial sai com 137, ECS para a task, deregistra.

  O que a pesquisa na doc da AWS mostrou é que o mecanismo é mais caro do que o item sugeria. `unhealthy` é estado próprio, não `draining` — o target continua registrado, continua sendo checkado e volta sozinho depois de 2 sucessos. E quem mata a task é o ECS, com start-before-stop: *"the service scheduler will first start a replacement task"*, e só para a doente quando a substituta fica `HEALTHY`. Modelar isso direito exige estado novo, relógio de health check por task com fase própria, contagem N+1 no `desiredCount`, recuperação, e uma segunda ferramenta ("quebrar o endpoint") sem a qual não dá para ver a diferença para o blast.

  Se voltar à pauta, o argumento não é a ejeção: é a **janela de 60–90s de detecção**, em que a task está quebrada e ainda recebendo request. É o espelho exato do gap de `registering` que já está desenhado, e a única parte que o blast não mostra.

  Dois achados soltos da mesma pesquisa, que valem por si: (1) **fail open** — *"If a target group contains only unhealthy registered targets, the load balancer routes requests to all those targets"*, com `unhealthy_state_routing.minimum_healthy_targets.count` em default 1; hoje `splitAtTheDoor` faz o oposto e zera tudo em `turnedAway`. Fica melhor depois do item de alarmes, que é quem acende a luz. (2) **`health_check_grace_period_seconds` não está definido no `aws_ecs_service`** — default 0, o que para o backend de produção que o `CLAUDE.md` manda imaginar é risco de crash loop. Esse é sobre o Terraform, não sobre o simulador.
- **Duas colunas de ECS Tasks.** Testado e revertido. O grid empurrava os pacotes para cima dos cards (o `ViewportPortal` renderiza acima dos nodes) e *piorava* o enquadramento no mobile em retrato — 0,46 de zoom contra 0,54 da coluna única. A coluna única com card compacto resolveu o problema de altura sem esses custos.

## Lacunas entre o Terraform e o simulador

Levantada comparando recurso a recurso. Não é feature nova — é promessa que o simulador já faz e não cumpre.

Nenhuma aberta no momento.
