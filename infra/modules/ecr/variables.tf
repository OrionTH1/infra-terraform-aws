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
  description = "Whether to allow deleting the repository even if it still contains images. Keep true in dev (frequent destroy/apply cycles with manually pushed images); set false in prod to avoid accidentally wiping image history."
  default     = true
}
