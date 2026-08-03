resource "aws_ecr_repository" "backend" {
  # checkov:skip=CKV_AWS_136:Uses AES-256 with the AWS-managed key. A CMK adds cost and key administration to protect a container image that is built from a public repository.
  name                 = "${var.project}-${var.environment}-backend"
  image_tag_mutability = "IMMUTABLE"
  force_delete         = var.force_delete

  image_scanning_configuration {
    scan_on_push = true
  }

  tags = {
    Name = "${var.project}-${var.environment}-backend"
  }
}

resource "aws_ecr_lifecycle_policy" "backend" {
  repository = aws_ecr_repository.backend.name

  policy = jsonencode({
    rules = [
      {
        rulePriority = 1
        description  = "Expire untagged images after 7 days"
        selection = {
          tagStatus   = "untagged"
          countType   = "sinceImagePushed"
          countUnit   = "days"
          countNumber = 7
        }
        action = {
          type = "expire"
        }
      },
      {
        rulePriority = 2
        description  = "Keep only the last 20 images"
        selection = {
          tagStatus   = "any"
          countType   = "imageCountMoreThan"
          countNumber = 20
        }
        action = {
          type = "expire"
        }
      }
    ]
  })
}
