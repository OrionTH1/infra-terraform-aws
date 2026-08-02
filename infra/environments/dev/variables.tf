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
  default     = "github.com/OrionTH1/ecs-terraform-infra"
}

variable "app_port" {
  type        = number
  description = "Port the application container listens on."
  default     = 8080
}

variable "image_tag" {
  type        = string
  description = "Tag of the bootstrap image used to create the Task Definition for the first time. After that, the ECS Service ignores changes to task_definition (see ecs/service.tf lifecycle block) — real deploys are handled by the api-deploy GitHub Actions workflow via aws ecs register-task-definition, not by changing this variable."
  default     = "bootstrap"
}

variable "alarm_email" {
  type        = string
  description = "Email that receives CloudWatch alarm notifications. Leave empty to skip the subscription. AWS sends a confirmation link that has to be clicked manually — see infra/README.md."
  default     = ""
}

variable "container_insights" {
  type        = string
  description = "Container Insights mode: \"disabled\", \"enabled\" or \"enhanced\". See ARCHITECTURE.md section 6 for the cost trade-off."
  default     = "enabled"
}

variable "github_repository" {
  type        = string
  description = "GitHub repository in \"owner/repo\" format (no github.com/ prefix), used to scope the GitHub Actions OIDC trust policies."
  default     = "OrionTH1/ecs-terraform-infra"
}
