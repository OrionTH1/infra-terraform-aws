output "plan_role_arn" {
  description = "ARN of the read-only role GitHub Actions assumes for terraform plan on pull requests."
  value       = aws_iam_role.plan.arn
}

output "apply_role_arn" {
  description = "ARN of the read-write role GitHub Actions assumes for terraform apply on merge to main, gated by the github_environment GitHub Environment."
  value       = aws_iam_role.apply.arn
}

output "deploy_role_arn" {
  description = "ARN of the role GitHub Actions assumes to build/push the image and deploy it to ECS, scoped only to ECR + this ECS service."
  value       = aws_iam_role.deploy.arn
}
