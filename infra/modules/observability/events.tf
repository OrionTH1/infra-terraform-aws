# Deployment failures have no CloudWatch metric — ECS only emits them as EventBridge
# events. Without this rule, a rolled-back deployment is silent: the circuit breaker
# reverts to the previous version and nobody finds out until someone wonders why their
# change never went live.
resource "aws_cloudwatch_event_rule" "deployment_failed" {
  name        = "${var.project}-${var.environment}-ecs-deployment-failed"
  description = "ECS deployment failed or was rolled back by the circuit breaker."

  event_pattern = jsonencode({
    source        = ["aws.ecs"]
    "detail-type" = ["ECS Deployment State Change"]
    resources     = [var.ecs_service_arn]
    detail = {
      eventName = ["SERVICE_DEPLOYMENT_FAILED"]
    }
  })

  tags = {
    Name = "${var.project}-${var.environment}-ecs-deployment-failed"
  }
}

resource "aws_cloudwatch_event_target" "deployment_failed_sns" {
  rule      = aws_cloudwatch_event_rule.deployment_failed.name
  target_id = "SendToSNS"
  arn       = aws_sns_topic.alarms.arn
}

# Task placement failures (no capacity, subnet/ENI limits, image pull problems) are also
# events rather than metrics, and they explain *why* a deployment is stuck.
resource "aws_cloudwatch_event_rule" "task_placement_failed" {
  name        = "${var.project}-${var.environment}-ecs-task-placement-failed"
  description = "ECS could not place a task (capacity, networking or image pull failure)."

  event_pattern = jsonencode({
    source        = ["aws.ecs"]
    "detail-type" = ["ECS Service Action"]
    resources     = [var.ecs_service_arn]
    detail = {
      eventName = ["SERVICE_TASK_PLACEMENT_FAILURE"]
    }
  })

  tags = {
    Name = "${var.project}-${var.environment}-ecs-task-placement-failed"
  }
}

resource "aws_cloudwatch_event_target" "task_placement_failed_sns" {
  rule      = aws_cloudwatch_event_rule.task_placement_failed.name
  target_id = "SendToSNS"
  arn       = aws_sns_topic.alarms.arn
}
