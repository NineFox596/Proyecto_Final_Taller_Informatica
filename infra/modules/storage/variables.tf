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
  default     = ["*"]
}