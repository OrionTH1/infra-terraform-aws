resource "aws_lb" "this" {
  # checkov:skip=CKV2_AWS_20:HTTP-to-HTTPS redirect arrives with the HTTPS listener in Phase 5, which is paused until a domain is registered.
  # checkov:skip=CKV_AWS_150:Deletion protection is parameterised (var.enable_deletion_protection) and off in dev by design — this environment is destroyed between sessions to avoid cost.
  # checkov:skip=CKV2_AWS_28:WAF is attached from the waf module via aws_wafv2_web_acl_association, which Checkov's graph check does not follow across modules.
  # checkov:skip=CKV_AWS_91:Access logging deliberately deferred — see "Exceções de segurança aceitas" in ARCHITECTURE.md.
  name               = "${var.project}-${var.environment}-alb"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [var.alb_security_group_id]
  subnets            = var.public_subnet_ids

  desync_mitigation_mode     = "defensive"
  drop_invalid_header_fields = true

  enable_deletion_protection = var.enable_deletion_protection

  tags = {
    Name = "${var.project}-${var.environment}-alb"
  }
}

resource "aws_lb_target_group" "app" {
  # checkov:skip=CKV_AWS_378:HTTP between the ALB and tasks inside the VPC. End-user TLS terminates at the ALB and arrives with Phase 5; re-encrypting inside a private subnet is not warranted here.
  name        = "${var.project}-${var.environment}-tg"
  port        = var.app_port
  protocol    = "HTTP"
  vpc_id      = var.vpc_id
  target_type = "ip"

  load_balancing_algorithm_type = "least_outstanding_requests"

  health_check {
    path                = "/api/v1/health"
    protocol            = "HTTP"
    matcher             = "200"
    interval            = 30
    timeout             = 5
    healthy_threshold   = 2
    unhealthy_threshold = 3
  }

  tags = {
    Name = "${var.project}-${var.environment}-tg"
  }
}

resource "aws_lb_listener" "http" {
  # checkov:skip=CKV_AWS_2:HTTP-only until a domain is registered — the HTTPS listener + ACM certificate is Phase 5 of the roadmap, currently paused. Tracked in ARCHITECTURE.md.
  # checkov:skip=CKV_AWS_103:TLS policy is not applicable to an HTTP listener; it arrives with the HTTPS listener in Phase 5.
  load_balancer_arn = aws_lb.this.arn
  port              = 80
  protocol          = "HTTP"

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.app.arn
  }
}
