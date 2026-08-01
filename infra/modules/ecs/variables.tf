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

variable "log_retention_days" {
  type        = number
  description = "Number of days to retain the ECS task's CloudWatch logs."
  default     = 14
}

variable "ecr_repository_url" {
  type        = string
  description = "URL of the ECR repository, used as the container image reference. Comes from module.ecr.repository_url."
}

variable "image_tag" {
  type        = string
  description = "Tag of the image to deploy (e.g. a commit SHA). The ECR repository is immutable, so this must change on every deploy."
}

variable "app_port" {
  type        = number
  description = "Port the application container listens on."
}

variable "task_cpu" {
  type        = string
  description = "Fargate task-level CPU units (256 = 0.25 vCPU). Must be a valid Fargate CPU/memory combination."
  default     = "256"
}

variable "task_memory" {
  type        = string
  description = "Fargate task-level memory in MiB. Must be a valid Fargate CPU/memory combination."
  default     = "512"
}
