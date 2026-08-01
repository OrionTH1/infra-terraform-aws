output "repository_url" {
  description = "URL of the ECR repository, used as the image reference in the ECS task definition."
  value       = aws_ecr_repository.backend.repository_url
}

output "repository_arn" {
  description = "ARN of the ECR repository, used to scope the ECS execution role's IAM policy to this repository."
  value       = aws_ecr_repository.backend.arn
}

output "repository_name" {
  description = "Name of the ECR repository, used by CI/CD to push new images."
  value       = aws_ecr_repository.backend.name
}
