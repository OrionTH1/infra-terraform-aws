resource "aws_rds_cluster_parameter_group" "this" {
  name        = "${var.project}-${var.environment}-aurora-pg"
  family      = data.aws_rds_engine_version.postgresql.parameter_group_family
  description = "Query and connection logging for ${var.project}-${var.environment}"

  parameter {
    name  = "log_min_duration_statement"
    value = var.log_min_duration_statement_ms
  }

  parameter {
    name  = "log_statement"
    value = var.log_statement
  }

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
