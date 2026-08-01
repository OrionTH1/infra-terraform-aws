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
