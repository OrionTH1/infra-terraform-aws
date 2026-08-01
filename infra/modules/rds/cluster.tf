data "aws_rds_engine_version" "postgresql" {
  engine = "aurora-postgresql"
}

resource "aws_rds_cluster" "this" {
  cluster_identifier = "${var.project}-${var.environment}"
  engine             = "aurora-postgresql"
  engine_mode        = "provisioned"
  engine_version     = data.aws_rds_engine_version.postgresql.version

  database_name                = var.database_name
  master_username               = var.master_username
  manage_master_user_password = true

  db_subnet_group_name    = aws_db_subnet_group.this.name
  vpc_security_group_ids = [var.rds_security_group_id]

  storage_encrypted       = true
  backup_retention_period = var.backup_retention_days
  deletion_protection     = var.deletion_protection
  skip_final_snapshot     = var.skip_final_snapshot

  serverlessv2_scaling_configuration {
    min_capacity             = var.min_capacity_acu
    max_capacity             = var.max_capacity_acu
    seconds_until_auto_pause = var.seconds_until_auto_pause
  }

  tags = {
    Name = "${var.project}-${var.environment}-aurora"
  }
}
