output "ecr_repository_url" {
  description = "URL of the ECR repository. Tag and push the backend image here before the ECS service can start."
  value       = module.ecr.repository_url
}

output "alb_dns_name" {
  description = "DNS name of the ALB. Use this to test the API once tasks are healthy."
  value       = module.alb.alb_dns_name
}

# sensitive = true does NOT encrypt anything — the value is still in plaintext in the
# state file. What it does is keep the value out of `terraform plan` output, which this
# repo posts as a PR comment (see .github/workflows/terraform-plan.yml) and which lives
# in public Actions logs. That is the actual leak being closed here.
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

output "gha_plan_role_arn" {
  description = "ARN of the read-only IAM role for the terraform-plan GitHub Actions workflow (PRs)."
  value       = module.github_oidc.plan_role_arn
}

output "gha_apply_role_arn" {
  description = "ARN of the read-write IAM role for the terraform-apply GitHub Actions workflow (main branch, gated by the production Environment)."
  value       = module.github_oidc.apply_role_arn
}

output "gha_deploy_role_arn" {
  description = "ARN of the IAM role for the api-deploy GitHub Actions workflow (ECR push + ECS deploy only, runs on every push to main)."
  value       = module.github_oidc.deploy_role_arn
}
