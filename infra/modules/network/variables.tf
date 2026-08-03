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

variable "private_subnet_cidrs" {
  type        = map(string)
  description = "Map of availability zone to CIDR block for each private subnet."

  default = {
    "us-east-1a" = "10.0.10.0/24"
    "us-east-1b" = "10.0.11.0/24"
  }
}

variable "enable_flow_logs" {
  type        = bool
  description = "Whether to capture VPC Flow Logs. These are what let you verify that the private subnets really have no path out, rather than taking it on faith."
  default     = true
}

variable "flow_logs_traffic_type" {
  type        = string
  description = "Which traffic to record: ACCEPT, REJECT or ALL. REJECT keeps ingestion cost low while still answering \"is anything trying to reach the internet from the private subnets?\"."
  default     = "REJECT"

  validation {
    condition     = contains(["ACCEPT", "REJECT", "ALL"], var.flow_logs_traffic_type)
    error_message = "flow_logs_traffic_type must be one of: ACCEPT, REJECT, ALL."
  }
}

variable "flow_logs_retention_days" {
  type        = number
  description = "Retention for the VPC Flow Logs log group."
  default     = 14
}

variable "app_port" {
  type        = number
  description = "Port the application container listens on, used by the ALB->ECS security group rules."
}
