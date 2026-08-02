output "cluster_identifier" {
  description = "Identifier of the Aurora cluster, used as the DBClusterIdentifier dimension in CloudWatch metrics."
  value       = aws_rds_cluster.this.cluster_identifier
}

output "cluster_endpoint" {
  description = "Writer endpoint of the Aurora cluster. Use this for all writes (INSERT/UPDATE/DELETE) and for reads when read-after-write consistency matters."
  value       = aws_rds_cluster.this.endpoint
}

output "cluster_reader_endpoint" {
  description = "Reader endpoint of the Aurora cluster. Automatically load-balances across reader instances — use this for read-only queries that can tolerate replication lag."
  value       = aws_rds_cluster.this.reader_endpoint
}

output "cluster_port" {
  description = "Port the Aurora cluster listens on."
  value       = aws_rds_cluster.this.port
}

output "database_name" {
  description = "Name of the initial database created in the cluster."
  value       = aws_rds_cluster.this.database_name
}

output "master_user_secret_arn" {
  description = "ARN of the Secrets Manager secret holding the master user credentials. The ECS task role will need secretsmanager:GetSecretValue on this ARN to connect (Fase 4)."
  value       = aws_rds_cluster.this.master_user_secret[0].secret_arn
}
