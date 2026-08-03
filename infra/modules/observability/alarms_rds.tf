resource "aws_cloudwatch_metric_alarm" "db_connections_high" {
  alarm_name          = "${var.project}-${var.environment}-rds-connections-high"
  alarm_description   = "Aurora connection count above ${var.db_max_connections} — likely a connection leak in the application pool."
  namespace           = "AWS/RDS"
  metric_name         = "DatabaseConnections"
  statistic           = "Maximum"
  period              = 300
  evaluation_periods  = 2
  threshold           = var.db_max_connections
  comparison_operator = "GreaterThanThreshold"
  treat_missing_data  = "notBreaching"

  dimensions = {
    DBClusterIdentifier = var.db_cluster_identifier
  }

  alarm_actions = local.alarm_actions
  ok_actions    = local.ok_actions

  tags = {
    Name = "${var.project}-${var.environment}-rds-connections-high"
  }
}
