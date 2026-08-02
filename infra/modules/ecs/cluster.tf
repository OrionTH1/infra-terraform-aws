resource "aws_ecs_cluster" "this" {
  name = "${var.project}-${var.environment}"

  # "enabled" (standard) publishes ECS/ContainerInsights metrics per cluster/service/task
  # — the only one we actually need is RunningTaskCount. "enhanced" adds per-container
  # metrics, which with a single container per task are duplicates of the task-level ones
  # at ~5x the metric count. See ARCHITECTURE.md section 6 for the cost trade-off.
  setting {
    name  = "containerInsights"
    value = var.container_insights
  }

  tags = {
    Name = "${var.project}-${var.environment}-ecs-cluster"
  }
}
