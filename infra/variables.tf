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

variable "api_lambda_timeout" {
  description = "Tiempo máximo de ejecución en segundos para la Lambda API."
  type        = number
  default     = 15

  validation {
    condition     = var.api_lambda_timeout >= 1 && var.api_lambda_timeout <= 900
    error_message = "api_lambda_timeout debe estar entre 1 y 900 segundos."
  }
}

variable "api_lambda_memory_size" {
  description = "Memoria asignada en MB para la Lambda API."
  type        = number
  default     = 256

  validation {
    condition     = var.api_lambda_memory_size >= 128 && var.api_lambda_memory_size <= 10240
    error_message = "api_lambda_memory_size debe estar entre 128 y 10240 MB."
  }
}

variable "processor_lambda_timeout" {
  description = "Tiempo máximo de ejecución en segundos para la Lambda procesadora de CSV."
  type        = number
  default     = 30

  validation {
    condition     = var.processor_lambda_timeout >= 1 && var.processor_lambda_timeout <= 900
    error_message = "processor_lambda_timeout debe estar entre 1 y 900 segundos."
  }
}

variable "processor_lambda_memory_size" {
  description = "Memoria asignada en MB para la Lambda procesadora de CSV."
  type        = number
  default     = 256

  validation {
    condition     = var.processor_lambda_memory_size >= 128 && var.processor_lambda_memory_size <= 10240
    error_message = "processor_lambda_memory_size debe estar entre 128 y 10240 MB."
  }
}

variable "log_retention_days" {
  description = "Días de retención de logs en CloudWatch."
  type        = number
  default     = 14
}

variable "upload_cors_allowed_origins" {
  description = "Orígenes permitidos para subir CSV al bucket S3 de entrada desde el navegador."
  type        = list(string)
  default     = ["*"]
}