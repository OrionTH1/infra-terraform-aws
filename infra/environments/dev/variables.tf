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
