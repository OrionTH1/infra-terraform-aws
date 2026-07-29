variable "project" {
  type        = string
  description = "Project name, used in the Name tag and resource names."
}

variable "environment" {
  type        = string
  description = "Environment (dev, staging, prod), used in the Name tag and resource names."
}

variable "vpc_id" {
  type        = string
  description = "ID of the VPC where the target group is created. Comes from module.network.vpc_id."
}

variable "public_subnet_ids" {
  type        = list(string)
  description = "Public subnet IDs the ALB is deployed into. Comes from module.network.public_subnet_ids."
}

variable "alb_security_group_id" {
  type        = string
  description = "ID of the ALB security group. Comes from module.network.alb_security_group_id."
}

variable "app_port" {
  type        = number
  description = "Port the application container listens on. The target group forwards traffic to this port."
}

variable "enable_deletion_protection" {
  type        = bool
  description = "Whether to enable deletion protection on the ALB. Keep false in dev (iterating on apply/destroy); set true in prod."
  default     = false
}
