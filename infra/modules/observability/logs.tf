resource "aws_cloudwatch_log_metric_filter" "app_errors" {
  name           = "${var.project}-${var.environment}-app-errors"
  log_group_name = var.log_group_name
  pattern        = "{ $.level >= 50 }"

  metric_transformation {
    name          = "ApplicationErrorCount"
    namespace     = "${var.project}/${var.environment}"
    value         = "1"
    default_value = "0"
    unit          = "Count"
  }
}

resource "aws_cloudwatch_metric_alarm" "app_errors" {
  alarm_name          = "${var.project}-${var.environment}-app-errors"
  alarm_description   = "More than ${var.app_error_threshold} application error log lines in 5 minutes."
  namespace           = "${var.project}/${var.environment}"
  metric_name         = aws_cloudwatch_log_metric_filter.app_errors.metric_transformation[0].name
  statistic           = "Sum"
  period              = 300
  evaluation_periods  = 1
  threshold           = var.app_error_threshold
  comparison_operator = "GreaterThanThreshold"
  treat_missing_data  = "notBreaching"

  alarm_actions = local.alarm_actions
  ok_actions    = local.ok_actions

  tags = {
    Name = "${var.project}-${var.environment}-app-errors"
  }
}

resource "aws_cloudwatch_query_definition" "recent_errors" {
  name            = "${var.project}-${var.environment}/recent-errors"
  log_group_names = [var.log_group_name]

  query_string = <<-EOT
    fields @timestamp, level, msg, err.message, err.stack
    | filter level >= 50
    | sort @timestamp desc
    | limit 50
  EOT
}

resource "aws_cloudwatch_query_definition" "slow_requests" {
  name            = "${var.project}-${var.environment}/slow-requests"
  log_group_names = [var.log_group_name]

  query_string = <<-EOT
    fields @timestamp, msg, responseTimeMs, req.method, req.url, res.statusCode
    | filter ispresent(responseTimeMs)
    | sort responseTimeMs desc
    | limit 50
  EOT
}

resource "aws_cloudwatch_query_definition" "requests_by_status" {
  name            = "${var.project}-${var.environment}/requests-by-status"
  log_group_names = [var.log_group_name]

  query_string = <<-EOT
    fields @timestamp, res.statusCode
    | filter ispresent(res.statusCode)
    | stats count() as requests by res.statusCode
    | sort requests desc
  EOT
}
