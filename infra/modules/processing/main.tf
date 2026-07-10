data "archive_file" "processor_zip" {
  type        = "zip"
  source_file = "${path.root}/../src/lambdas/processor/index.mjs"
  output_path = "${path.module}/processor.zip"
}

locals {
  processor_lambda_name = "${var.name_prefix}-processor"
  processor_log_group   = "/aws/lambda/${local.processor_lambda_name}"
}

resource "aws_cloudwatch_log_group" "processor" {
  name              = local.processor_log_group
  retention_in_days = var.log_retention_days

  tags = merge(var.common_tags, {
    Name      = local.processor_log_group
    Component = "processing"
    Purpose   = "processor-logs"
  })
}

resource "aws_iam_role" "processor_lambda_role" {
  name = "${var.name_prefix}-processor-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
        Action = "sts:AssumeRole"
      }
    ]
  })

  tags = merge(var.common_tags, {
    Name      = "${var.name_prefix}-processor-role"
    Component = "processing"
    Purpose   = "lambda-execution-role"
  })
}

resource "aws_iam_role_policy" "processor_lambda_policy" {
  name = "${var.name_prefix}-processor-policy"
  role = aws_iam_role.processor_lambda_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "ReadOnlyInputBucketObjects"
        Effect = "Allow"
        Action = [
          "s3:GetObject"
        ]
        Resource = "${var.input_bucket_arn}/*"
      },
      {
        Sid    = "WriteResultsTable"
        Effect = "Allow"
        Action = [
          "dynamodb:PutItem",
          "dynamodb:UpdateItem"
        ]
        Resource = var.results_table_arn
      },
      {
        Sid    = "SendFailuresToDlq"
        Effect = "Allow"
        Action = [
          "sqs:SendMessage"
        ]
        Resource = var.processor_dlq_arn
      },
      {
        Sid    = "WriteCloudWatchLogs"
        Effect = "Allow"
        Action = [
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = "${aws_cloudwatch_log_group.processor.arn}:*"
      }
    ]
  })
}

resource "aws_lambda_function" "processor" {
  function_name = local.processor_lambda_name
  role          = aws_iam_role.processor_lambda_role.arn
  runtime       = var.lambda_runtime
  handler       = "index.handler"

  filename         = data.archive_file.processor_zip.output_path
  source_code_hash = data.archive_file.processor_zip.output_base64sha256

  timeout     = var.processor_lambda_timeout
  memory_size = var.processor_lambda_memory_size

  environment {
    variables = {
      RESULTS_TABLE_NAME = var.results_table_name
    }
  }

  dead_letter_config {
    target_arn = var.processor_dlq_arn
  }

  depends_on = [
    aws_cloudwatch_log_group.processor,
    aws_iam_role_policy.processor_lambda_policy
  ]

  tags = merge(var.common_tags, {
    Name      = local.processor_lambda_name
    Component = "processing"
    Purpose   = "csv-processor"
  })
}

resource "aws_lambda_permission" "allow_s3_invoke" {
  statement_id  = "AllowExecutionFromInputS3Bucket"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.processor.function_name
  principal     = "s3.amazonaws.com"
  source_arn    = var.input_bucket_arn
}

resource "aws_s3_bucket_notification" "input_bucket_notification" {
  bucket = var.input_bucket_name

  lambda_function {
    lambda_function_arn = aws_lambda_function.processor.arn
    events              = ["s3:ObjectCreated:*"]
    filter_suffix       = ".csv"
  }

  depends_on = [
    aws_lambda_permission.allow_s3_invoke
  ]
}
