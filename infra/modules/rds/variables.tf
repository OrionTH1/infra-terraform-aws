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

variable "rds_security_group_id" {
  type        = string
  description = "ID of the security group attached to the Aurora cluster. Comes from module.network.rds_security_group_id."
}

variable "database_name" {
  type        = string
  description = "Name of the initial database created in the cluster."
  default     = "appdb"
}

variable "master_username" {
  type        = string
  description = "Master username. The password is generated and rotated by RDS through Secrets Manager."
  default     = "dbadmin"
}

variable "min_capacity_acu" {
  type        = number
  description = "Minimum Aurora Capacity Units per instance. 0 turns on auto-pause, which AWS scopes to dev and test workloads: a paused cluster takes about 15 seconds to accept the next connection."
  default     = 0.5
}

variable "max_capacity_acu" {
  type        = number
  description = "Maximum Aurora Capacity Units per instance. Sized so the writer alone can absorb the full read and write load at the ECS ceiling if the replica is lost."
  default     = 4
}

variable "backup_retention_days" {
  type        = number
  description = "Number of days to retain automated backups."
  default     = 7
}

variable "deletion_protection" {
  type        = bool
  description = "Whether to block deletion of the cluster."
  default     = false
}

variable "skip_final_snapshot" {
  type        = bool
  description = "Whether to skip the final snapshot when the cluster is destroyed."
  default     = true
}

variable "log_statement" {
  type        = string
  description = "Which statements Postgres logs: \"none\", \"ddl\" (schema changes), \"mod\" (writes) or \"all\"."
  default     = "ddl"
}

variable "log_min_duration_statement_ms" {
  type        = string
  description = "Log any statement slower than this many milliseconds. \"-1\" disables it; \"0\" logs everything (do not use outside debugging)."
  default     = "1000"
}

variable "enabled_log_exports" {
  type        = list(string)
  description = "Database log types exported to CloudWatch Logs. Charged per GB ingested, so keep the list minimal."
  default     = ["postgresql"]
}

variable "instance_count" {
  type        = number
  description = "Number of cluster instances. The first is the writer; the rest are readers Aurora can promote on failover."
  default     = 2
}
