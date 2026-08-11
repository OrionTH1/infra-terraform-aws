output "ecr_repository_url" {
  description = "URL of the ECR repository the tasks pull from. The repository itself belongs to the bootstrap layer."
  value       = data.aws_ecr_repository.backend.repository_url
}

output "alb_dns_name" {
  description = "DNS name of the ALB. Use this to test the API once tasks are healthy."
  value       = module.alb.alb_dns_name
}

output "db_cluster_endpoint" {
  description = "Writer endpoint of the Aurora cluster."
  value       = module.rds.cluster_endpoint
  sensitive   = true
}

output "db_master_user_secret_arn" {
  description = "ARN of the Secrets Manager secret with the Aurora master credentials."
  value       = module.rds.master_user_secret_arn
  sensitive   = true
}

output "dashboard_url" {
  description = "Console URL of the CloudWatch dashboard for this environment."
  value       = module.observability.dashboard_url
}

output "alarm_topic_arn" {
  description = "ARN of the SNS topic that receives alarms and deployment-failure events."
  value       = module.observability.alarm_topic_arn
}
