moved {
  from = aws_security_group.allow_http
  to   = aws_security_group.alb_sg
}

resource "aws_security_group" "alb_sg" {
  # checkov:skip=CKV2_AWS_5:Attached to the ALB in the alb module, passed across module boundaries as a variable — Checkov's graph check does not follow that.
  name        = "alb_sg"
  description = "Public entry point: accepts HTTP and HTTPS from the internet and forwards to the ECS tasks"
  vpc_id      = aws_vpc.this.id

  tags = {
    Name = "${var.project}-${var.environment}-alb-sg"
  }
}

resource "aws_vpc_security_group_ingress_rule" "allow_http_ipv4" {
  description = "Public HTTP from the internet (redirected to HTTPS once Phase 5 lands)"
  # checkov:skip=CKV_AWS_260:This is the security group of an internet-facing ALB — accepting 80/443 from 0.0.0.0/0 is its purpose. Everything behind it (ECS, RDS) only accepts traffic from the previous tier's security group.
  security_group_id = aws_security_group.alb_sg.id
  cidr_ipv4         = "0.0.0.0/0"
  from_port         = 80
  to_port           = 80
  ip_protocol       = "tcp"
}

resource "aws_vpc_security_group_ingress_rule" "allow_https_ipv4" {
  description       = "Public HTTPS from the internet"
  security_group_id = aws_security_group.alb_sg.id
  cidr_ipv4         = "0.0.0.0/0"
  from_port         = 443
  to_port           = 443
  ip_protocol       = "tcp"
}

resource "aws_vpc_security_group_egress_rule" "allow_ecs_ipv4" {
  description                  = "ALB forwards requests to the ECS tasks on the application port"
  security_group_id            = aws_security_group.alb_sg.id
  referenced_security_group_id = aws_security_group.ecs_sg.id
  from_port                    = var.app_port
  to_port                      = var.app_port
  ip_protocol                  = "tcp"
}

resource "aws_security_group" "rds_sg" {
  # checkov:skip=CKV2_AWS_5:Attached to the Aurora cluster in the rds module via vpc_security_group_ids.
  name        = "rds_sg"
  description = "Allow RDS inbound traffic and ECS outbound traffic"
  vpc_id      = aws_vpc.this.id

  tags = {
    Name = "${var.project}-${var.environment}-rds-sg"
  }
}

resource "aws_vpc_security_group_ingress_rule" "allow_ecs_sg" {
  description                  = "Postgres access from the ECS tasks only"
  security_group_id            = aws_security_group.rds_sg.id
  referenced_security_group_id = aws_security_group.ecs_sg.id
  from_port                    = 5432
  to_port                      = 5432
  ip_protocol                  = "tcp"
}

resource "aws_security_group" "ecs_sg" {
  # checkov:skip=CKV2_AWS_5:Attached to the ECS service network configuration in the ecs module.
  name        = "ecs_sg"
  description = "Allow ALB inbound traffic and RDS outbound traffic"
  vpc_id      = aws_vpc.this.id

  tags = {
    Name = "${var.project}-${var.environment}-ecs-sg"
  }
}

resource "aws_vpc_security_group_ingress_rule" "allow_alb_sg" {
  description                  = "Accept application traffic from the ALB only"
  security_group_id            = aws_security_group.ecs_sg.id
  referenced_security_group_id = aws_security_group.alb_sg.id
  from_port                    = var.app_port
  to_port                      = var.app_port
  ip_protocol                  = "tcp"
}

resource "aws_vpc_security_group_egress_rule" "allow_egress_to_rds" {
  description                  = "ECS tasks connect to Aurora"
  security_group_id            = aws_security_group.ecs_sg.id
  referenced_security_group_id = aws_security_group.rds_sg.id
  from_port                    = 5432
  to_port                      = 5432
  ip_protocol                  = "tcp"
}

resource "aws_vpc_security_group_egress_rule" "allow_egress_to_vpc_endpoints" {
  description                  = "ECS tasks reach ECR/Logs/Secrets Manager over PrivateLink"
  security_group_id            = aws_security_group.ecs_sg.id
  referenced_security_group_id = aws_security_group.vpc_endpoints_sg.id
  from_port                    = 443
  to_port                      = 443
  ip_protocol                  = "tcp"
}

resource "aws_vpc_security_group_egress_rule" "allow_egress_to_s3_gateway" {
  description       = "ECS tasks reach S3 (ECR image layers) via the gateway endpoint"
  security_group_id = aws_security_group.ecs_sg.id
  prefix_list_id    = aws_vpc_endpoint.s3.prefix_list_id
  from_port         = 443
  to_port           = 443
  ip_protocol       = "tcp"
}
