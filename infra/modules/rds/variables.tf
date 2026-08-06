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
  description = "Master username. The password itself is never set here — it's managed entirely by RDS via Secrets Manager (manage_master_user_password)."
  default     = "dbadmin"
}

variable "min_capacity_acu" {
  type        = number
  description = "Minimum Aurora Capacity Units. 0 enables auto-pause after seconds_until_auto_pause of inactivity — the closest thing to 'scale to zero' Aurora Serverless v2 offers."
  default     = 0
}

variable "max_capacity_acu" {
  type        = number
  description = "Maximum Aurora Capacity Units each instance can scale up to. In normal operation the application splits reads to the reader endpoint and writes to the writer, so at the ECS ceiling of 10,000 requests per minute the writer needs about 1 ACU and the reader about 2.5. What sizes this ceiling is losing the replica: every read falls back to the writer, which then needs roughly 3 ACUs to absorb the whole load on its own. Four leaves one scaling step of headroom above that case while still capping a runaway. Note that a promotion tier 0 reader mirrors the writer capacity, so the cluster bills roughly twice the writer figure when busy."
  default     = 4
}

variable "seconds_until_auto_pause" {
  type        = number
  description = "Seconds of inactivity before the cluster auto-pauses. Only takes effect when min_capacity_acu is 0."
  default     = 3600
}

variable "backup_retention_days" {
  type        = number
  description = "Number of days to retain automated backups."
  default     = 7
}

variable "deletion_protection" {
  type        = bool
  description = "Whether to enable deletion protection on the cluster. Keep false in dev (iterating on apply/destroy); set true in prod."
  default     = false
}

variable "skip_final_snapshot" {
  type        = bool
  description = "Whether to skip taking a final snapshot on destroy. Keep true in dev for fast, clean teardown; set false in prod."
  default     = true
}

variable "log_statement" {
  type        = string
  description = "Which statements Postgres logs: \"none\", \"ddl\" (schema changes), \"mod\" (writes) or \"all\". \"all\" would log every health-check query."
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
  description = "Number of cluster instances. The first one created becomes the writer automatically; any additional ones are readers that Aurora can promote on failover. 1 = no automatic failover; 2+ = real HA."
  default     = 2
}
