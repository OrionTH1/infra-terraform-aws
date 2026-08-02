output "alarm_topic_arn" {
  description = "ARN of the SNS topic all alarms and deployment-failure events publish to."
  value       = aws_sns_topic.alarms.arn
}

output "dashboard_name" {
  description = "Name of the CloudWatch dashboard."
  value       = aws_cloudwatch_dashboard.main.dashboard_name
}

output "dashboard_url" {
  description = "Console URL of the CloudWatch dashboard."
  value       = "https://${data.aws_region.current.region}.console.aws.amazon.com/cloudwatch/home?region=${data.aws_region.current.region}#dashboards/dashboard/${aws_cloudwatch_dashboard.main.dashboard_name}"
}

output "stable_alarm_arns" {
  description = "ARNs of the alarms that are safe to wire into the ECS service's deployment_alarms — only ones that will not flap on an idle environment."
  value = [
    aws_cloudwatch_metric_alarm.unhealthy_hosts.arn,
    aws_cloudwatch_metric_alarm.error_rate.arn,
  ]
}
