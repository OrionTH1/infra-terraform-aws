output "plan_role_arn" {
  description = "ARN of the read-only role GitHub Actions assumes for terraform plan on pull requests."
  value       = aws_iam_role.plan.arn
}

output "apply_role_arn" {
  description = "ARN of the read-write role GitHub Actions assumes for terraform apply on merge to main, gated by the github_environment GitHub Environment."
  value       = aws_iam_role.apply.arn
}
