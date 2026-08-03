variable "project" {
  type        = string
  description = "Project name, used in resource names and tags."
}

variable "environment" {
  type        = string
  description = "Environment (dev, staging, prod), used in resource names and tags."
}

variable "alarm_email" {
  type        = string
  description = "Email address subscribed to the alarm SNS topic. Leave empty to create the topic without any subscription. NOTE: AWS sends a confirmation link that must be clicked manually — Terraform cannot confirm it."
  default     = ""
}

variable "alb_arn_suffix" {
  type        = string
  description = "ARN suffix of the ALB (LoadBalancer dimension). Comes from module.alb.alb_arn_suffix."
}

variable "target_group_arn_suffix" {
  type        = string
  description = "ARN suffix of the target group (TargetGroup dimension). Comes from module.alb.target_group_arn_suffix."
}

variable "error_rate_threshold_percent" {
  type        = number
  description = "Percentage of 5xx responses (ELB-generated + target-generated) that triggers the error rate alarm."
  default     = 5
}

variable "error_rate_min_requests" {
  type        = number
  description = "Minimum requests in the period before the error rate alarm can fire. Without this guard, 1 error out of 2 requests reads as a 50% error rate."
  default     = 30
}

variable "latency_p99_threshold_seconds" {
  type        = number
  description = "p99 target response time that triggers the latency alarm. Kept generous because Aurora Serverless v2 auto-pause makes the first request after idle slow."
  default     = 5
}

variable "ecs_cluster_name" {
  type        = string
  description = "ECS cluster name (ClusterName dimension). Comes from module.ecs.cluster_name."
}

variable "ecs_service_name" {
  type        = string
  description = "ECS service name (ServiceName dimension). Comes from module.ecs.service_name."
}

variable "ecs_service_arn" {
  type        = string
  description = "ARN of the ECS service, used to scope the EventBridge deployment-failure rule to this service only. Comes from module.ecs.service_id."
}

variable "ecs_min_running_tasks" {
  type        = number
  description = "Number of tasks below which the RunningTaskCount alarm fires. Should match the autoscaling minimum."
  default     = 2
}

variable "cpu_threshold_percent" {
  type        = number
  description = "Service CPU utilization that triggers an alarm. Set above what autoscaling produces in normal operation — this alarm exists to catch CPU that is high *without* matching request volume, which request-count autoscaling never reacts to."
  default     = 85
}

variable "memory_threshold_percent" {
  type        = number
  description = "Service memory utilization that triggers an alarm. There is no autoscaling on memory, so this is the only signal before an OOM kill."
  default     = 80
}

variable "container_insights_enabled" {
  type        = bool
  description = "Whether Container Insights is enabled on the cluster. Controls whether the RunningTaskCount alarm (which needs the ECS/ContainerInsights namespace) is created."
  default     = true
}

variable "log_group_name" {
  type        = string
  description = "CloudWatch log group the ECS tasks write to. Comes from module.ecs.log_group_name."
}

variable "app_error_threshold" {
  type        = number
  description = "Number of application error log lines in the period that triggers an alarm."
  default     = 10
}

variable "db_cluster_identifier" {
  type        = string
  description = "Aurora cluster identifier (DBClusterIdentifier dimension). Comes from module.rds.cluster_identifier."
}

variable "db_max_connections" {
  type        = number
  description = "Database connection count that triggers an alarm. Catches connection leaks in the application's pool."
  default     = 50
}
