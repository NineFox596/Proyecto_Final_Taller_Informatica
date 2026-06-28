variable "name_prefix" {
  description = "Prefijo estándar para nombrar recursos."
  type        = string
}

variable "common_tags" {
  description = "Tags comunes aplicados a los recursos."
  type        = map(string)
  default     = {}
}

variable "owner_email" {
  description = "Correo que recibirá alertas SNS."
  type        = string
}

variable "processor_lambda_name" {
  description = "Nombre de la Lambda procesadora."
  type        = string
}

variable "api_lambda_name" {
  description = "Nombre de la Lambda API."
  type        = string
}

variable "api_id" {
  description = "ID de API Gateway HTTP API."
  type        = string
}

variable "processor_dlq_name" {
  description = "Nombre de la cola SQS DLQ."
  type        = string
}
