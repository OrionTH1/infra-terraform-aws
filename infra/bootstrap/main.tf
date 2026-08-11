provider "aws" {
  region = var.aws-region

  default_tags {
    tags = {
      Project     = var.project
      Environment = var.environment
      Layer       = "bootstrap"
      ManagedBy   = "terraform"
      Repository  = var.repository
    }
  }
}

data "aws_caller_identity" "current" {}

locals {
  account_id = data.aws_caller_identity.current.account_id
  name       = "${var.project}-${var.environment}"

  ecr_repository_arn     = "arn:aws:ecr:${var.aws-region}:${local.account_id}:repository/${local.name}-backend"
  ecs_service_arn        = "arn:aws:ecs:${var.aws-region}:${local.account_id}:service/${local.name}/${local.name}-backend"
  ecs_execution_role_arn = "arn:aws:iam::${local.account_id}:role/${local.name}-ecs-execution"
  ecs_task_role_arn      = "arn:aws:iam::${local.account_id}:role/${local.name}-ecs-task"
}

module "ecr" {
  source = "../modules/ecr"

  project      = var.project
  environment  = var.environment
  force_delete = false
}

module "github_oidc" {
  source = "../modules/github_oidc"

  project               = var.project
  environment           = var.environment
  github_subject_prefix = var.github_subject_prefix

  state_bucket_arn = aws_s3_bucket.state.arn
  state_key        = "${var.environment}/terraform.tfstate"

  ecr_repository_arn     = local.ecr_repository_arn
  ecs_service_arn        = local.ecs_service_arn
  ecs_execution_role_arn = local.ecs_execution_role_arn
  ecs_task_role_arn      = local.ecs_task_role_arn
}
