output "processor_lambda_name" {
  description = "Nombre de la Lambda procesadora."
  value       = aws_lambda_function.processor.function_name
}

output "processor_lambda_arn" {
  description = "ARN de la Lambda procesadora."
  value       = aws_lambda_function.processor.arn
}

output "processor_role_name" {
  description = "Nombre del rol IAM de la Lambda procesadora."
  value       = aws_iam_role.processor_lambda_role.name
}

output "processor_log_group_name" {
  description = "Nombre del Log Group de CloudWatch de la Lambda procesadora."
  value       = aws_cloudwatch_log_group.processor.name
}
