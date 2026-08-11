variable "aws-region" {
  type        = string
  description = "Region every resource of this layer is created in."
  default     = "us-east-1"
}

variable "project" {
  type        = string
  description = "Project name, used as a prefix for resource names and tags."
  default     = "ecs-portfolio"
}

variable "environment" {
  type        = string
  description = "Environment the CI roles are scoped to. The bootstrap layer itself is not per-environment, but the permissions it grants are."
  default     = "dev"
}

variable "repository" {
  type        = string
  description = "Repository URL, used in the Repository tag."
  default     = "github.com/OrionTH1/infra-terraform-aws"
}

variable "state_bucket_name" {
  type        = string
  description = "Name of the bucket that holds the Terraform state of every layer. Must match the bucket in each backend.tf, which cannot interpolate variables."
  default     = "ecs-portfolio-tfstate-b41d7649"
}

variable "github_repository" {
  type        = string
  description = "GitHub repository in \"owner/repo\" format, used to scope the OIDC trust policies."
  default     = "OrionTH1/infra-terraform-aws"
}
