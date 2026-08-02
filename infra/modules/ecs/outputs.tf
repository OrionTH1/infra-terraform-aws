output "cluster_arn" {
  description = "ARN of the ECS cluster."
  value       = aws_ecs_cluster.this.arn
}

output "cluster_name" {
  description = "Name of the ECS cluster, used as the ClusterName dimension in CloudWatch metrics."
  value       = aws_ecs_cluster.this.name
}

output "service_name" {
  description = "Name of the ECS service, used as the ServiceName dimension in CloudWatch metrics."
  value       = aws_ecs_service.backend.name
}

output "log_group_name" {
  description = "Name of the CloudWatch log group the tasks write to."
  value       = aws_cloudwatch_log_group.backend.name
}

output "service_id" {
  description = "ARN of the ECS service (the service resource's id is its ARN)."
  value       = aws_ecs_service.backend.id
}

output "execution_role_arn" {
  description = "ARN of the ECS task execution role."
  value       = aws_iam_role.execution.arn
}

output "task_role_arn" {
  description = "ARN of the ECS task role."
  value       = aws_iam_role.task.arn
}

output "task_definition_family" {
  description = "Family name of the task definition, used by CI to register new revisions."
  value       = aws_ecs_task_definition.backend.family
}

output "container_name" {
  description = "Name of the container within the task definition, used by CI to patch the image field of new revisions."
  value       = local.container_name
}
