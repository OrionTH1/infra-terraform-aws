variable "project" {
  type        = string
  description = "Project name, used in the Name tag of resources."
}

variable "environment" {
  type        = string
  description = "Environment (dev, staging, prod), used in the Name tag of resources."
}

variable "vpc_cidr" {
  type        = string
  description = "VPC CIDR block."
  default     = "10.0.0.0/16"
}

variable "public_subnet_cidrs" {
  type        = map(string)
  description = "Map of availability zone to CIDR block for each public subnet."

  default = {
    "us-east-1a" = "10.0.0.0/24"
    "us-east-1b" = "10.0.1.0/24"
  }
}
