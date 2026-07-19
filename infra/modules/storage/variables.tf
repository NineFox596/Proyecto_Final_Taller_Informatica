variable "name_prefix" {
  description = "Prefijo estándar para nombrar recursos."
  type        = string
}

variable "common_tags" {
  description = "Tags comunes aplicados a los recursos."
  type        = map(string)
  default     = {}
}

variable "force_destroy_buckets" {
  description = "Permite destruir buckets aunque tengan objetos. Útil para entornos académicos."
  type        = bool
  default     = true
}

variable "upload_cors_allowed_origins" {
  description = "Orígenes permitidos para CORS en el bucket de entrada CSV."
  type        = list(string)
}

variable "input_object_expiration_days" {
  description = "Días que se conservan los objetos actuales bajo uploads/."
  type        = number
}

variable "input_noncurrent_version_expiration_days" {
  description = "Días que se conservan versiones no vigentes de objetos del bucket de entrada."
  type        = number
}

variable "enable_dynamodb_pitr" {
  description = "Habilita recuperación point-in-time para la tabla DynamoDB."
  type        = bool
}
