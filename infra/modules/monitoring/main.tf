locals {
  alerts_topic_name = "${var.name_prefix}-alerts"
}

resource "aws_sns_topic" "alerts" {
  name = local.alerts_topic_name

  tags = merge(var.common_tags, {
    Name      = local.alerts_topic_name
    Component = "monitoring"
    Purpose   = "alerts"
  })
}

resource "aws_sns_topic_subscription" "email" {
  topic_arn = aws_sns_topic.alerts.arn
  protocol  = "email"
  endpoint  = var.owner_email
}

resource "aws_cloudwatch_metric_alarm" "processor_lambda_errors" {
  alarm_name          = "${var.name_prefix}-processor-errors"
  alarm_description   = "Alarma cuando la Lambda procesadora registra errores."
  comparison_operator = "GreaterThanOrEqualToThreshold"
  evaluation_periods  = 1
  threshold           = 1
  period              = 300
  statistic           = "Sum"

  namespace   = "AWS/Lambda"
  metric_name = "Errors"

  dimensions = {
    FunctionName = var.processor_lambda_name
  }

  alarm_actions = [aws_sns_topic.alerts.arn]
  ok_actions    = [aws_sns_topic.alerts.arn]

  treat_missing_data = "notBreaching"

  tags = merge(var.common_tags, {
    Name      = "${var.name_prefix}-processor-errors"
    Component = "monitoring"
    Purpose   = "lambda-error-alarm"
  })
}

resource "aws_cloudwatch_metric_alarm" "api_lambda_errors" {
  alarm_name          = "${var.name_prefix}-api-lambda-errors"
  alarm_description   = "Alarma cuando la Lambda API registra errores."
  comparison_operator = "GreaterThanOrEqualToThreshold"
  evaluation_periods  = 1
  threshold           = 1
  period              = 300
  statistic           = "Sum"

  namespace   = "AWS/Lambda"
  metric_name = "Errors"

  dimensions = {
    FunctionName = var.api_lambda_name
  }

  alarm_actions = [aws_sns_topic.alerts.arn]
  ok_actions    = [aws_sns_topic.alerts.arn]

  treat_missing_data = "notBreaching"

  tags = merge(var.common_tags, {
    Name      = "${var.name_prefix}-api-lambda-errors"
    Component = "monitoring"
    Purpose   = "lambda-error-alarm"
  })
}

resource "aws_cloudwatch_metric_alarm" "api_gateway_5xx" {
  alarm_name          = "${var.name_prefix}-api-gateway-5xx"
  alarm_description   = "Alarma cuando API Gateway registra respuestas 5XX."
  comparison_operator = "GreaterThanOrEqualToThreshold"
  evaluation_periods  = 1
  threshold           = 1
  period              = 300
  statistic           = "Sum"

  namespace   = "AWS/ApiGateway"
  metric_name = "5xx"

  dimensions = {
    ApiId = var.api_id
  }

  alarm_actions = [aws_sns_topic.alerts.arn]
  ok_actions    = [aws_sns_topic.alerts.arn]

  treat_missing_data = "notBreaching"

  tags = merge(var.common_tags, {
    Name      = "${var.name_prefix}-api-gateway-5xx"
    Component = "monitoring"
    Purpose   = "api-5xx-alarm"
  })
}

resource "aws_cloudwatch_metric_alarm" "processor_dlq_messages" {
  alarm_name          = "${var.name_prefix}-dlq-visible-messages"
  alarm_description   = "Alarma cuando existen mensajes visibles en la DLQ de procesamiento."
  comparison_operator = "GreaterThanOrEqualToThreshold"
  evaluation_periods  = 1
  threshold           = 1
  period              = 300
  statistic           = "Sum"

  namespace   = "AWS/SQS"
  metric_name = "ApproximateNumberOfMessagesVisible"

  dimensions = {
    QueueName = var.processor_dlq_name
  }

  alarm_actions = [aws_sns_topic.alerts.arn]
  ok_actions    = [aws_sns_topic.alerts.arn]

  treat_missing_data = "notBreaching"

  tags = merge(var.common_tags, {
    Name      = "${var.name_prefix}-dlq-visible-messages"
    Component = "monitoring"
    Purpose   = "dlq-alarm"
  })
}
