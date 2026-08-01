resource "aws_db_subnet_group" "this" {
  name       = "${var.project}-${var.environment}-db"
  subnet_ids = var.private_subnet_ids

  tags = {
    Name = "${var.project}-${var.environment}-db-subnet-group"
  }
}
