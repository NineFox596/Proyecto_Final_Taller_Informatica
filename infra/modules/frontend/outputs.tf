output "frontend_bucket_name" {
  description = "Nombre del bucket privado del frontend."
  value       = aws_s3_bucket.frontend.bucket
}

output "cloudfront_distribution_id" {
  description = "ID de la distribución CloudFront."
  value       = aws_cloudfront_distribution.frontend.id
}

output "cloudfront_domain_name" {
  description = "Dominio público de CloudFront."
  value       = aws_cloudfront_distribution.frontend.domain_name
}

output "frontend_url" {
  description = "URL pública HTTPS del frontend."
  value       = "https://${aws_cloudfront_distribution.frontend.domain_name}"
}
