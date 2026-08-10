<!-- Idiomas: **Português** · English (em breve) -->

# infra-terraform-aws

Infraestrutura AWS em Terraform para um serviço web dimensionado como produção: subnets privadas sem rota para internet, ECS Fargate atrás de um Application Load Balancer, Aurora Serverless v2, WAF, observabilidade e CI/CD por OIDC.

A aplicação é deliberadamente trivial — um endpoint de health check que serve de canário. Toda a engenharia está na infraestrutura e em como ela é comunicada.

[![terraform plan](https://github.com/OrionTH1/infra-terraform-aws/actions/workflows/terraform-plan.yml/badge.svg)](https://github.com/OrionTH1/infra-terraform-aws/actions/workflows/terraform-plan.yml)
[![api deploy](https://github.com/OrionTH1/infra-terraform-aws/actions/workflows/api-deploy.yml/badge.svg)](https://github.com/OrionTH1/infra-terraform-aws/actions/workflows/api-deploy.yml)
![terraform](https://img.shields.io/badge/terraform-~%3E%201.15-7B42BC?logo=terraform&logoColor=white)

---

[![Simulador da infraestrutura sob carga](.github/assets/demo.gif)](https://orionth1.github.io/infra-simulator-aws/)

<p align="center"><em>A mesma infraestrutura, sob carga — <a href="https://orionth1.github.io/infra-simulator-aws/">abrir o simulador</a></em></p>

## A arquitetura

```mermaid
flowchart LR
    net([Internet])
    waf["AWS WAF"]

    subgraph vpc["VPC · 2 AZs"]
        direction TB
        subgraph pub["públicas"]
            alb["Application<br/>Load Balancer"]
        end
        subgraph priv["privadas"]
            ecs["ECS Fargate<br/>2–10 tasks"]
            db[("Aurora Serverless v2<br/>writer + reader")]
            vpce["VPC Endpoints"]
        end
    end

    ecr["ECR"]
    logs["CloudWatch"]
    sec["Secrets Manager"]

    net --> waf --> alb --> ecs
    ecs --> db
    ecs --> vpce
    vpce --> ecr
    vpce --> logs
    vpce --> sec

    classDef regional stroke-dasharray: 4 3
    class waf,ecr,logs,sec regional
```

<sup>Tracejado: serviço regional da AWS, fora da sua VPC. As subnets privadas não têm rota para internet — tudo que sai delas passa por um VPC endpoint.</sup>

## O que tem aqui

- **ECS Fargate** — 2 a 10 tasks, autoscaling por requisições por target, teto de ~10.000 req/min
- **Aurora Serverless v2** — writer e reader em AZs diferentes, 0,5 a 4 ACU, senha gerada e rotacionada pelo RDS
- **Rede** — 2 AZs, subnets privadas sem rota para internet, 4 interface endpoints e 1 gateway endpoint, zero NAT
- **WAF** — rate limit de 2.000 req/5min por IP e 4 grupos de regras gerenciadas da AWS
- **Observabilidade** — 9 alarmes CloudWatch num único tópico SNS, dashboard, metric filter de erros e 2 regras EventBridge
- **CI/CD** — 3 workflows com OIDC, sem chave estática: plan comentado no PR, apply com aprovação manual, deploy de imagem à parte
- **Segurança no CI** — Checkov no IaC e Trivy na imagem, ambos falhando o build e publicando SARIF

## Onde ir agora

| | |
|---|---|
| [**`infra/`**](infra/README.md) | O Terraform: mapa dos módulos, as decisões de arquitetura e o porquê de cada uma, setup do remote state e o roteiro de validação end-to-end |
| [**`backend/`**](backend/README.md) | A aplicação Express que as tasks rodam, e por que ela é intencionalmente mínima |
| [**infra-simulator-aws**](https://github.com/OrionTH1/infra-simulator-aws) | O simulador do GIF acima: como ele modela esta infra e de onde vem cada número que ele mostra |
