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

variable "force_destroy_buckets" {
  description = "Permite destruir buckets aunque tengan objetos. Útil para entornos académicos."
  type        = bool
  default     = true
}
