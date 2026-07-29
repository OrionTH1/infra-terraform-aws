terraform {
  backend "s3" {
    bucket       = "ecs-portfolio-tfstate-b41d7649"
    key          = "dev/terraform.tfstate"
    region       = "us-east-1"
    use_lockfile = true
    encrypt      = true
  }
}
