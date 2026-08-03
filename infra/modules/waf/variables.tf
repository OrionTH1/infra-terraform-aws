variable "project" {
  type        = string
  description = "Project name, used in resource names and tags."
}

variable "environment" {
  type        = string
  description = "Environment (dev, staging, prod), used in resource names and tags."
}

variable "alb_arn" {
  type        = string
  description = "ARN of the ALB the Web ACL is associated with. Comes from module.alb.alb_arn."
}

variable "managed_rule_groups" {
  type = list(object({
    name     = string
    priority = number
    # true = count only (observe without blocking), false = enforce the group's actions.
    count_only = bool
  }))
  description = "AWS managed rule groups to attach, in priority order. Start every new group in count mode, review the sampled requests in CloudWatch, then flip to blocking — a miscalibrated WAF breaks production traffic silently."

  default = [
    { name = "AWSManagedRulesAmazonIpReputationList", priority = 1, count_only = false },
    { name = "AWSManagedRulesKnownBadInputsRuleSet", priority = 2, count_only = false },
    { name = "AWSManagedRulesCommonRuleSet", priority = 3, count_only = true },
    { name = "AWSManagedRulesSQLiRuleSet", priority = 4, count_only = true },
  ]
}

variable "rate_limit_per_5min" {
  type        = number
  description = "Requests per 5 minutes from a single IP before it is blocked. Rate limiting is the most effective protection for a public endpoint and costs nothing beyond the rule itself."
  default     = 2000
}

variable "log_retention_days" {
  type        = number
  description = "Retention for the WAF log group. WAF logging is charged per GB ingested."
  default     = 7
}

variable "enable_logging" {
  type        = bool
  description = "Whether to ship WAF logs to CloudWatch. Useful while calibrating count-mode rules; can be turned off once rules are settled to save ingestion cost."
  default     = true
}
