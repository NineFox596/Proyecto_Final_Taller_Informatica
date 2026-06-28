output "api_endpoint" {
  description = "Endpoint público base de API Gateway HTTP API."
  value       = aws_apigatewayv2_api.http_api.api_endpoint
}

output "api_id" {
  description = "ID de API Gateway HTTP API."
  value       = aws_apigatewayv2_api.http_api.id
}

output "api_execution_arn" {
  description = "Execution ARN de API Gateway."
  value       = aws_apigatewayv2_api.http_api.execution_arn
}

output "api_lambda_name" {
  description = "Nombre de la Lambda API."
  value       = aws_lambda_function.api.function_name
}

output "api_lambda_arn" {
  description = "ARN de la Lambda API."
  value       = aws_lambda_function.api.arn
}

output "api_log_group_name" {
  description = "Nombre del Log Group de CloudWatch de la Lambda API."
  value       = aws_cloudwatch_log_group.api_lambda.name
}
