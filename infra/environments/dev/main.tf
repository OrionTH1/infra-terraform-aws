terraform {
  required_version = "~> 1.15"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.0"
    }
    tls = {
      source  = "hashicorp/tls"
      version = "~> 4.0"
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

data "aws_ecr_repository" "backend" {
  name = "${var.project}-${var.environment}-backend"
}

module "rds" {
  source = "../../modules/rds"

  project               = var.project
  environment           = var.environment
  private_subnet_ids    = module.network.private_subnet_ids
  rds_security_group_id = module.network.rds_security_group_id
}

module "ecs" {
  source = "../../modules/ecs"

  project                 = var.project
  environment             = var.environment
  ecr_repository_arn      = data.aws_ecr_repository.backend.arn
  ecr_repository_url      = data.aws_ecr_repository.backend.repository_url
  image_tag               = var.image_tag
  app_port                = var.app_port
  container_insights      = var.container_insights
  private_subnet_ids      = module.network.private_subnet_ids
  ecs_security_group_id   = module.network.ecs_security_group_id
  target_group_arn        = module.alb.target_group_arn
  alb_listener_arn        = module.alb.listener_arn
  alb_arn_suffix          = module.alb.alb_arn_suffix
  target_group_arn_suffix = module.alb.target_group_arn_suffix
  rds_master_secret_arn   = module.rds.master_user_secret_arn
  db_host                 = module.rds.cluster_endpoint
  db_reader_host          = module.rds.cluster_reader_endpoint
  db_port                 = module.rds.cluster_port
  db_name                 = module.rds.database_name
}

module "waf" {
  source = "../../modules/waf"

  project     = var.project
  environment = var.environment
  alb_arn     = module.alb.alb_arn
}

module "observability" {
  source = "../../modules/observability"

  project     = var.project
  environment = var.environment
  alarm_email = var.alarm_email

  alb_arn_suffix          = module.alb.alb_arn_suffix
  target_group_arn_suffix = module.alb.target_group_arn_suffix

  ecs_cluster_name           = module.ecs.cluster_name
  ecs_service_name           = module.ecs.service_name
  ecs_service_arn            = module.ecs.service_id
  ecs_min_running_tasks      = 2
  container_insights_enabled = var.container_insights != "disabled"

  log_group_name = module.ecs.log_group_name

  db_cluster_identifier = module.rds.cluster_identifier
}
