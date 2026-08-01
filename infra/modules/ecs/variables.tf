variable "project" {
  type        = string
  description = "Project name, used in IAM role names and tags."
}

variable "environment" {
  type        = string
  description = "Environment (dev, staging, prod), used in IAM role names and tags."
}

variable "ecr_repository_arn" {
  type        = string
  description = "ARN of the ECR repository the execution role is allowed to pull images from. Comes from module.ecr.repository_arn."
}
