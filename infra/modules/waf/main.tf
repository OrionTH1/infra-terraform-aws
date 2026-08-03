resource "aws_wafv2_web_acl" "this" {
  name        = "${var.project}-${var.environment}"
  description = "Baseline managed rules + per-IP rate limiting for the public ALB."
  scope       = "REGIONAL" # ALB is regional; CLOUDFRONT would be a different scope and association

  default_action {
    allow {}
  }

  # Rate limiting comes first, on purpose: it is the cheapest rule to evaluate and
  # protects against the thing that actually happens to a public endpoint — a single
  # source hammering it — regardless of whether the payload matches any signature.
  rule {
    name     = "rate-limit-per-ip"
    priority = 0

    action {
      block {}
    }

    statement {
      rate_based_statement {
        limit              = var.rate_limit_per_5min
        aggregate_key_type = "IP"
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "${var.project}-${var.environment}-rate-limit"
      sampled_requests_enabled   = true
    }
  }

  dynamic "rule" {
    for_each = var.managed_rule_groups

    content {
      name     = rule.value.name
      priority = rule.value.priority

      # count {} evaluates the group and records matches without blocking anything;
      # none {} lets the group's own actions (mostly block) take effect.
      override_action {
        dynamic "count" {
          for_each = rule.value.count_only ? [1] : []
          content {}
        }
        dynamic "none" {
          for_each = rule.value.count_only ? [] : [1]
          content {}
        }
      }

      statement {
        managed_rule_group_statement {
          name        = rule.value.name
          vendor_name = "AWS"
        }
      }

      visibility_config {
        cloudwatch_metrics_enabled = true
        metric_name                = replace(rule.value.name, "AWSManagedRules", "")
        # Keeps a sample of matched requests so count-mode rules can be reviewed
        # before being switched to blocking.
        sampled_requests_enabled = true
      }
    }
  }

  visibility_config {
    cloudwatch_metrics_enabled = true
    metric_name                = "${var.project}-${var.environment}-waf"
    sampled_requests_enabled   = true
  }

  tags = {
    Name = "${var.project}-${var.environment}-waf"
  }
}

resource "aws_wafv2_web_acl_association" "alb" {
  resource_arn = var.alb_arn
  web_acl_arn  = aws_wafv2_web_acl.this.arn
}

# WAF requires the log group name to start with "aws-waf-logs-".
resource "aws_cloudwatch_log_group" "waf" {
  # checkov:skip=CKV_AWS_158:Uses the default CloudWatch Logs encryption. WAF logs here contain no secrets — authorization and cookie headers are redacted below.
  count = var.enable_logging ? 1 : 0

  name              = "aws-waf-logs-${var.project}-${var.environment}"
  retention_in_days = var.log_retention_days

  tags = {
    Name = "aws-waf-logs-${var.project}-${var.environment}"
  }
}

resource "aws_wafv2_web_acl_logging_configuration" "this" {
  count = var.enable_logging ? 1 : 0

  resource_arn            = aws_wafv2_web_acl.this.arn
  log_destination_configs = [aws_cloudwatch_log_group.waf[0].arn]

  # Authorization headers would otherwise be written to logs in plaintext.
  redacted_fields {
    single_header {
      name = "authorization"
    }
  }

  redacted_fields {
    single_header {
      name = "cookie"
    }
  }
}
