variable "aws-region" {
  type    = string
  default = "us-east-1"
}

variable "project" {
  type        = string
  description = "Project name, used as a prefix for resource names and tags."
  default     = "ecs-portfolio"
}

variable "environment" {
  type        = string
  description = "Environment name (dev, staging, prod)."
  default     = "dev"
}

variable "repository" {
  type        = string
  description = "Repository URL, used in the Repository tag."
  default     = "github.com/matheus/ecs-terraform-infra"
}

variable "app_port" {
  type        = number
  description = "Port the application container listens on."
  default     = 8080
}

variable "image_tag" {
  type        = string
  description = "Tag of the backend image in ECR to deploy (e.g. a commit SHA). No default: the ECR repository is immutable, so this must be a tag that was actually pushed."
}
