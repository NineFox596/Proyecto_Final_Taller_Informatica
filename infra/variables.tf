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
  description = "Correo para alertas SNS y AWS Budgets. Debe definirse en terraform.tfvars."
  type        = string
  default     = "correo@ejemplo.cl"
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
  description = "Orígenes HTTPS permitidos para la API y la carga directa al bucket S3. En producción debe contener solo el dominio CloudFront vigente."
  type        = list(string)
  default     = ["*"]

  validation {
    condition = (
      length(var.upload_cors_allowed_origins) == 1 &&
      alltrue([
        for origin in var.upload_cors_allowed_origins :
        origin == "*" || startswith(origin, "https://")
      ])
    )
    error_message = "Debe existir exactamente un origen CORS y debe ser '*' o comenzar con https://."
  }
}

variable "max_upload_size_bytes" {
  description = "Tamaño máximo permitido para un CSV, aplicado en la API y en la Lambda procesadora."
  type        = number
  default     = 5242880

  validation {
    condition     = var.max_upload_size_bytes >= 1024 && var.max_upload_size_bytes <= 20971520
    error_message = "max_upload_size_bytes debe estar entre 1 KB y 20 MB."
  }
}

variable "upload_url_expiration_seconds" {
  description = "Duración de las URLs prefirmadas de carga S3."
  type        = number
  default     = 900

  validation {
    condition     = var.upload_url_expiration_seconds >= 60 && var.upload_url_expiration_seconds <= 900
    error_message = "upload_url_expiration_seconds debe estar entre 60 y 900 segundos."
  }
}

variable "dataset_limit" {
  description = "Cantidad máxima de datasets devueltos por GET /datasets."
  type        = number
  default     = 25

  validation {
    condition     = var.dataset_limit >= 1 && var.dataset_limit <= 100
    error_message = "dataset_limit debe estar entre 1 y 100."
  }
}

variable "api_throttling_rate_limit" {
  description = "Tasa sostenida máxima de solicitudes por segundo en el stage de API Gateway."
  type        = number
  default     = 10

  validation {
    condition     = var.api_throttling_rate_limit > 0 && var.api_throttling_rate_limit <= 100
    error_message = "api_throttling_rate_limit debe ser mayor que 0 y no superar 100."
  }
}

variable "api_throttling_burst_limit" {
  description = "Ráfaga máxima de solicitudes permitida por API Gateway."
  type        = number
  default     = 20

  validation {
    condition     = var.api_throttling_burst_limit >= 1 && var.api_throttling_burst_limit <= 200
    error_message = "api_throttling_burst_limit debe estar entre 1 y 200."
  }
}

variable "input_object_expiration_days" {
  description = "Días que se conservan los CSV actuales en el bucket de entrada."
  type        = number
  default     = 30

  validation {
    condition     = var.input_object_expiration_days >= 1
    error_message = "input_object_expiration_days debe ser al menos 1."
  }
}

variable "input_noncurrent_version_expiration_days" {
  description = "Días que se conservan versiones no vigentes de CSV en S3."
  type        = number
  default     = 7

  validation {
    condition     = var.input_noncurrent_version_expiration_days >= 1
    error_message = "input_noncurrent_version_expiration_days debe ser al menos 1."
  }
}

variable "frontend_noncurrent_version_expiration_days" {
  description = "Días que se conservan versiones no vigentes de archivos del frontend."
  type        = number
  default     = 30

  validation {
    condition     = var.frontend_noncurrent_version_expiration_days >= 1
    error_message = "frontend_noncurrent_version_expiration_days debe ser al menos 1."
  }
}

variable "enable_dynamodb_pitr" {
  description = "Habilita recuperación point-in-time en la tabla DynamoDB de resultados."
  type        = bool
  default     = true
}
