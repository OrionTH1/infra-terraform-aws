terraform {
  backend "s3" {
    bucket       = "ecs-portfolio-tfstate-<ACCOUNT_ID>"
    key          = "dev/terraform.tfstate"
    region       = "us-east-1"
    use_lockfile = true
    encrypt      = true
  }
}
