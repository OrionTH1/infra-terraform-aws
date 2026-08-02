variable "project" {
  type        = string
  description = "Project name, used in role names and tags."
}

variable "environment" {
  type        = string
  description = "Environment (dev, staging, prod), used in role names and tags."
}

variable "github_repository" {
  type        = string
  description = "GitHub repository in \"owner/repo\" format. Scopes the trust policies so only this repo's workflows can assume the roles."
}

variable "github_environment" {
  type        = string
  description = "Name of the GitHub Environment the apply workflow's job declares (e.g. \"production\"). Must match exactly — GitHub's OIDC sub claim becomes repo:OWNER/REPO:environment:NAME for jobs that declare an environment."
  default     = "production"
}

variable "state_bucket_arn" {
  type        = string
  description = "ARN of the S3 bucket holding Terraform state, e.g. arn:aws:s3:::my-bucket."
}

variable "state_key" {
  type        = string
  description = "Key of the state object within the bucket, e.g. \"dev/terraform.tfstate\"."
}

variable "ecr_repository_arn" {
  type        = string
  description = "ARN of the ECR repository the deploy role is allowed to push images to. Comes from module.ecr.repository_arn."
}

variable "ecs_service_arn" {
  type        = string
  description = "ARN of the ECS service the deploy role is allowed to update. Comes from module.ecs.service_id."
}

variable "ecs_execution_role_arn" {
  type        = string
  description = "ARN of the ECS execution role, needed for iam:PassRole when registering a new task definition revision. Comes from module.ecs.execution_role_arn."
}

variable "ecs_task_role_arn" {
  type        = string
  description = "ARN of the ECS task role, needed for iam:PassRole when registering a new task definition revision. Comes from module.ecs.task_role_arn."
}
