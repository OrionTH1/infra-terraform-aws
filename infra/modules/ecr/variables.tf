variable "project" {
  type        = string
  description = "Project name, used in the repository name."
}

variable "environment" {
  type        = string
  description = "Environment (dev, staging, prod), used in the repository name."
}

variable "force_delete" {
  type        = bool
  description = "Whether to allow deleting the repository while it still contains images."
  default     = true
}
