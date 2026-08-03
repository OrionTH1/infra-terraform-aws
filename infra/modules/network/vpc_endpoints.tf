data "aws_region" "current" {}

resource "aws_vpc_endpoint" "s3" {
  vpc_id            = aws_vpc.this.id
  service_name      = "com.amazonaws.${data.aws_region.current.region}.s3"
  vpc_endpoint_type = "Gateway"

  route_table_ids = [aws_route_table.private.id]

  tags = {
    Name = "${var.project}-${var.environment}-vpce-s3"
  }
}

resource "aws_security_group" "vpc_endpoints_sg" {
  name        = "vpc_endpoints_sg"
  description = "Allow ECS inbound traffic to interface VPC endpoints"
  vpc_id      = aws_vpc.this.id

  tags = {
    Name = "${var.project}-${var.environment}-vpce-sg"
  }
}

resource "aws_vpc_security_group_ingress_rule" "allow_ecs_to_endpoints" {
  description = "Interface endpoints accept HTTPS from the ECS tasks only"
  security_group_id            = aws_security_group.vpc_endpoints_sg.id
  referenced_security_group_id = aws_security_group.ecs_sg.id
  from_port                    = 443
  to_port                      = 443
  ip_protocol                  = "tcp"
}

resource "aws_vpc_endpoint" "interface" {
  for_each = toset(["ecr.api", "ecr.dkr", "logs", "secretsmanager"])

  vpc_id              = aws_vpc.this.id
  service_name        = "com.amazonaws.${data.aws_region.current.region}.${each.value}"
  vpc_endpoint_type   = "Interface"
  subnet_ids          = [for subnet in aws_subnet.private : subnet.id]
  security_group_ids  = [aws_security_group.vpc_endpoints_sg.id]
  private_dns_enabled = true

  tags = {
    Name = "${var.project}-${var.environment}-vpce-${each.value}"
  }
}
