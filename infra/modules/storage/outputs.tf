output "input_bucket_name" {
  description = "Nombre del bucket S3 donde se cargarán los CSV."
  value       = aws_s3_bucket.input.bucket
}

output "input_bucket_arn" {
  description = "ARN del bucket S3 de entrada."
  value       = aws_s3_bucket.input.arn
}

output "results_table_name" {
  description = "Nombre de la tabla DynamoDB de resultados."
  value       = aws_dynamodb_table.results.name
}

output "results_table_arn" {
  description = "ARN de la tabla DynamoDB de resultados."
  value       = aws_dynamodb_table.results.arn
}

output "processor_dlq_name" {
  description = "Nombre de la cola SQS DLQ."
  value       = aws_sqs_queue.processor_dlq.name
}

output "processor_dlq_arn" {
  description = "ARN de la cola SQS DLQ."
  value       = aws_sqs_queue.processor_dlq.arn
}

output "processor_dlq_url" {
  description = "URL de la cola SQS DLQ."
  value       = aws_sqs_queue.processor_dlq.url
}
