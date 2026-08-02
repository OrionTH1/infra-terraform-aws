data "aws_iam_policy_document" "apply_assume_role" {
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
      values   = ["repo:${var.github_repository}:environment:${var.github_environment}"]
    }
  }
}

resource "aws_iam_role" "apply" {
  name               = "${var.project}-${var.environment}-gha-apply"
  assume_role_policy = data.aws_iam_policy_document.apply_assume_role.json

  tags = {
    Name = "${var.project}-${var.environment}-gha-apply"
  }
}

data "aws_iam_policy_document" "apply_permissions" {
  statement {
    sid = "ManageProjectServices"
    actions = [
      "ec2:*",
      "elasticloadbalancing:*",
      "ecs:*",
      "ecr:*",
      "rds:*",
      "application-autoscaling:*",
      "logs:*",
      "secretsmanager:*",
      "cloudwatch:*",
    ]
    resources = ["*"]
  }

  statement {
    sid = "ManageProjectIamRoles"
    actions = [
      "iam:CreateRole",
      "iam:DeleteRole",
      "iam:GetRole",
      "iam:ListRolePolicies",
      "iam:ListAttachedRolePolicies",
      "iam:TagRole",
      "iam:UntagRole",
      "iam:PutRolePolicy",
      "iam:DeleteRolePolicy",
      "iam:GetRolePolicy",
      "iam:AttachRolePolicy",
      "iam:DetachRolePolicy",
      "iam:PassRole",
    ]
    resources = ["arn:aws:iam::*:role/${var.project}-*"]
  }

  statement {
    sid       = "ReadWriteState"
    actions   = ["s3:GetObject", "s3:PutObject"]
    resources = ["${var.state_bucket_arn}/${var.state_key}"]
  }

  statement {
    sid       = "StateLockDuringApply"
    actions   = ["s3:GetObject", "s3:PutObject", "s3:DeleteObject"]
    resources = ["${var.state_bucket_arn}/${var.state_key}.tflock"]
  }

  statement {
    sid       = "ListStateBucket"
    actions   = ["s3:ListBucket"]
    resources = [var.state_bucket_arn]
  }
}

resource "aws_iam_role_policy" "apply_permissions" {
  name   = "apply-read-write"
  role   = aws_iam_role.apply.id
  policy = data.aws_iam_policy_document.apply_permissions.json
}
