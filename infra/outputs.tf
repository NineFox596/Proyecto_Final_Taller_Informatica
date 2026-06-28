output "input_bucket_name" {
  description = "Bucket S3 donde se cargan los archivos CSV."
  value       = module.storage.input_bucket_name
}

output "input_bucket_arn" {
  description = "ARN del bucket S3 de entrada."
  value       = module.storage.input_bucket_arn
}

output "results_table_name" {
  description = "Tabla DynamoDB donde se guardan los resultados."
  value       = module.storage.results_table_name
}

output "results_table_arn" {
  description = "ARN de la tabla DynamoDB de resultados."
  value       = module.storage.results_table_arn
}

output "processor_dlq_name" {
  description = "Nombre de la cola SQS DLQ de la Lambda procesadora."
  value       = module.storage.processor_dlq_name
}

output "processor_dlq_arn" {
  description = "ARN de la cola SQS DLQ de la Lambda procesadora."
  value       = module.storage.processor_dlq_arn
}

output "processor_lambda_name" {
  description = "Nombre de la Lambda procesadora de CSV."
  value       = module.processing.processor_lambda_name
}

output "processor_lambda_arn" {
  description = "ARN de la Lambda procesadora de CSV."
  value       = module.processing.processor_lambda_arn
}

output "processor_log_group_name" {
  description = "Log Group de CloudWatch de la Lambda procesadora."
  value       = module.processing.processor_log_group_name
}

output "api_endpoint" {
  description = "Endpoint público base de API Gateway HTTP API."
  value       = module.api.api_endpoint
}

output "api_id" {
  description = "ID de API Gateway HTTP API."
  value       = module.api.api_id
}

output "api_execution_arn" {
  description = "Execution ARN de API Gateway."
  value       = module.api.api_execution_arn
}

output "api_lambda_name" {
  description = "Nombre de la Lambda API."
  value       = module.api.api_lambda_name
}

output "api_lambda_arn" {
  description = "ARN de la Lambda API."
  value       = module.api.api_lambda_arn
}

output "api_log_group_name" {
  description = "Log Group de CloudWatch de la Lambda API."
  value       = module.api.api_log_group_name
}

output "frontend_bucket_name" {
  description = "Bucket privado del frontend estático."
  value       = module.frontend.frontend_bucket_name
}

output "cloudfront_distribution_id" {
  description = "ID de la distribución CloudFront."
  value       = module.frontend.cloudfront_distribution_id
}

output "cloudfront_domain_name" {
  description = "Dominio público de CloudFront."
  value       = module.frontend.cloudfront_domain_name
}

output "frontend_url" {
  description = "URL pública HTTPS del frontend DatosSur."
  value       = module.frontend.frontend_url
}

output "alerts_topic_arn" {
  description = "ARN del topic SNS de alertas."
  value       = module.monitoring.alerts_topic_arn
}

output "alerts_topic_name" {
  description = "Nombre del topic SNS de alertas."
  value       = module.monitoring.alerts_topic_name
}

output "processor_lambda_errors_alarm_name" {
  description = "Alarma de errores de la Lambda procesadora."
  value       = module.monitoring.processor_lambda_errors_alarm_name
}

output "api_lambda_errors_alarm_name" {
  description = "Alarma de errores de la Lambda API."
  value       = module.monitoring.api_lambda_errors_alarm_name
}

output "api_gateway_5xx_alarm_name" {
  description = "Alarma de errores 5XX de API Gateway."
  value       = module.monitoring.api_gateway_5xx_alarm_name
}

output "processor_dlq_alarm_name" {
  description = "Alarma de mensajes visibles en la DLQ."
  value       = module.monitoring.processor_dlq_alarm_name
}

output "budget_name" {
  description = "Nombre del AWS Budget mensual."
  value       = module.budget.budget_name
}

output "budget_limit_usd" {
  description = "Límite mensual del budget en USD."
  value       = module.budget.budget_limit_usd
}
