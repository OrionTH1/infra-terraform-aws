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
  name                 = "${var.project}-${var.environment}-gha-apply"
  assume_role_policy   = data.aws_iam_policy_document.apply_assume_role.json
  permissions_boundary = aws_iam_policy.apply_boundary.arn

  tags = {
    Name = "${var.project}-${var.environment}-gha-apply"
  }
}

data "aws_iam_policy_document" "apply_permissions" {
  # Broad per-service access rather than a hand-enumerated action list: mapping every
  # API call Terraform makes across six modules is maintenance that goes stale on each
  # provider upgrade. The reach is capped two ways instead — the region condition below,
  # and the permissions boundary attached to this role (permissions_boundary.tf).
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
      "events:*",
      "sns:*",
      "wafv2:*",
    ]
    resources = ["*"]

    condition {
      test     = "StringEquals"
      variable = "aws:RequestedRegion"
      values   = [data.aws_region.current.region]
    }
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

  # Managing the OIDC provider and the customer-managed policies (including this role's
  # own permissions boundary) that this module creates.
  statement {
    sid = "ManageProjectIamPoliciesAndOidc"
    actions = [
      "iam:CreatePolicy",
      "iam:DeletePolicy",
      "iam:GetPolicy",
      "iam:GetPolicyVersion",
      "iam:ListPolicyVersions",
      "iam:CreatePolicyVersion",
      "iam:DeletePolicyVersion",
      "iam:TagPolicy",
      "iam:UntagPolicy",
      "iam:CreateOpenIDConnectProvider",
      "iam:DeleteOpenIDConnectProvider",
      "iam:GetOpenIDConnectProvider",
      "iam:TagOpenIDConnectProvider",
      "iam:UpdateOpenIDConnectProviderThumbprint",
    ]
    resources = [
      "arn:aws:iam::*:policy/${var.project}-*",
      "arn:aws:iam::*:oidc-provider/token.actions.githubusercontent.com",
    ]
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
