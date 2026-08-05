resource "aws_ecs_cluster" "this" {
  name = "${var.project}-${var.environment}"

  setting {
    name  = "containerInsights"
    value = var.container_insights
  }

  tags = {
    Name = "${var.project}-${var.environment}-ecs-cluster"
  }
}
