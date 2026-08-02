# Only one Aurora alarm, on purpose.
#
# The cluster runs with min_capacity = 0 (auto-pause), which means that when idle it
# stops publishing most metrics entirely — DatabaseConnections, FreeableMemory and
# friends simply disappear rather than reporting zero. Any alarm treating missing data
# as breaching would fire every single night. And ACUUtilization is useless here:
# max_capacity is 1 ACU by choice, so hitting 100% is the configuration working as
# intended, not an incident.
#
# What IS worth alarming on is connection count: a leak in the application's pg pool
# is a real, application-caused failure that this catches.
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
