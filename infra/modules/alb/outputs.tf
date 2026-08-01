output "alb_arn" {
  description = "ARN of the Application Load Balancer."
  value       = aws_lb.this.arn
}

output "alb_dns_name" {
  description = "DNS name of the ALB, used for testing or as the target of a Route53 alias record."
  value       = aws_lb.this.dns_name
}

output "alb_zone_id" {
  description = "Hosted zone ID of the ALB, required alongside alb_dns_name for a Route53 alias record."
  value       = aws_lb.this.zone_id
}

output "target_group_arn" {
  description = "ARN of the target group, consumed by the ECS service to register tasks."
  value       = aws_lb_target_group.app.arn
}

output "listener_arn" {
  description = "ARN of the HTTP listener. Not consumed directly, but passed to the ECS service as a depends_on target so it isn't created before the listener is actually forwarding traffic to the target group."
  value       = aws_lb_listener.http.arn
}
