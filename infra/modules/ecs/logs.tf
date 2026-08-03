resource "aws_cloudwatch_log_group" "backend" {
  # checkov:skip=CKV_AWS_158:Default CloudWatch Logs encryption. Application logs here are structured request records with no credentials; a CMK would add cost and key administration for no threat this project faces.
  name              = "/ecs/${var.project}-${var.environment}"
  retention_in_days = var.log_retention_days

  tags = {
    Name = "${var.project}-${var.environment}-ecs-logs"
  }
}

data "aws_iam_policy_document" "execution_logs" {
  statement {
    actions = [
      "logs:CreateLogStream",
      "logs:PutLogEvents",
    ]
    resources = ["${aws_cloudwatch_log_group.backend.arn}:*"]
  }
}

resource "aws_iam_role_policy" "execution_logs" {
  name   = "cloudwatch-logs"
  role   = aws_iam_role.execution.id
  policy = data.aws_iam_policy_document.execution_logs.json
}
