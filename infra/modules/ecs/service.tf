resource "aws_ecs_service" "backend" {
  name            = "${var.project}-${var.environment}-backend"
  cluster         = aws_ecs_cluster.this.id
  task_definition = aws_ecs_task_definition.backend.arn
  desired_count   = var.desired_count
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = var.private_subnet_ids
    security_groups  = [var.ecs_security_group_id]
    assign_public_ip = false
  }

  load_balancer {
    target_group_arn = var.target_group_arn
    container_name   = local.container_name
    container_port   = var.app_port
  }

  # Without this, a deployment with a broken image or a failing health check loops
  # forever creating and killing tasks, silently. With it, ECS gives up and rolls
  # back to the last COMPLETED deployment.
  deployment_circuit_breaker {
    enable   = var.enable_deployment_circuit_breaker
    rollback = var.enable_deployment_circuit_breaker
  }

  depends_on = [
    var.alb_listener_arn,
    aws_iam_role_policy.execution_ecr_pull,
    aws_iam_role_policy.execution_logs,
    aws_iam_role_policy.execution_db_secret,
  ]

  lifecycle {
    ignore_changes = [desired_count, task_definition]
  }

  tags = {
    Name = "${var.project}-${var.environment}-ecs-service"
  }
}
