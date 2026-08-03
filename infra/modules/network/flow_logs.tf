# Flow logs are what make the "no NAT, fully isolated private subnets" claim
# verifiable instead of just asserted: REJECT records show what tried to leave and
# was refused.
#
# traffic_type is parameterised because ALL is the honest default for an audit trail
# but multiplies ingestion cost; REJECT alone answers "is anything trying to escape?"
# at a fraction of the volume.
resource "aws_cloudwatch_log_group" "flow_logs" {
  # checkov:skip=CKV_AWS_158:Default CloudWatch Logs encryption. Flow logs contain IPs and ports, not secrets.
  count = var.enable_flow_logs ? 1 : 0

  name              = "/aws/vpc/${var.project}-${var.environment}"
  retention_in_days = var.flow_logs_retention_days

  tags = {
    Name = "${var.project}-${var.environment}-flow-logs"
  }
}

data "aws_iam_policy_document" "flow_logs_assume_role" {
  statement {
    actions = ["sts:AssumeRole"]

    principals {
      type        = "Service"
      identifiers = ["vpc-flow-logs.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "flow_logs" {
  count = var.enable_flow_logs ? 1 : 0

  name               = "${var.project}-${var.environment}-flow-logs"
  assume_role_policy = data.aws_iam_policy_document.flow_logs_assume_role.json

  tags = {
    Name = "${var.project}-${var.environment}-flow-logs"
  }
}

data "aws_iam_policy_document" "flow_logs" {
  count = var.enable_flow_logs ? 1 : 0

  statement {
    actions = [
      "logs:CreateLogStream",
      "logs:PutLogEvents",
      "logs:DescribeLogStreams",
    ]
    resources = ["${aws_cloudwatch_log_group.flow_logs[0].arn}:*"]
  }
}

resource "aws_iam_role_policy" "flow_logs" {
  count = var.enable_flow_logs ? 1 : 0

  name   = "flow-logs-write"
  role   = aws_iam_role.flow_logs[0].id
  policy = data.aws_iam_policy_document.flow_logs[0].json
}

resource "aws_flow_log" "this" {
  count = var.enable_flow_logs ? 1 : 0

  vpc_id                   = aws_vpc.this.id
  traffic_type             = var.flow_logs_traffic_type
  iam_role_arn             = aws_iam_role.flow_logs[0].arn
  log_destination_type     = "cloud-watch-logs"
  log_destination          = aws_cloudwatch_log_group.flow_logs[0].arn
  max_aggregation_interval = 600

  tags = {
    Name = "${var.project}-${var.environment}-flow-logs"
  }
}
