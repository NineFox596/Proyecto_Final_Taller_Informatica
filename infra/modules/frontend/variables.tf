variable "name_prefix" {
  description = "Prefijo estándar para nombrar recursos."
  type        = string
}

variable "common_tags" {
  description = "Tags comunes aplicados a los recursos."
  type        = map(string)
  default     = {}
}

variable "api_endpoint" {
  description = "Endpoint base de API Gateway usado por el frontend."
  type        = string
}

variable "input_bucket_name" {
  description = "Nombre del bucket S3 de entrada usado para construir la política CSP."
  type        = string
}

variable "aws_region" {
  description = "Región AWS usada por los endpoints de S3."
  type        = string
}

variable "force_destroy_buckets" {
  description = "Permite destruir buckets aunque tengan objetos. Útil para entornos académicos."
  type        = bool
  default     = true
}

variable "frontend_noncurrent_version_expiration_days" {
  description = "Días que se conservan versiones no vigentes del frontend."
  type        = number
}
