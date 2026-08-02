resource "aws_rds_cluster_instance" "this" {
  count = var.instance_count

  identifier         = "${var.project}-${var.environment}-aurora-${count.index}"
  cluster_identifier = aws_rds_cluster.this.id
  instance_class     = "db.serverless"
  engine             = aws_rds_cluster.this.engine
  engine_version     = aws_rds_cluster.this.engine_version

  tags = {
    Name = "${var.project}-${var.environment}-aurora-${count.index}"
  }
}
