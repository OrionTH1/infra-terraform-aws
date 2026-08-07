output "vpc_id" {
  description = "ID of the VPC."
  value       = aws_vpc.this.id
}

output "vpc_cidr_block" {
  description = "CIDR block of the VPC."
  value       = aws_vpc.this.cidr_block
}

output "public_subnet_ids" {
  description = "List of public subnet IDs, for resources that don't need per-AZ mapping (e.g. ALB subnet_mapping)."
  value       = [for subnet in aws_subnet.public : subnet.id]
}

output "public_subnets_by_az" {
  description = "Map of availability zone to public subnet ID."
  value       = { for az, subnet in aws_subnet.public : az => subnet.id }
}

output "private_subnet_ids" {
  description = "List of private subnet IDs, for resources that don't need per-AZ mapping (e.g. ECS service network configuration)."
  value       = [for subnet in aws_subnet.private : subnet.id]
}

output "private_subnets_by_az" {
  description = "Map of availability zone to private subnet ID."
  value       = { for az, subnet in aws_subnet.private : az => subnet.id }
}

output "public_route_table_id" {
  description = "ID of the public route table."
  value       = aws_route_table.public.id
}

output "private_route_table_id" {
  description = "ID of the private route table."
  value       = aws_route_table.private.id
}

output "alb_security_group_id" {
  description = "ID of the security group meant for the Application Load Balancer (inbound 80/443 from the internet, outbound to the ECS security group)."
  value       = aws_security_group.alb_sg.id
}

output "ecs_security_group_id" {
  description = "ID of the security group meant for ECS tasks (inbound from the ALB security group, outbound to the RDS security group)."
  value       = aws_security_group.ecs_sg.id
}

output "rds_security_group_id" {
  description = "ID of the security group meant for the RDS/Aurora instances (inbound from the ECS security group only)."
  value       = aws_security_group.rds_sg.id
}

output "vpc_endpoints_security_group_id" {
  description = "ID of the security group attached to the interface VPC endpoints (inbound 443 from the ECS security group)."
  value       = aws_security_group.vpc_endpoints_sg.id
}
