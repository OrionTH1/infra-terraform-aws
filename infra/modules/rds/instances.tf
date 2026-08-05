resource "aws_rds_cluster_instance" "this" {
  # checkov:skip=CKV_AWS_118:Enhanced Monitoring is billed per instance and overlaps with Performance Insights (enabled below, free at 7-day retention) plus the CloudWatch alarms in the observability module.
  # checkov:skip=CKV_AWS_354:Performance Insights uses the AWS-managed key. A CMK here would cost $1/month to protect 7 days of query statistics in a dev account.
  count = var.instance_count

  identifier         = "${var.project}-${var.environment}-aurora-${count.index}"
  cluster_identifier = aws_rds_cluster.this.id
  instance_class     = "db.serverless"
  engine             = aws_rds_cluster.this.engine
  engine_version     = aws_rds_cluster.this.engine_version

  performance_insights_enabled          = true
  performance_insights_retention_period = 7

  auto_minor_version_upgrade = true

  tags = {
    Name = "${var.project}-${var.environment}-aurora-${count.index}"
  }
}
