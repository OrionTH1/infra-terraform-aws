output "ecr_repository_url" {
  description = "URL of the ECR repository. Tag and push the backend image here before the ECS service can start."
  value       = module.ecr.repository_url
}

output "alb_dns_name" {
  description = "DNS name of the ALB. Use this to test the API once tasks are healthy."
  value       = module.alb.alb_dns_name
}

output "db_cluster_endpoint" {
  description = "Writer endpoint of the Aurora cluster."
  value       = module.rds.cluster_endpoint
}

output "db_master_user_secret_arn" {
  description = "ARN of the Secrets Manager secret with the Aurora master credentials."
  value       = module.rds.master_user_secret_arn
}
