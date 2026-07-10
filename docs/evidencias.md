# Evidencias del Hito 1 — DatosSur

Este documento reúne las evidencias recomendadas para respaldar la entrega del Hito 1 del proyecto DatosSur.

El objetivo de estas evidencias es demostrar que la infraestructura fue creada con Terraform, que la arquitectura funciona correctamente, que existe seguridad mediante IAM, que hay monitoreo con CloudWatch, control de costos con AWS Budgets y que el despliegue es reproducible.

## 1. Evidencias de Terraform

| Evidencia                      | Estado    | Descripción                                                      |
| ------------------------------ | --------- | ---------------------------------------------------------------- |
| Bootstrap aplicado             | Realizada | Creación del bucket S3 para `tfstate` y tabla DynamoDB para lock |
| Backend remoto configurado     | Realizada | Terraform principal usa backend S3 + DynamoDB Lock               |
| Módulo storage aplicado        | Realizada | Bucket CSV, DynamoDB resultados y SQS DLQ                        |
| Módulo processing aplicado     | Realizada | Lambda procesadora, IAM, logs y trigger desde S3                 |
| Módulo api aplicado            | Realizada | API Gateway HTTP API y Lambda API                                |
| Módulo frontend aplicado       | Realizada | S3 frontend privado y CloudFront                                 |
| Módulo monitoring aplicado     | Realizada | SNS y alarmas CloudWatch                                         |
| Módulo budget aplicado         | Realizada | AWS Budget mensual                                               |
| Segundo plan/apply sin cambios | Realizada | Evidencia de idempotencia                                        |

## 2. Evidencias funcionales

| Evidencia               | Estado    | Comando o recurso                            |
| ----------------------- | --------- | -------------------------------------------- |
| API health              | Realizada | `Invoke-RestMethod "$API_ENDPOINT/health"`   |
| API datasets            | Realizada | `Invoke-RestMethod "$API_ENDPOINT/datasets"` |
| Carga CSV válida        | Realizada | `aws s3 cp ventas_validas.csv s3://...`      |
| Carga CSV con errores   | Realizada | `aws s3 cp ventas_invalidas.csv s3://...`    |
| Frontend CloudFront     | Realizada | `https://d3197zbvtz2fyf.cloudfront.net`      |
| Consulta desde frontend | Realizada | Botones "Probar API" y "Ver datasets"        |

## 3. Evidencias de observabilidad

| Evidencia                 | Estado    | Descripción                                  |
| ------------------------- | --------- | -------------------------------------------- |
| CloudWatch Logs API       | Realizada | Logs de `/aws/lambda/datossur-dev-api`       |
| CloudWatch Logs Processor | Realizada | Logs de `/aws/lambda/datossur-dev-processor` |
| CloudWatch Alarms         | Realizada | Alarmas para Lambda, API Gateway y DLQ       |
| SNS Topic                 | Realizada | Topic de alertas creado por Terraform        |
| SNS Subscription          | Realizada | Suscripción por correo confirmada            |

## 4. Evidencias de seguridad

| Evidencia                      | Estado    | Descripción                                             |
| ------------------------------ | --------- | ------------------------------------------------------- |
| IAM Role Lambda API            | Realizada | Rol separado para Lambda API                            |
| IAM Role Lambda Processor      | Realizada | Rol separado para Lambda procesadora                    |
| Políticas de mínimo privilegio | Realizada | Acceso acotado a S3, DynamoDB, SQS y CloudWatch Logs    |
| S3 frontend privado            | Realizada | Acceso público bloqueado; CloudFront con OAC            |
| S3 input privado               | Realizada | Acceso público bloqueado y cifrado habilitado           |
| Sin credenciales en código     | Realizada | No se versionan llaves, `.tfstate`, `.tfvars` ni `.env` |

## 5. Evidencias de costos

| Evidencia              | Estado    | Descripción                                    |
| ---------------------- | --------- | ---------------------------------------------- |
| AWS Budget             | Realizada | Budget mensual de USD 5                        |
| Alertas de presupuesto | Realizada | Notificación al correo del estudiante          |
| Tags comunes           | Realizada | Project, Environment, ManagedBy, Course, Owner |
| Retención de logs      | Realizada | CloudWatch Logs con retención configurada      |

## 6. Outputs principales

Valores relevantes del despliegue:

```text
frontend_url = https://d3197zbvtz2fyf.cloudfront.net
api_endpoint = https://6f87p2cazd.execute-api.us-east-1.amazonaws.com
input_bucket_name = datossur-dev-csv-input-251335054638
results_table_name = datossur-dev-results
processor_lambda_name = datossur-dev-processor
api_lambda_name = datossur-dev-api
budget_name = datossur-dev-monthly-budget
```

## 7. Comandos útiles para capturas

### Outputs finales

```powershell
cd infra
terraform output
```

### Validación e idempotencia

```powershell
terraform fmt -recursive
terraform validate
terraform plan
terraform apply
```

Resultado esperado del segundo `plan/apply`:

```text
No changes. Your infrastructure matches the configuration.

Apply complete! Resources: 0 added, 0 changed, 0 destroyed.
```

### Probar API

```powershell
$API_ENDPOINT = "https://6f87p2cazd.execute-api.us-east-1.amazonaws.com"

Invoke-RestMethod "$API_ENDPOINT/health"
Invoke-RestMethod "$API_ENDPOINT/datasets"
```

### Subir CSV de prueba

```powershell
$INPUT_BUCKET = "datossur-dev-csv-input-251335054638"

aws s3 cp samples\ventas_validas.csv s3://$INPUT_BUCKET/uploads/ventas_validas.csv
aws s3 cp samples\ventas_invalidas.csv s3://$INPUT_BUCKET/uploads/ventas_invalidas.csv
```

### Revisar logs

```powershell
aws logs tail /aws/lambda/datossur-dev-api --region us-east-1 --since 15m
aws logs tail /aws/lambda/datossur-dev-processor --region us-east-1 --since 15m
```

### Revisar alarmas

```powershell
aws cloudwatch describe-alarms `
  --alarm-name-prefix datossur-dev `
  --region us-east-1 `
  --query "MetricAlarms[].{Name:AlarmName,State:StateValue,Metric:MetricName}" `
  --output table
```

### Revisar budget

```powershell
aws budgets describe-budget `
  --account-id 251335054638 `
  --budget-name datossur-dev-monthly-budget
```

## 8. Capturas recomendadas para la entrega

Se recomienda guardar capturas de los siguientes puntos:

1. `terraform apply` del bootstrap.
2. Outputs del bootstrap.
3. `terraform init` con backend remoto.
4. `terraform apply` de storage.
5. `terraform apply` de processing.
6. `terraform apply` de api.
7. `terraform apply` de frontend.
8. `terraform apply` de monitoring.
9. `terraform apply` de budget.
10. `terraform output`.
11. Segundo `terraform plan/apply` sin cambios.
12. API `/health`.
13. API `/datasets`.
14. Carga de CSV al bucket S3.
15. Frontend funcionando en CloudFront.
16. Frontend consultando datos reales.
17. CloudWatch Logs de Lambda API.
18. CloudWatch Logs de Lambda procesadora.
19. CloudWatch Alarms.
20. SNS subscription confirmada.
21. AWS Budget.
22. `terraform destroy`, cuando se realice la limpieza final.

## 9. Checklist de rúbrica

| Criterio                                            | Estado                              |
| --------------------------------------------------- | ----------------------------------- |
| Separación clara en archivos Terraform              | Cumplido                            |
| Backend remoto S3 + DynamoDB Lock                   | Cumplido                            |
| Variables con type, description y defaults          | Cumplido                            |
| Outputs útiles                                      | Cumplido                            |
| Cobertura de recursos coherente con la arquitectura | Cumplido                            |
| Módulos propios reutilizables                       | Cumplido                            |
| Segundo apply sin cambios                           | Cumplido                            |
| IAM con mínimo privilegio                           | Cumplido                            |
| Sin credenciales en código                          | Cumplido                            |
| Tags consistentes                                   | Cumplido                            |
| README e instrucciones                              | Pendiente de revisar                |
| `.gitignore` excluye archivos sensibles             | Cumplido                            |
| `terraform fmt` y `terraform validate`              | Cumplido                            |
| `terraform destroy` final                           | Pendiente hasta terminar evidencias |

## 10. Limpieza final

La limpieza debe ejecutarse solo después de obtener todas las evidencias y finalizar la documentación.

El orden correcto es:

1. Destruir la infraestructura principal.
2. Destruir el backend remoto.

### Destruir infraestructura principal

```powershell
cd infra
terraform destroy
```

Confirmar con:

```text
yes
```

### Destruir backend remoto

```powershell
cd bootstrap
terraform destroy
```

Confirmar con:

```text
yes
```

No debe destruirse el backend antes que la infraestructura principal, porque el estado remoto se necesita para que Terraform pueda eliminar correctamente los recursos creados.

## Evidencia Hito 2 - Validacion inicial del MVP

Fecha de validacion: 2026-07-05

### Outputs principales

- Frontend CloudFront: https://d2ib7x3i7q8x7x.cloudfront.net
- API Gateway: https://gnnidy1ka8.execute-api.us-east-1.amazonaws.com
- Bucket CSV input: datossur-dev-csv-input-251335054638
- Tabla DynamoDB: datossur-dev-results
- Lambda procesadora: datossur-dev-processor
- Lambda API: datossur-dev-api

### Pruebas realizadas

- API GET /health operativa.
- API POST /upload-url genera URL prefirmada correctamente.
- Subida de entas_validas.csv a S3 completada.
- Lambda procesadora ejecutada autom�ticamente desde evento S3.
- Resultado guardado en DynamoDB con estado COMPLETADO.
- API GET /datasets devuelve datasets procesados.
- Frontend p�blico en CloudFront carga correctamente.
- Frontend muestra datasets, m�tricas y resultados.
- Se prob� archivo con transacciones inv�lidas y el frontend muestra el nuevo set con registros inv�lidos.

### Resultado

El flujo principal del MVP funciona de punta a punta en AWS:

Usuario -> CloudFront -> API Gateway -> Lambda API -> S3 -> Lambda Processor -> DynamoDB -> Frontend

