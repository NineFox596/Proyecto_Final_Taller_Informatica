module "storage" {
  source = "./modules/storage"

  name_prefix           = local.name_prefix
  common_tags           = local.common_tags
  force_destroy_buckets = true
}

module "processing" {
  source = "./modules/processing"

  name_prefix        = local.name_prefix
  common_tags        = local.common_tags
  lambda_runtime     = var.lambda_runtime
  log_retention_days = var.log_retention_days

  processor_lambda_timeout     = var.processor_lambda_timeout
  processor_lambda_memory_size = var.processor_lambda_memory_size

  input_bucket_name = module.storage.input_bucket_name
  input_bucket_arn  = module.storage.input_bucket_arn

  results_table_name = module.storage.results_table_name
  results_table_arn  = module.storage.results_table_arn

  processor_dlq_arn = module.storage.processor_dlq_arn
}

module "api" {
  source = "./modules/api"

  name_prefix        = local.name_prefix
  common_tags        = local.common_tags
  lambda_runtime     = var.lambda_runtime
  log_retention_days = var.log_retention_days

  api_lambda_timeout     = var.api_lambda_timeout
  api_lambda_memory_size = var.api_lambda_memory_size

  input_bucket_name = module.storage.input_bucket_name
  input_bucket_arn  = module.storage.input_bucket_arn

  results_table_name = module.storage.results_table_name
  results_table_arn  = module.storage.results_table_arn
}

module "frontend" {
  source = "./modules/frontend"

  name_prefix           = local.name_prefix
  common_tags           = local.common_tags
  api_endpoint          = module.api.api_endpoint
  force_destroy_buckets = true
}

module "monitoring" {
  source = "./modules/monitoring"

  name_prefix = local.name_prefix
  common_tags = local.common_tags
  owner_email = var.owner_email

  processor_lambda_name = module.processing.processor_lambda_name
  api_lambda_name       = module.api.api_lambda_name
  api_id                = module.api.api_id
  processor_dlq_name    = module.storage.processor_dlq_name
}

module "budget" {
  source = "./modules/budget"

  name_prefix      = local.name_prefix
  common_tags      = local.common_tags
  owner_email      = var.owner_email
  budget_limit_usd = var.budget_limit_usd
}