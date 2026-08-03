# Defence in depth for the apply role.
#
# The apply role's own policy grants broad per-service access (ec2:*, rds:*, ...) because
# enumerating every API call Terraform makes across six modules is maintenance work that
# goes stale on every provider upgrade. The boundary caps what that breadth can ever
# reach: even if the policy were widened by accident, nothing outside these limits is
# reachable, because effective permissions are the intersection of policy and boundary.
data "aws_iam_policy_document" "apply_boundary" {
  # The Allow "*" here is not a grant. A permissions boundary never gives permission —
  # effective access is the intersection of the boundary and the role's own policy. The
  # broad Allow exists so the Deny statements below define the ceiling; without it the
  # boundary would be an empty set and the role could do nothing at all.
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

  # Privilege escalation paths: creating a user or a long-lived access key would let a
  # compromised pipeline mint credentials that outlive the 1-hour OIDC session.
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

  # Account-level blast radius: nothing the pipeline does should touch billing,
  # organizations or the account itself.
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

  # The state bucket is deliberately not managed by Terraform (see infra/README.md).
  # This makes "not managed by Terraform" enforceable rather than a convention.
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

  # Everything this project builds lives in one region. This turns "wrong region" from
  # a possible incident into an impossible one — and blocks a common exfiltration
  # pattern of spinning resources up in an unmonitored region.
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

    # Global services are not region-scoped, so aws:RequestedRegion does not apply to
    # them — denying on it would break IAM (the roles this module manages), STS
    # (assuming the role at all) and Route53 (needed by the pending Phase 5 DNS work).
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
