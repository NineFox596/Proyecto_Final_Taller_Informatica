output "alerts_topic_arn" {
  description = "ARN del topic SNS de alertas."
  value       = aws_sns_topic.alerts.arn
}

output "alerts_topic_name" {
  description = "Nombre del topic SNS de alertas."
  value       = aws_sns_topic.alerts.name
}

output "processor_lambda_errors_alarm_name" {
  description = "Nombre de la alarma de errores de Lambda procesadora."
  value       = aws_cloudwatch_metric_alarm.processor_lambda_errors.alarm_name
}

output "api_lambda_errors_alarm_name" {
  description = "Nombre de la alarma de errores de Lambda API."
  value       = aws_cloudwatch_metric_alarm.api_lambda_errors.alarm_name
}

output "api_gateway_5xx_alarm_name" {
  description = "Nombre de la alarma 5XX de API Gateway."
  value       = aws_cloudwatch_metric_alarm.api_gateway_5xx.alarm_name
}

output "processor_dlq_alarm_name" {
  description = "Nombre de la alarma de mensajes visibles en DLQ."
  value       = aws_cloudwatch_metric_alarm.processor_dlq_messages.alarm_name
}
