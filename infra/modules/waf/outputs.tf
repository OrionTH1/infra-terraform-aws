output "web_acl_arn" {
  description = "ARN of the Web ACL associated with the ALB."
  value       = aws_wafv2_web_acl.this.arn
}

output "web_acl_name" {
  description = "Name of the Web ACL, used as the WebACL dimension in AWS/WAFV2 CloudWatch metrics."
  value       = aws_wafv2_web_acl.this.name
}
