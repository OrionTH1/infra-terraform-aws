locals {
  alarm_actions = [aws_sns_topic.alarms.arn]
  ok_actions    = [aws_sns_topic.alarms.arn]
}

resource "aws_cloudwatch_metric_alarm" "unhealthy_hosts" {
  alarm_name          = "${var.project}-${var.environment}-alb-unhealthy-hosts"
  alarm_description   = "One or more ECS tasks are failing the target group health check."
  namespace           = "AWS/ApplicationELB"
  metric_name         = "UnHealthyHostCount"
  statistic           = "Maximum"
  period              = 60
  evaluation_periods  = 2
  threshold           = 0
  comparison_operator = "GreaterThanThreshold"
  treat_missing_data  = "notBreaching"

  dimensions = {
    LoadBalancer = var.alb_arn_suffix
    TargetGroup  = var.target_group_arn_suffix
  }

  alarm_actions = local.alarm_actions
  ok_actions    = local.ok_actions

  tags = {
    Name = "${var.project}-${var.environment}-alb-unhealthy-hosts"
  }
}

resource "aws_cloudwatch_metric_alarm" "no_healthy_hosts" {
  alarm_name          = "${var.project}-${var.environment}-alb-healthy-hosts-low"
  alarm_description   = "Fewer healthy targets than the autoscaling minimum — the service lost capacity."
  namespace           = "AWS/ApplicationELB"
  metric_name         = "HealthyHostCount"
  statistic           = "Minimum"
  period              = 60
  evaluation_periods  = 2
  threshold           = var.ecs_min_running_tasks
  comparison_operator = "LessThanThreshold"
  treat_missing_data  = "notBreaching"

  dimensions = {
    LoadBalancer = var.alb_arn_suffix
    TargetGroup  = var.target_group_arn_suffix
  }

  alarm_actions = local.alarm_actions
  ok_actions    = local.ok_actions

  tags = {
    Name = "${var.project}-${var.environment}-alb-healthy-hosts-low"
  }
}

resource "aws_cloudwatch_metric_alarm" "error_rate" {
  alarm_name          = "${var.project}-${var.environment}-alb-5xx-rate"
  alarm_description   = "5xx responses (ALB-generated + target-generated) exceeded ${var.error_rate_threshold_percent}% of requests."
  evaluation_periods  = 2
  threshold           = var.error_rate_threshold_percent
  comparison_operator = "GreaterThanThreshold"
  treat_missing_data  = "notBreaching"

  metric_query {
    id          = "e1"
    expression  = "IF(m1 >= ${var.error_rate_min_requests}, 100 * (FILL(m2,0) + FILL(m3,0)) / m1, 0)"
    label       = "5xx error rate (%)"
    return_data = true
  }

  metric_query {
    id = "m1"
    metric {
      metric_name = "RequestCount"
      namespace   = "AWS/ApplicationELB"
      period      = 300
      stat        = "Sum"
      dimensions  = { LoadBalancer = var.alb_arn_suffix }
    }
  }

  metric_query {
    id = "m2"
    metric {
      metric_name = "HTTPCode_ELB_5XX_Count"
      namespace   = "AWS/ApplicationELB"
      period      = 300
      stat        = "Sum"
      dimensions  = { LoadBalancer = var.alb_arn_suffix }
    }
  }

  metric_query {
    id = "m3"
    metric {
      metric_name = "HTTPCode_Target_5XX_Count"
      namespace   = "AWS/ApplicationELB"
      period      = 300
      stat        = "Sum"
      dimensions  = { LoadBalancer = var.alb_arn_suffix }
    }
  }

  alarm_actions = local.alarm_actions
  ok_actions    = local.ok_actions

  tags = {
    Name = "${var.project}-${var.environment}-alb-5xx-rate"
  }
}

resource "aws_cloudwatch_metric_alarm" "latency_p99" {
  alarm_name          = "${var.project}-${var.environment}-alb-latency-p99"
  alarm_description   = "p99 target response time above ${var.latency_p99_threshold_seconds}s."
  namespace           = "AWS/ApplicationELB"
  metric_name         = "TargetResponseTime"
  extended_statistic  = "p99"
  period              = 300
  evaluation_periods  = 3
  threshold           = var.latency_p99_threshold_seconds
  comparison_operator = "GreaterThanThreshold"
  treat_missing_data  = "notBreaching"

  dimensions = {
    LoadBalancer = var.alb_arn_suffix
    TargetGroup  = var.target_group_arn_suffix
  }

  alarm_actions = local.alarm_actions
  ok_actions    = local.ok_actions

  tags = {
    Name = "${var.project}-${var.environment}-alb-latency-p99"
  }
}
