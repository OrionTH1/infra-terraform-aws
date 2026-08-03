data "aws_region" "current" {}

resource "aws_cloudwatch_dashboard" "main" {
  dashboard_name = "${var.project}-${var.environment}"

  dashboard_body = jsonencode({
    widgets = [
      {
        type   = "text"
        x      = 0
        y      = 0
        width  = 24
        height = 1
        properties = {
          markdown = "## ${var.project} — ${var.environment}"
        }
      },

      {
        type   = "metric"
        x      = 0
        y      = 1
        width  = 8
        height = 6
        properties = {
          title  = "Requests & 5xx"
          region = data.aws_region.current.region
          period = 300
          stat   = "Sum"
          metrics = [
            ["AWS/ApplicationELB", "RequestCount", "LoadBalancer", var.alb_arn_suffix, { label = "Requests" }],
            [".", "HTTPCode_ELB_5XX_Count", ".", ".", { label = "5xx (ALB)" }],
            [".", "HTTPCode_Target_5XX_Count", ".", ".", { label = "5xx (target)" }],
          ]
        }
      },
      {
        type   = "metric"
        x      = 8
        y      = 1
        width  = 8
        height = 6
        properties = {
          title  = "Target response time"
          region = data.aws_region.current.region
          period = 300
          metrics = [
            ["AWS/ApplicationELB", "TargetResponseTime", "LoadBalancer", var.alb_arn_suffix, "TargetGroup", var.target_group_arn_suffix, { stat = "p50", label = "p50" }],
            ["...", { stat = "p99", label = "p99" }],
          ]
          annotations = {
            horizontal = [{ label = "p99 alarm", value = var.latency_p99_threshold_seconds }]
          }
        }
      },
      {
        type   = "metric"
        x      = 16
        y      = 1
        width  = 8
        height = 6
        properties = {
          title  = "Healthy vs unhealthy targets"
          region = data.aws_region.current.region
          period = 60
          metrics = [
            ["AWS/ApplicationELB", "HealthyHostCount", "LoadBalancer", var.alb_arn_suffix, "TargetGroup", var.target_group_arn_suffix, { stat = "Minimum", label = "Healthy" }],
            [".", "UnHealthyHostCount", ".", ".", ".", ".", { stat = "Maximum", label = "Unhealthy" }],
          ]
        }
      },

      {
        type   = "metric"
        x      = 0
        y      = 7
        width  = 8
        height = 6
        properties = {
          title  = "ECS CPU & memory"
          region = data.aws_region.current.region
          period = 60
          stat   = "Average"
          metrics = [
            ["AWS/ECS", "CPUUtilization", "ClusterName", var.ecs_cluster_name, "ServiceName", var.ecs_service_name, { label = "CPU %" }],
            [".", "MemoryUtilization", ".", ".", ".", ".", { label = "Memory %" }],
          ]
          annotations = {
            horizontal = [
              { label = "CPU alarm", value = var.cpu_threshold_percent },
              { label = "Memory alarm", value = var.memory_threshold_percent },
            ]
          }
        }
      },
      {
        type   = "metric"
        x      = 8
        y      = 7
        width  = 8
        height = 6
        properties = {
          title  = "Task count (autoscaling)"
          region = data.aws_region.current.region
          period = 60
          stat   = "Average"
          metrics = var.container_insights_enabled ? [
            ["ECS/ContainerInsights", "RunningTaskCount", "ClusterName", var.ecs_cluster_name, "ServiceName", var.ecs_service_name, { label = "Running" }],
            [".", "DesiredTaskCount", ".", ".", ".", ".", { label = "Desired" }],
            [".", "PendingTaskCount", ".", ".", ".", ".", { label = "Pending" }],
            ] : [
            ["AWS/ApplicationELB", "HealthyHostCount", "LoadBalancer", var.alb_arn_suffix, "TargetGroup", var.target_group_arn_suffix, { label = "Healthy targets" }],
          ]
        }
      },
      {
        type   = "metric"
        x      = 16
        y      = 7
        width  = 8
        height = 6
        properties = {
          title  = "Requests per target (autoscaling trigger)"
          region = data.aws_region.current.region
          period = 60
          stat   = "Sum"
          metrics = [
            ["AWS/ApplicationELB", "RequestCountPerTarget", "TargetGroup", var.target_group_arn_suffix, { label = "Req/target" }],
          ]
        }
      },

      {
        type   = "metric"
        x      = 0
        y      = 13
        width  = 8
        height = 6
        properties = {
          title  = "Aurora capacity (ACU)"
          region = data.aws_region.current.region
          period = 60
          stat   = "Average"
          metrics = [
            ["AWS/RDS", "ServerlessDatabaseCapacity", "DBClusterIdentifier", var.db_cluster_identifier, { label = "ACUs in use" }],
          ]
        }
      },
      {
        type   = "metric"
        x      = 8
        y      = 13
        width  = 8
        height = 6
        properties = {
          title  = "Aurora connections"
          region = data.aws_region.current.region
          period = 60
          stat   = "Maximum"
          metrics = [
            ["AWS/RDS", "DatabaseConnections", "DBClusterIdentifier", var.db_cluster_identifier, { label = "Connections" }],
          ]
          annotations = {
            horizontal = [{ label = "Alarm", value = var.db_max_connections }]
          }
        }
      },
      {
        type   = "metric"
        x      = 16
        y      = 13
        width  = 8
        height = 6
        properties = {
          title  = "Application error logs"
          region = data.aws_region.current.region
          period = 300
          stat   = "Sum"
          metrics = [
            ["${var.project}/${var.environment}", "ApplicationErrorCount", { label = "Error log lines" }],
          ]
          annotations = {
            horizontal = [{ label = "Alarm", value = var.app_error_threshold }]
          }
        }
      },
    ]
  })
}
