variable "name_prefix" {
  description = "Prefijo estándar para nombrar recursos."
  type        = string
}

variable "common_tags" {
  description = "Tags comunes aplicados a los recursos."
  type        = map(string)
  default     = {}
}

variable "lambda_runtime" {
  description = "Runtime de la función Lambda API."
  type        = string
}

variable "log_retention_days" {
  description = "Días de retención de logs en CloudWatch."
  type        = number
}

variable "input_bucket_name" {
  description = "Nombre del bucket S3 de entrada."
  type        = string
}

variable "input_bucket_arn" {
  description = "ARN del bucket S3 de entrada."
  type        = string
}

variable "results_table_name" {
  description = "Nombre de la tabla DynamoDB de resultados."
  type        = string
}

variable "results_table_arn" {
  description = "ARN de la tabla DynamoDB de resultados."
  type        = string
}
