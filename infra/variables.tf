variable "project_name" {
  description = "Nombre corto del proyecto."
  type        = string
  default     = "datossur"
}

variable "environment" {
  description = "Ambiente de despliegue."
  type        = string
  default     = "dev"
}

variable "aws_region" {
  description = "Región AWS donde se desplegará la infraestructura."
  type        = string
  default     = "us-east-1"
}

variable "owner_email" {
  description = "Correo para alertas SNS y AWS Budgets."
  type        = string
  default     = "angelomarcelo.reyes@alumnos.ulagos.cl"
}

variable "budget_limit_usd" {
  description = "Límite mensual del presupuesto AWS en USD."
  type        = number
  default     = 5
}

variable "lambda_runtime" {
  description = "Runtime usado por las funciones Lambda."
  type        = string
  default     = "nodejs20.x"
}

variable "log_retention_days" {
  description = "Días de retención de logs en CloudWatch."
  type        = number
  default     = 14
}
