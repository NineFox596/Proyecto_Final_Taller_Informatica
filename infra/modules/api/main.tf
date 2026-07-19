data "archive_file" "api_zip" {
  type        = "zip"
  source_file = "${path.root}/../src/lambdas/api/index.mjs"
  output_path = "${path.module}/api.zip"
}

locals {
  api_lambda_name        = "${var.name_prefix}-api"
  api_log_group          = "/aws/lambda/${local.api_lambda_name}"
  api_name               = "${var.name_prefix}-http-api"
  api_gateway_access_log = "/aws/apigateway/${local.api_name}/access"
  primary_allowed_origin = var.allowed_origins[0]
}

resource "aws_cloudwatch_log_group" "api_lambda" {
  name              = local.api_log_group
  retention_in_days = var.log_retention_days

  tags = merge(var.common_tags, {
    Name      = local.api_log_group
    Component = "api"
    Purpose   = "api-lambda-logs"
  })
}

resource "aws_cloudwatch_log_group" "api_gateway_access" {
  name              = local.api_gateway_access_log
  retention_in_days = var.log_retention_days

  tags = merge(var.common_tags, {
    Name      = local.api_gateway_access_log
    Component = "api"
    Purpose   = "api-gateway-access-logs"
  })
}

resource "aws_iam_role" "api_lambda_role" {
  name = "${var.name_prefix}-api-role"

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
    Name      = "${var.name_prefix}-api-role"
    Component = "api"
    Purpose   = "lambda-execution-role"
  })
}

resource "aws_iam_role_policy" "api_lambda_policy" {
  name = "${var.name_prefix}-api-policy"
  role = aws_iam_role.api_lambda_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "ReadResultsTable"
        Effect = "Allow"
        Action = [
          "dynamodb:GetItem",
          "dynamodb:Scan",
          "dynamodb:Query"
        ]
        Resource = var.results_table_arn
      },
      {
        Sid    = "AllowPresignedUploadToInputBucket"
        Effect = "Allow"
        Action = [
          "s3:PutObject"
        ]
        Resource = "${var.input_bucket_arn}/*"
      },
      {
        Sid    = "WriteCloudWatchLogs"
        Effect = "Allow"
        Action = [
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = "${aws_cloudwatch_log_group.api_lambda.arn}:*"
      }
    ]
  })
}

resource "aws_lambda_function" "api" {
  function_name = local.api_lambda_name
  role          = aws_iam_role.api_lambda_role.arn
  runtime       = var.lambda_runtime
  handler       = "index.handler"

  filename         = data.archive_file.api_zip.output_path
  source_code_hash = data.archive_file.api_zip.output_base64sha256

  timeout     = var.api_lambda_timeout
  memory_size = var.api_lambda_memory_size

  environment {
    variables = {
      RESULTS_TABLE_NAME            = var.results_table_name
      INPUT_BUCKET_NAME             = var.input_bucket_name
      ALLOWED_ORIGIN                = local.primary_allowed_origin
      MAX_UPLOAD_SIZE_BYTES         = tostring(var.max_upload_size_bytes)
      UPLOAD_URL_EXPIRATION_SECONDS = tostring(var.upload_url_expiration_seconds)
      DATASET_LIMIT                 = tostring(var.dataset_limit)
    }
  }

  depends_on = [
    aws_cloudwatch_log_group.api_lambda,
    aws_iam_role_policy.api_lambda_policy
  ]

  tags = merge(var.common_tags, {
    Name      = local.api_lambda_name
    Component = "api"
    Purpose   = "http-api-handler"
  })
}

resource "aws_apigatewayv2_api" "http_api" {
  name          = local.api_name
  protocol_type = "HTTP"

  cors_configuration {
    allow_headers = ["content-type"]
    allow_methods = ["GET", "POST", "OPTIONS"]
    allow_origins = var.allowed_origins
    max_age       = 300
  }

  tags = merge(var.common_tags, {
    Name      = local.api_name
    Component = "api"
    Purpose   = "http-api"
  })
}

resource "aws_apigatewayv2_integration" "lambda_proxy" {
  api_id                 = aws_apigatewayv2_api.http_api.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.api.invoke_arn
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_route" "health" {
  api_id    = aws_apigatewayv2_api.http_api.id
  route_key = "GET /health"
  target    = "integrations/${aws_apigatewayv2_integration.lambda_proxy.id}"
}

resource "aws_apigatewayv2_route" "datasets" {
  api_id    = aws_apigatewayv2_api.http_api.id
  route_key = "GET /datasets"
  target    = "integrations/${aws_apigatewayv2_integration.lambda_proxy.id}"
}

resource "aws_apigatewayv2_route" "dataset_detail" {
  api_id    = aws_apigatewayv2_api.http_api.id
  route_key = "GET /datasets/{dataset_id}"
  target    = "integrations/${aws_apigatewayv2_integration.lambda_proxy.id}"
}

resource "aws_apigatewayv2_route" "upload_url" {
  api_id    = aws_apigatewayv2_api.http_api.id
  route_key = "POST /upload-url"
  target    = "integrations/${aws_apigatewayv2_integration.lambda_proxy.id}"
}

resource "aws_apigatewayv2_stage" "default" {
  api_id      = aws_apigatewayv2_api.http_api.id
  name        = "$default"
  auto_deploy = true

  access_log_settings {
    destination_arn = aws_cloudwatch_log_group.api_gateway_access.arn
    format = jsonencode({
      requestId               = "$context.requestId"
      sourceIp                = "$context.identity.sourceIp"
      requestTime             = "$context.requestTime"
      httpMethod              = "$context.httpMethod"
      routeKey                = "$context.routeKey"
      status                  = "$context.status"
      protocol                = "$context.protocol"
      responseLength          = "$context.responseLength"
      integrationErrorMessage = "$context.integrationErrorMessage"
    })
  }

  default_route_settings {
    throttling_burst_limit = var.api_throttling_burst_limit
    throttling_rate_limit  = var.api_throttling_rate_limit
  }

  tags = merge(var.common_tags, {
    Name      = "${local.api_name}-default-stage"
    Component = "api"
    Purpose   = "default-stage"
  })
}

resource "aws_lambda_permission" "allow_api_gateway" {
  statement_id  = "AllowExecutionFromHttpApi"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.api.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.http_api.execution_arn}/*/*"
}
