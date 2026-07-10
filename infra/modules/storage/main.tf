data "aws_caller_identity" "current" {}

locals {
  input_bucket_name  = "${var.name_prefix}-csv-input-${data.aws_caller_identity.current.account_id}"
  results_table_name = "${var.name_prefix}-results"
  dlq_name           = "${var.name_prefix}-processor-dlq"
}

resource "aws_s3_bucket" "input" {
  bucket        = local.input_bucket_name
  force_destroy = var.force_destroy_buckets

  tags = merge(var.common_tags, {
    Name      = local.input_bucket_name
    Component = "storage"
    Purpose   = "csv-input"
  })
}

resource "aws_s3_bucket_public_access_block" "input" {
  bucket = aws_s3_bucket.input.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_server_side_encryption_configuration" "input" {
  bucket = aws_s3_bucket.input.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_versioning" "input" {
  bucket = aws_s3_bucket.input.id

  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_cors_configuration" "input" {
  bucket = aws_s3_bucket.input.id

  cors_rule {
    allowed_headers = ["*"]
    allowed_methods = ["PUT"]
    allowed_origins = var.upload_cors_allowed_origins
    expose_headers  = ["ETag"]
    max_age_seconds = 3000
  }
}

resource "aws_s3_bucket_ownership_controls" "input" {
  bucket = aws_s3_bucket.input.id

  rule {
    object_ownership = "BucketOwnerEnforced"
  }
}

resource "aws_dynamodb_table" "results" {
  name         = local.results_table_name
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "dataset_id"

  attribute {
    name = "dataset_id"
    type = "S"
  }

  server_side_encryption {
    enabled = true
  }

  tags = merge(var.common_tags, {
    Name      = local.results_table_name
    Component = "storage"
    Purpose   = "processing-results"
  })
}

resource "aws_sqs_queue" "processor_dlq" {
  name                      = local.dlq_name
  message_retention_seconds = 1209600
  sqs_managed_sse_enabled   = true

  tags = merge(var.common_tags, {
    Name      = local.dlq_name
    Component = "storage"
    Purpose   = "processor-dead-letter-queue"
  })
}
