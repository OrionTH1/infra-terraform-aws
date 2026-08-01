variable "project" {
  type        = string
  description = "Project name, used in resource names and tags."
}

variable "environment" {
  type        = string
  description = "Environment (dev, staging, prod), used in resource names and tags."
}

variable "private_subnet_ids" {
  type        = list(string)
  description = "Private subnet IDs the DB subnet group is created from. Comes from module.network.private_subnet_ids. Must span at least 2 AZs."
}
