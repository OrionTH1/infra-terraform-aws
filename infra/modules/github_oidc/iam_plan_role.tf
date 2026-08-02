data "aws_iam_policy_document" "plan_assume_role" {
  statement {
    actions = ["sts:AssumeRoleWithWebIdentity"]

    principals {
      type        = "Federated"
      identifiers = [aws_iam_openid_connect_provider.github.arn]
    }

    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:aud"
      values   = ["sts.amazonaws.com"]
    }

    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:sub"
      values   = ["repo:${var.github_repository}:pull_request"]
    }
  }
}

resource "aws_iam_role" "plan" {
  name               = "${var.project}-${var.environment}-gha-plan"
  assume_role_policy = data.aws_iam_policy_document.plan_assume_role.json

  tags = {
    Name = "${var.project}-${var.environment}-gha-plan"
  }
}

data "aws_iam_policy_document" "plan_permissions" {
  statement {
    sid = "ReadOnlyDescribeProjectServices"
    actions = [
      "ec2:Describe*",
      "ecs:Describe*",
      "ecs:List*",
      "elasticloadbalancing:Describe*",
      "rds:Describe*",
      "rds:List*",
      "ecr:Describe*",
      "ecr:GetRepositoryPolicy",
      "ecr:GetLifecyclePolicy",
      "iam:Get*",
      "iam:List*",
      "application-autoscaling:Describe*",
      "logs:Describe*",
      "logs:List*",
      "logs:GetLogGroupFields",
      "secretsmanager:Describe*",
      "secretsmanager:List*",
      "cloudwatch:Describe*",
      "cloudwatch:List*",
    ]
    resources = ["*"]
  }

  statement {
    sid       = "ReadState"
    actions   = ["s3:GetObject"]
    resources = ["${var.state_bucket_arn}/${var.state_key}"]
  }

  statement {
    sid       = "StateLockDuringPlan"
    actions   = ["s3:GetObject", "s3:PutObject", "s3:DeleteObject"]
    resources = ["${var.state_bucket_arn}/${var.state_key}.tflock"]
  }

  statement {
    sid       = "ListStateBucket"
    actions   = ["s3:ListBucket"]
    resources = [var.state_bucket_arn]
  }
}

resource "aws_iam_role_policy" "plan_permissions" {
  name   = "plan-read-only"
  role   = aws_iam_role.plan.id
  policy = data.aws_iam_policy_document.plan_permissions.json
}
