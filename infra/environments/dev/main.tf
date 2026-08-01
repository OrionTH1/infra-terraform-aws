terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.0"
    }
  }
}

provider "aws" {
  region = var.aws-region

  default_tags {
    tags = {
      Project     = var.project
      Environment = var.environment
      ManagedBy   = "terraform"
      Repository  = var.repository
    }
  }
}

module "network" {
  source = "../../modules/network"

  project     = var.project
  environment = var.environment
  app_port    = var.app_port
}

module "alb" {
  source = "../../modules/alb"

  project               = var.project
  environment           = var.environment
  vpc_id                = module.network.vpc_id
  public_subnet_ids     = module.network.public_subnet_ids
  alb_security_group_id = module.network.alb_security_group_id
  app_port              = var.app_port
}

module "ecr" {
  source = "../../modules/ecr"

  project     = var.project
  environment = var.environment
}

module "ecs" {
  source = "../../modules/ecs"

  project                 = var.project
  environment             = var.environment
  ecr_repository_arn      = module.ecr.repository_arn
  ecr_repository_url      = module.ecr.repository_url
  image_tag               = var.image_tag
  app_port                = var.app_port
  private_subnet_ids      = module.network.private_subnet_ids
  ecs_security_group_id   = module.network.ecs_security_group_id
  target_group_arn        = module.alb.target_group_arn
  alb_listener_arn        = module.alb.listener_arn
  alb_arn_suffix          = module.alb.alb_arn_suffix
  target_group_arn_suffix = module.alb.target_group_arn_suffix
}

module "rds" {
  source = "../../modules/rds"

  project            = var.project
  environment        = var.environment
  private_subnet_ids = module.network.private_subnet_ids
}
