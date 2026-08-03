# This alarm is NOT redundant with autoscaling. Autoscaling here reacts to
# ALBRequestCountPerTarget, so it only ever adds capacity when request volume rises.
# High CPU *without* matching request volume — an infinite loop, GC thrash, a runaway
# query — is invisible to it. That's the failure this alarm catches.
resource "aws_cloudwatch_metric_alarm" "cpu_high" {
  alarm_name          = "${var.project}-${var.environment}-ecs-cpu-high"
  alarm_description   = "Service CPU above ${var.cpu_threshold_percent}% — high CPU decoupled from request volume is not something request-count autoscaling reacts to."
  namespace           = "AWS/ECS"
  metric_name         = "CPUUtilization"
  statistic           = "Average"
  period              = 60
  evaluation_periods  = 5
  threshold           = var.cpu_threshold_percent
  comparison_operator = "GreaterThanThreshold"
  treat_missing_data  = "notBreaching"

  dimensions = {
    ClusterName = var.ecs_cluster_name
    ServiceName = var.ecs_service_name
  }

  alarm_actions = local.alarm_actions
  ok_actions    = local.ok_actions

  tags = {
    Name = "${var.project}-${var.environment}-ecs-cpu-high"
  }
}

resource "aws_cloudwatch_metric_alarm" "memory_high" {
  alarm_name          = "${var.project}-${var.environment}-ecs-memory-high"
  alarm_description   = "Service memory above ${var.memory_threshold_percent}% — nothing scales on memory, so the next step is an OOM kill."
  namespace           = "AWS/ECS"
  metric_name         = "MemoryUtilization"
  statistic           = "Average"
  period              = 60
  evaluation_periods  = 5
  threshold           = var.memory_threshold_percent
  comparison_operator = "GreaterThanThreshold"
  treat_missing_data  = "notBreaching"

  dimensions = {
    ClusterName = var.ecs_cluster_name
    ServiceName = var.ecs_service_name
  }

  alarm_actions = local.alarm_actions
  ok_actions    = local.ok_actions

  tags = {
    Name = "${var.project}-${var.environment}-ecs-memory-high"
  }
}

resource "aws_cloudwatch_metric_alarm" "running_tasks_low" {
  count = var.container_insights_enabled ? 1 : 0

  alarm_name          = "${var.project}-${var.environment}-ecs-running-tasks-low"
  alarm_description   = "Fewer than ${var.ecs_min_running_tasks} tasks running."
  namespace           = "ECS/ContainerInsights"
  metric_name         = "RunningTaskCount"
  statistic           = "Average"
  period              = 60
  evaluation_periods  = 3
  threshold           = var.ecs_min_running_tasks
  comparison_operator = "LessThanThreshold"
  treat_missing_data  = "breaching"

  dimensions = {
    ClusterName = var.ecs_cluster_name
    ServiceName = var.ecs_service_name
  }

  alarm_actions = local.alarm_actions
  ok_actions    = local.ok_actions

  tags = {
    Name = "${var.project}-${var.environment}-ecs-running-tasks-low"
  }
}
