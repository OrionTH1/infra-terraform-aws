# backend/

A aplicação que as tasks do ECS rodam. Um servidor Express com uma rota só:

```
GET /api/v1/health  →  200 OK
```

Isso é intencional. Ela existe para provar que o caminho inteiro funciona de ponta a ponta, não para ter funcionalidade própria, e a engenharia deste repositório está em [`infra/`](../infra/README.md). O objetivo aqui é ser pequeno o bastante para nunca ser a explicação de um problema.

## O contrato com a infraestrutura

Vários detalhes que parecem escolha interna da aplicação são, na prática, aquilo de que um recurso Terraform depende. Mudar a coluna da esquerda quebra a da direita, sem aviso e sem erro de compilação:

| A aplicação | Do que isso é pré-requisito |
|---|---|
| Responde `200` em `/api/v1/health` | Health check do target group e `HEALTHCHECK` da imagem |
| Escuta em `SERVER_PORT` (8080) | `app_port`: porta do target group e das regras dos security groups |
| Loga JSON com `level >= 50` em erro | Metric filter `app_errors`, que alimenta um alarme do CloudWatch |
| Renomeia `responseTime` para `responseTimeMs` | Query salva `slow-requests` do CloudWatch Logs Insights |
| Loga `res.statusCode` | Query salva `requests-by-status` |
| Escreve em stdout, sem arquivo | Driver `awslogs`, que leva o stdout do container ao CloudWatch |
| Lê `DB_HOST` e `DB_READER_HOST` | Endpoints de writer e reader publicados pelo cluster Aurora |
| Lê `DB_USERNAME` e `DB_PASSWORD` | Segredo do Secrets Manager, buscado pela execution role antes do container subir |

Foi por isso que separei este README do resto. Olhando só o `app.ts`, `customAttributeKeys: { responseTime: 'responseTimeMs' }` parece capricho de nomenclatura. É o nome que a query do Logs Insights procura.

## A rota é rasa de propósito

O health check não toca o banco. Um check profundo amarrado ao target group transforma soluço de dependência em indisponibilidade total: todas as tasks falham a checagem ao mesmo tempo, o ALB fica sem target saudável e devolve 503, inclusive para rotas que nem usariam o banco.

Verificação de dependência, quando existir, vai numa rota separada. Alarme e dashboard consomem essa rota; o balanceador não usa ela para ejetar target.

## Os dois pools

`src/db/pool.ts` mantém uma conexão para o writer e outra para o reader, porque o Aurora publica dois endpoints e o de leitura balanceia entre as réplicas.

`readQuery()` tenta o reader e, se ele não responder, repete a consulta no writer e registra um `warn`. Isso mantém a leitura de pé durante um failover. O custo é aceitar replication lag: uma leitura logo depois de uma escrita pode não enxergar a escrita, então consulta que precise ler a própria escrita tem que ir direto ao writer.

## A imagem

`Dockerfile` em quatro estágios: dependências, build, dependências de produção e runtime. Só o último vira imagem, então TypeScript e `devDependencies` não chegam ao registry.

Três escolhas do runtime que valem nota:

- **`tini` como PID 1.** O Node no PID 1 não recolhe processos zumbis nem trata sinais como um init trataria. Sem ele, o `SIGTERM` que o ECS manda ao parar uma task não chega direito ao processo.
- **`USER node`.** O container não roda como root.
- **`HEALTHCHECK` na imagem**, além do health check do target group. São camadas diferentes, e a do Docker é a que vale num `docker run` local.

## Rodar local

```bash
npm install
npm run dev          # tsx watch, recarrega ao salvar
curl localhost:8080/api/v1/health
```

Não precisa de banco para subir. Os pools do `pg` são preguiçosos e só abrem conexão na primeira consulta, e nenhuma rota consulta nada ainda.

## Limitações conhecidas

- **`SIGTERM` não é tratado.** O `tini` entrega o sinal, mas o processo não fecha o servidor com elegância, então requisição em voo é cortada. Isso torna o `deregistration_delay` de 30s do target group menos útil do que ele poderia ser: o drain existe justamente para dar esse tempo, e a aplicação não usa.
- **TLS sem verificação de CA.** A conexão com o Aurora usa `rejectUnauthorized: false`. O tráfego vai criptografado, mas o certificado não é validado. O correto seria embarcar o bundle de CA do RDS na imagem.
- **Sem testes.** A superfície é uma rota que devolve string constante.
