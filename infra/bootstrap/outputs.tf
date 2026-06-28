output "tfstate_bucket_name" {
  description = "Nombre del bucket S3 usado para almacenar el estado remoto de Terraform."
  value       = aws_s3_bucket.tfstate.bucket
}

output "tf_lock_table_name" {
  description = "Nombre de la tabla DynamoDB usada para bloqueo del estado Terraform."
  value       = aws_dynamodb_table.tf_lock.name
}

output "backend_config" {
  description = "Bloque backend sugerido para infra/backend.tf."
  value       = <<EOT
terraform {
  backend "s3" {
    bucket         = "${aws_s3_bucket.tfstate.bucket}"
    key            = "datossur/dev/terraform.tfstate"
    region         = "${var.aws_region}"
    dynamodb_table = "${aws_dynamodb_table.tf_lock.name}"
    encrypt        = true
  }
}
EOT
}
