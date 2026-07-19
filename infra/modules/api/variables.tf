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

variable "api_lambda_timeout" {
  description = "Tiempo máximo de ejecución en segundos para la Lambda API."
  type        = number
}

variable "api_lambda_memory_size" {
  description = "Memoria asignada en MB para la Lambda API."
  type        = number
}

variable "allowed_origins" {
  description = "Orígenes permitidos por CORS en API Gateway y en las respuestas Lambda."
  type        = list(string)
}

variable "max_upload_size_bytes" {
  description = "Tamaño máximo de archivo declarado en POST /upload-url."
  type        = number
}

variable "upload_url_expiration_seconds" {
  description = "Duración de las URLs prefirmadas de S3."
  type        = number
}

variable "dataset_limit" {
  description = "Cantidad máxima de datasets devueltos por la API."
  type        = number
}

variable "api_throttling_rate_limit" {
  description = "Límite sostenido de solicitudes por segundo del stage."
  type        = number
}

variable "api_throttling_burst_limit" {
  description = "Límite de ráfaga de solicitudes del stage."
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
