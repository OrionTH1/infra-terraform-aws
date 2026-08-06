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

variable "container_insights" {
  type        = string
  description = "CloudWatch Container Insights mode for the cluster: \"disabled\", \"enabled\" (standard, per task/service metrics) or \"enhanced\" (adds per-container metrics, ~5x the metric count and cost)."
  default     = "enabled"

  validation {
    condition     = contains(["disabled", "enabled", "enhanced"], var.container_insights)
    error_message = "container_insights must be one of: disabled, enabled, enhanced."
  }
}

variable "enable_deployment_circuit_breaker" {
  type        = bool
  description = "Whether ECS should detect failed deployments (failing health checks, image pull errors) and roll back to the last COMPLETED deployment instead of looping forever."
  default     = true
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
  description = "Tag of the bootstrap image used to create the Task Definition for the first time. Real deploys after that are handled outside Terraform (see aws_ecs_service.backend's lifecycle.ignore_changes on task_definition)."
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

variable "private_subnet_ids" {
  type        = list(string)
  description = "Private subnet IDs the ECS tasks run in. Comes from module.network.private_subnet_ids."
}

variable "ecs_security_group_id" {
  type        = string
  description = "ID of the security group attached to the ECS tasks. Comes from module.network.ecs_security_group_id."
}

variable "target_group_arn" {
  type        = string
  description = "ARN of the ALB target group the service registers tasks into. Comes from module.alb.target_group_arn."
}

variable "alb_listener_arn" {
  type        = string
  description = "ARN of the ALB listener. Not used directly by the service, only to force it to wait until the listener is actually forwarding traffic to the target group before creating the service. Comes from module.alb.listener_arn."
}

variable "desired_count" {
  type        = number
  description = "Number of tasks the service keeps running. >= 2 for real HA across AZs. Only used as the initial value — autoscaling takes over desired_count after that (see lifecycle.ignore_changes on the service)."
  default     = 2
}

variable "min_capacity" {
  type        = number
  description = "Minimum number of tasks autoscaling is allowed to scale in to."
  default     = 2
}

variable "max_capacity" {
  type        = number
  description = "Maximum number of tasks autoscaling is allowed to scale out to. This is a blast-radius control, not a capacity target — target tracking only reaches it under sustained load or a runaway (retry storm, traffic that got past the WAF). At 10 tasks the service tops out around 10,000 requests per minute, and a task pegged for a full month costs roughly 9 USD, so the ceiling is cheap insurance rather than a standing cost."
  default     = 10
}

variable "requests_per_target_target_value" {
  type        = number
  description = "Target average ALB requests per minute per task. Autoscaling adds/removes tasks to keep the actual average close to this value."
  default     = 1000
}

variable "alb_arn_suffix" {
  type        = string
  description = "ARN suffix of the ALB. Comes from module.alb.alb_arn_suffix."
}

variable "target_group_arn_suffix" {
  type        = string
  description = "ARN suffix of the target group. Comes from module.alb.target_group_arn_suffix."
}

variable "rds_master_secret_arn" {
  type        = string
  description = "ARN of the Secrets Manager secret holding the Aurora master credentials. Comes from module.rds.master_user_secret_arn."
}

variable "db_host" {
  type        = string
  description = "Aurora cluster writer endpoint. Comes from module.rds.cluster_endpoint."
}

variable "db_reader_host" {
  type        = string
  description = "Aurora reader endpoint. Comes from module.rds.cluster_reader_endpoint. Aurora load-balances this endpoint across the reader instances, so read-only queries sent here never touch the writer. Reads through this endpoint can observe replication lag, which is why anything that must read its own write has to go to db_host instead."
}

variable "db_port" {
  type        = number
  description = "Aurora cluster port. Comes from module.rds.cluster_port."
}

variable "db_name" {
  type        = string
  description = "Database name. Comes from module.rds.database_name."
}
