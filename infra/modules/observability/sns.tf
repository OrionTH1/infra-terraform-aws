resource "aws_sns_topic" "alarms" {
  name              = "${var.project}-${var.environment}-alarms"
  kms_master_key_id = "alias/aws/sns"

  tags = {
    Name = "${var.project}-${var.environment}-alarms"
  }
}

# Email subscriptions land in "PendingConfirmation" until the recipient clicks the link
# AWS sends. Terraform cannot confirm it, and an unconfirmed subscription cannot be
# deleted by Terraform either (it is removed from state but lingers in AWS).
resource "aws_sns_topic_subscription" "alarms_email" {
  count = var.alarm_email == "" ? 0 : 1

  topic_arn = aws_sns_topic.alarms.arn
  protocol  = "email"
  endpoint  = var.alarm_email
}

data "aws_iam_policy_document" "alarms_topic" {
  statement {
    sid     = "AllowEventBridgePublish"
    effect  = "Allow"
    actions = ["SNS:Publish"]

    principals {
      type        = "Service"
      identifiers = ["events.amazonaws.com"]
    }

    resources = [aws_sns_topic.alarms.arn]
  }

  statement {
    sid     = "AllowCloudWatchAlarmsPublish"
    effect  = "Allow"
    actions = ["SNS:Publish"]

    principals {
      type        = "Service"
      identifiers = ["cloudwatch.amazonaws.com"]
    }

    resources = [aws_sns_topic.alarms.arn]
  }
}

resource "aws_sns_topic_policy" "alarms" {
  arn    = aws_sns_topic.alarms.arn
  policy = data.aws_iam_policy_document.alarms_topic.json
}
