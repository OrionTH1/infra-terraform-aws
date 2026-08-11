output "state_bucket_name" {
  description = "Bucket that holds the state of every layer. Each backend.tf has to name it literally, since backends cannot interpolate."
  value       = aws_s3_bucket.state.bucket
}

output "ecr_repository_url" {
  description = "URL of the ECR repository. Tag and push the backend image here before the workload layer can start a task."
  value       = module.ecr.repository_url
}

output "gha_plan_role_arn" {
  description = "Read-only role assumed by the terraform-plan workflow on pull requests."
  value       = module.github_oidc.plan_role_arn
}

output "gha_apply_role_arn" {
  description = "Read-write role assumed by the terraform-apply workflow, gated by the production environment."
  value       = module.github_oidc.apply_role_arn
}

output "gha_deploy_role_arn" {
  description = "Role assumed by the api-deploy workflow, limited to pushing an image and updating the service."
  value       = module.github_oidc.deploy_role_arn
}
