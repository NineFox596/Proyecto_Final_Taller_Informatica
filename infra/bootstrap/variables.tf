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
  description = "Región AWS donde se crearán los recursos de backend."
  type        = string
  default     = "us-east-1"
}

variable "owner_email" {
  description = "Correo del responsable del proyecto."
  type        = string
  default     = "angelomarcelo.reyes@alumnos.ulagos.cl"
}
