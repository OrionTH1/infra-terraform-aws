data "aws_iam_policy_document" "apply_boundary" {
  # checkov:skip=CKV_AWS_1:See above — this is a boundary, not an identity policy.
  # checkov:skip=CKV_AWS_49:See above.
  # checkov:skip=CKV_AWS_111:See above.
  # checkov:skip=CKV_AWS_109:See above.
  # checkov:skip=CKV_AWS_356:See above.
  # checkov:skip=CKV2_AWS_40:See above.
  statement {
    sid       = "AllowServicesInScope"
    effect    = "Allow"
    actions   = ["*"]
    resources = ["*"]
  }

  statement {
    sid    = "DenyIdentityCreation"
    effect = "Deny"
    actions = [
      "iam:CreateUser",
      "iam:CreateAccessKey",
      "iam:CreateLoginProfile",
      "iam:UpdateLoginProfile",
      "iam:CreateSAMLProvider",
      "iam:UpdateSAMLProvider",
      "iam:DeleteUserPermissionsBoundary",
      "iam:DeleteRolePermissionsBoundary",
    ]
    resources = ["*"]
  }

  statement {
    sid    = "DenyAccountLevelChanges"
    effect = "Deny"
    actions = [
      "organizations:*",
      "account:*",
      "aws-portal:*",
      "budgets:*",
      "iam:DeleteAccountPasswordPolicy",
    ]
    resources = ["*"]
  }

  statement {
    sid    = "DenyStateBucketDestruction"
    effect = "Deny"
    actions = [
      "s3:DeleteBucket",
      "s3:PutBucketPolicy",
      "s3:PutBucketVersioning",
    ]
    resources = [var.state_bucket_arn]
  }

  statement {
    sid       = "DenyOutsideHomeRegion"
    effect    = "Deny"
    actions   = ["*"]
    resources = ["*"]

    condition {
      test     = "StringNotEquals"
      variable = "aws:RequestedRegion"
      values   = [data.aws_region.current.region]
    }

    not_actions = [
      "iam:*",
      "sts:*",
      "route53:*",
      "route53domains:*",
      "cloudfront:*",
      "s3:ListAllMyBuckets",
    ]
  }
}

resource "aws_iam_policy" "apply_boundary" {
  name        = "${var.project}-${var.environment}-gha-apply-boundary"
  description = "Permissions boundary capping the maximum reach of the Terraform apply role."
  policy      = data.aws_iam_policy_document.apply_boundary.json

  tags = {
    Name = "${var.project}-${var.environment}-gha-apply-boundary"
  }
}
