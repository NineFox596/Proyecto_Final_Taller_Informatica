data "aws_caller_identity" "current" {}

locals {
  frontend_bucket_name = "${var.name_prefix}-frontend-${data.aws_caller_identity.current.account_id}"

  content_types = {
    html = "text/html; charset=utf-8"
    css  = "text/css; charset=utf-8"
    js   = "application/javascript; charset=utf-8"
    json = "application/json; charset=utf-8"
    png  = "image/png"
    jpg  = "image/jpeg"
    jpeg = "image/jpeg"
    svg  = "image/svg+xml"
  }

  content_security_policy = join(" ", [
    "default-src 'self';",
    "script-src 'self';",
    "style-src 'self' 'unsafe-inline';",
    "img-src 'self' data:;",
    "connect-src 'self' ${var.api_endpoint} https://${var.input_bucket_name}.s3.${var.aws_region}.amazonaws.com;",
    "object-src 'none';",
    "base-uri 'self';",
    "frame-ancestors 'none';",
    "form-action 'self';"
  ])
}

resource "aws_s3_bucket" "frontend" {
  bucket        = local.frontend_bucket_name
  force_destroy = var.force_destroy_buckets

  tags = merge(var.common_tags, {
    Name      = local.frontend_bucket_name
    Component = "frontend"
    Purpose   = "static-site"
  })
}

resource "aws_s3_bucket_public_access_block" "frontend" {
  bucket = aws_s3_bucket.frontend.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_server_side_encryption_configuration" "frontend" {
  bucket = aws_s3_bucket.frontend.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_ownership_controls" "frontend" {
  bucket = aws_s3_bucket.frontend.id

  rule {
    object_ownership = "BucketOwnerEnforced"
  }
}

resource "aws_s3_bucket_versioning" "frontend" {
  bucket = aws_s3_bucket.frontend.id

  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "frontend" {
  bucket = aws_s3_bucket.frontend.id

  depends_on = [aws_s3_bucket_versioning.frontend]

  rule {
    id     = "expire-noncurrent-frontend-versions"
    status = "Enabled"

    filter {
      prefix = ""
    }

    noncurrent_version_expiration {
      noncurrent_days = var.frontend_noncurrent_version_expiration_days
    }

    abort_incomplete_multipart_upload {
      days_after_initiation = 1
    }
  }
}

resource "aws_cloudfront_origin_access_control" "frontend_oac" {
  name                              = "${var.name_prefix}-frontend-oac"
  description                       = "OAC para acceder al bucket privado del frontend DatosSur"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

resource "aws_cloudfront_response_headers_policy" "security" {
  name    = "${var.name_prefix}-frontend-security-headers"
  comment = "Cabeceras de seguridad para el frontend de DatosSur"

  security_headers_config {
    content_security_policy {
      content_security_policy = local.content_security_policy
      override                = true
    }

    content_type_options {
      override = true
    }

    frame_options {
      frame_option = "DENY"
      override     = true
    }

    referrer_policy {
      referrer_policy = "strict-origin-when-cross-origin"
      override        = true
    }

    strict_transport_security {
      access_control_max_age_sec = 31536000
      include_subdomains         = false
      preload                    = false
      override                   = true
    }

    xss_protection {
      mode_block = true
      protection = true
      override   = true
    }
  }
}

resource "aws_cloudfront_distribution" "frontend" {
  enabled             = true
  comment             = "${var.name_prefix} static frontend"
  default_root_object = "index.html"
  price_class         = "PriceClass_100"

  origin {
    domain_name              = aws_s3_bucket.frontend.bucket_regional_domain_name
    origin_id                = "s3-frontend-origin"
    origin_access_control_id = aws_cloudfront_origin_access_control.frontend_oac.id
  }

  default_cache_behavior {
    target_origin_id           = "s3-frontend-origin"
    viewer_protocol_policy     = "redirect-to-https"
    response_headers_policy_id = aws_cloudfront_response_headers_policy.security.id

    allowed_methods = ["GET", "HEAD", "OPTIONS"]
    cached_methods  = ["GET", "HEAD"]

    forwarded_values {
      query_string = false

      cookies {
        forward = "none"
      }
    }
  }

  custom_error_response {
    error_code         = 403
    response_code      = 200
    response_page_path = "/index.html"
  }

  custom_error_response {
    error_code         = 404
    response_code      = 200
    response_page_path = "/index.html"
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    cloudfront_default_certificate = true
  }

  tags = merge(var.common_tags, {
    Name      = "${var.name_prefix}-frontend-distribution"
    Component = "frontend"
    Purpose   = "cloudfront"
  })
}

resource "aws_s3_bucket_policy" "frontend" {
  bucket = aws_s3_bucket.frontend.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "AllowCloudFrontServicePrincipalReadOnly"
        Effect = "Allow"
        Principal = {
          Service = "cloudfront.amazonaws.com"
        }
        Action   = "s3:GetObject"
        Resource = "${aws_s3_bucket.frontend.arn}/*"
        Condition = {
          StringEquals = {
            "AWS:SourceArn" = aws_cloudfront_distribution.frontend.arn
          }
        }
      }
    ]
  })
}

resource "aws_s3_object" "frontend_files" {
  for_each = fileset("${path.root}/../frontend", "*")

  bucket = aws_s3_bucket.frontend.id
  key    = each.value
  source = "${path.root}/../frontend/${each.value}"
  etag   = filemd5("${path.root}/../frontend/${each.value}")

  content_type = lookup(
    local.content_types,
    lower(element(split(".", each.value), length(split(".", each.value)) - 1)),
    "application/octet-stream"
  )

  cache_control = each.value == "index.html" ? "no-cache, no-store, must-revalidate" : "public, max-age=300, must-revalidate"
}

resource "aws_s3_object" "config_js" {
  bucket = aws_s3_bucket.frontend.id
  key    = "config.js"

  content = "window.DATOSSUR_CONFIG = { apiEndpoint: '${var.api_endpoint}' };"

  content_type  = "application/javascript; charset=utf-8"
  cache_control = "no-cache, no-store, must-revalidate"
  etag          = md5("window.DATOSSUR_CONFIG = { apiEndpoint: '${var.api_endpoint}' };")
}
