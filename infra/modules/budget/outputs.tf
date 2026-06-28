output "budget_name" {
  description = "Nombre del AWS Budget mensual."
  value       = aws_budgets_budget.monthly.name
}

output "budget_limit_usd" {
  description = "Límite mensual configurado para el presupuesto."
  value       = aws_budgets_budget.monthly.limit_amount
}
