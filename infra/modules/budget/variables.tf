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
  description = "Correo que recibirá las alertas de AWS Budgets."
  type        = string
}

variable "budget_limit_usd" {
  description = "Límite mensual del presupuesto en USD."
  type        = number
}
