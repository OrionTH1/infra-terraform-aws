data "aws_rds_engine_version" "postgresql" {
  engine = "aurora-postgresql"
}

resource "aws_rds_cluster" "this" {
  # checkov:skip=CKV_AWS_139:Deletion protection is parameterised (var.deletion_protection); false in dev by design, since this environment is destroyed between sessions. prod tfvars set it to true.
  # checkov:skip=CKV_AWS_327:Encryption uses the AWS-managed RDS key. A customer-managed KMS key adds $1/month plus key administration for no threat this project actually faces — the data is a health-check table in a single-account dev environment.
  # checkov:skip=CKV2_AWS_8:AWS Backup adds a second backup mechanism on top of backup_retention_period, which already provides point-in-time recovery. Redundant at this scale.
  cluster_identifier = "${var.project}-${var.environment}"
  engine             = "aurora-postgresql"
  engine_mode        = "provisioned"
  engine_version     = data.aws_rds_engine_version.postgresql.version

  database_name               = var.database_name
  master_username             = var.master_username
  manage_master_user_password = true

  iam_database_authentication_enabled = true

  db_subnet_group_name            = aws_db_subnet_group.this.name
  vpc_security_group_ids          = [var.rds_security_group_id]
  db_cluster_parameter_group_name = aws_rds_cluster_parameter_group.this.name

  storage_encrypted         = true
  backup_retention_period   = var.backup_retention_days
  deletion_protection       = var.deletion_protection
  skip_final_snapshot       = var.skip_final_snapshot
  final_snapshot_identifier = var.skip_final_snapshot ? null : "${var.project}-${var.environment}-final"
  copy_tags_to_snapshot     = true

  enabled_cloudwatch_logs_exports = var.enabled_log_exports

  serverlessv2_scaling_configuration {
    min_capacity             = var.min_capacity_acu
    max_capacity             = var.max_capacity_acu
    seconds_until_auto_pause = var.seconds_until_auto_pause
  }

  tags = {
    Name = "${var.project}-${var.environment}-aurora"
  }
}
