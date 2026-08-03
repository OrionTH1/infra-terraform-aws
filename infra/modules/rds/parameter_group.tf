# Without a parameter group, slow queries are invisible: Postgres logs nothing about
# statement duration by default, so "the API got slow" has no evidence trail on the
# database side. These settings send that evidence to CloudWatch Logs, which the
# cluster's enabled_cloudwatch_logs_exports already ships.
resource "aws_rds_cluster_parameter_group" "this" {
  name        = "${var.project}-${var.environment}-aurora-pg"
  family      = data.aws_rds_engine_version.postgresql.parameter_group_family
  description = "Query and connection logging for ${var.project}-${var.environment}"

  parameter {
    name  = "log_min_duration_statement"
    value = var.log_min_duration_statement_ms
  }

  # "ddl" audits schema changes (CREATE/ALTER/DROP) without the volume — and cost — of
  # "all", which logs every single statement including the health check's SELECT 1.
  parameter {
    name  = "log_statement"
    value = var.log_statement
  }

  # Logging connects/disconnects makes connection-leak investigations possible —
  # the same failure the DatabaseConnections alarm watches for.
  parameter {
    name  = "log_connections"
    value = "1"
  }

  parameter {
    name  = "log_disconnections"
    value = "1"
  }

  tags = {
    Name = "${var.project}-${var.environment}-aurora-pg"
  }
}
