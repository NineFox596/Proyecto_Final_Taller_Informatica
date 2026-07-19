# Evidencias del Proyecto Final — DatosSur

## 1. Propósito

Este documento organiza las evidencias técnicas y funcionales del estado final de DatosSur. Su objetivo es demostrar, de forma verificable, el flujo end-to-end, la seguridad, resiliencia, observabilidad, control de costos e idempotencia de Terraform.

### Despliegue vigente

| Recurso | Valor |
|---|---|
| Frontend CloudFront | `https://dziky8atb7317.cloudfront.net` |
| API Gateway | `https://6zv537rbm5.execute-api.us-east-1.amazonaws.com` |
| CloudFront Distribution ID | `E17ZQHQORAZWHI` |
| Bucket CSV | `datossur-dev-csv-input-251335054638` |
| Tabla DynamoDB | `datossur-dev-results` |
| Lambda Processor | `datossur-dev-processor` |
| Lambda API | `datossur-dev-api` |
| Región | `us-east-1` |

> Si se ejecuta `terraform destroy` y se vuelve a desplegar, las URL deben actualizarse con `terraform output`.

## 2. Resumen de validación

| Área | Estado |
|---|---|
| Flujo end-to-end | Validado |
| Dashboard ejecutivo | Validado |
| Insights y recomendaciones | Validado |
| CSV válidos y parcialmente inválidos | Validado |
| Errores controlados | Validado |
| DLQ sin mensajes por validaciones | Validado |
| API con validación y respuestas HTTP | Validado |
| CORS restringido | Validado |
| Cabeceras de seguridad | Validado |
| Throttling | Validado |
| Access logs | Validado |
| DynamoDB PITR | Validado |
| S3 Lifecycle | Validado |
| Terraform sin cambios pendientes | Validado |
| Cost Explorer | Validado |
| Destroy final | Pendiente hasta finalizar la evaluación |

## 3. Evidencias funcionales

### 3.1 Frontend

Pruebas realizadas:

1. Carga inicial del sitio.
2. Consulta de `/health`.
3. Consulta de `/datasets`.
4. Selección de un CSV.
5. Solicitud de URL prefirmada.
6. Carga directa a S3.
7. Espera del dataset por la clave exacta.
8. Visualización de métricas.
9. Visualización de insights.
10. Visualización de recomendaciones.
11. Selección de datasets históricos.
12. Visualización de datasets con error.

Resultado:

```text
GET  /health       200
GET  /datasets     200
POST /upload-url   200
PUT  S3            200
```

### 3.2 Casos del Processor

| Archivo de prueba | Estado | Válidas | Inválidas | Resultado |
|---|---|---:|---:|---|
| `01_ventas_validas.csv` | `COMPLETADO` | 5 | 0 | Métricas e insights |
| `02_ventas_con_filas_invalidas.csv` | `COMPLETADO` | 2 | 3 | Calidad reducida |
| `03_campos_con_comas_y_comillas.csv` | `COMPLETADO` | 3 | 0 | Parser correcto |
| `04_encabezados_faltantes.csv` | `ERROR` | 0 | — | Error controlado |
| `05_solo_filas_invalidas.csv` | `ERROR` | 0 | — | Error controlado |
| `06_csv_vacio.csv` | `ERROR` | 0 | — | Error controlado |
| `07_fecha_invalida_parcial.csv` | `COMPLETADO` | 2 | 1 | Fila inválida contabilizada |

Comando de consulta:

```powershell
$Api = terraform output -raw api_endpoint
$Response = Invoke-RestMethod "$Api/datasets"

$Response.datasets |
    Where-Object { $_.filename -like "*uploads/pruebas/*" } |
    Select-Object filename, status, transaction_count, invalid_rows, error_message |
    Format-Table -AutoSize
```

### 3.3 Métricas verificadas

- `totalSales`
- `totalUnits`
- `transactionCount`
- `invalidRows`
- `averageTicket`
- `averageUnitValue`
- `datasetQuality`
- `topProductsDetailed`
- `topProductsByRevenue`
- `categoryRanking`
- `insights`
- `recommendationDetails`
- `analysisVersion`

## 4. Errores controlados y DLQ

Los errores de validación se registran como advertencias y no se relanzan.

Logs esperados:

```text
INFO Archivo procesado correctamente
WARN Validación controlada
ERROR Error técnico
```

Atributos verificados de la DLQ:

```json
{
  "ApproximateNumberOfMessages": "0",
  "ApproximateNumberOfMessagesNotVisible": "0",
  "ApproximateNumberOfMessagesDelayed": "0"
}
```

Esto demuestra que CSV vacíos o mal formados no fueron tratados como fallos de infraestructura.

Comando:

```powershell
$DlqUrl = aws sqs list-queues `
    --queue-name-prefix "datossur-dev-processor-dlq" `
    --region us-east-1 `
    --query "QueueUrls[0]" `
    --output text

aws sqs get-queue-attributes `
    --queue-url "$DlqUrl" `
    --attribute-names `
        ApproximateNumberOfMessages `
        ApproximateNumberOfMessagesNotVisible `
        ApproximateNumberOfMessagesDelayed `
    --region us-east-1
```

## 5. API refinada

### Casos verificados

| Caso | Resultado |
|---|---|
| Extensión `.txt` | HTTP 400 `INVALID_FILE_EXTENSION` |
| Archivo mayor a 5 MB | HTTP 400 `FILE_TOO_LARGE` |
| JSON incorrecto | HTTP 400 `INVALID_JSON_BODY` |
| CSV válido | URL prefirmada creada |
| Dataset inexistente | HTTP 404 |
| Dataset con error | `error_type`, `error_message`, `error_details` |

Ejemplo PowerShell:

```powershell
$Body = @{
    filename  = "ventas_grandes.csv"
    file_size = 6000000
} | ConvertTo-Json -Compress

try {
    Invoke-RestMethod `
        -Method Post `
        -Uri "$Api/upload-url" `
        -ContentType "application/json; charset=utf-8" `
        -Body $Body
}
catch {
    Write-Host "HTTP:" ([int]$_.Exception.Response.StatusCode)
    $_.ErrorDetails.Message
}
```

## 6. Seguridad

### 6.1 CloudFront

Cabeceras observadas:

```text
Content-Security-Policy
Strict-Transport-Security: max-age=31536000
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
Referrer-Policy: strict-origin-when-cross-origin
X-XSS-Protection: 1; mode=block
```

Comando:

```powershell
curl.exe -I "https://dziky8atb7317.cloudfront.net"
```

La CSP permite conexiones únicamente al API y bucket vigentes.

### 6.2 CORS

Origen permitido:

```text
https://dziky8atb7317.cloudfront.net
```

Un origen externo no recibe `access-control-allow-origin`.

### 6.3 IAM y almacenamiento

- roles separados;
- mínimo privilegio;
- buckets privados;
- S3 cifrado;
- OAC;
- sin credenciales versionadas;
- variables y backend local ignorados;
- DynamoDB PITR habilitado.

## 7. Resiliencia

### 7.1 DynamoDB PITR

Comando:

```powershell
$Table = terraform output -raw results_table_name

aws dynamodb describe-continuous-backups `
  --table-name "$Table" `
  --region us-east-1 `
  --query "ContinuousBackupsDescription.PointInTimeRecoveryDescription.PointInTimeRecoveryStatus" `
  --output text
```

Resultado:

```text
ENABLED
```

### 7.2 S3 Lifecycle

Configuración validada:

- archivos de entrada: 30 días;
- versiones no vigentes del input: 7 días;
- versiones no vigentes del frontend: 30 días.

Comando:

```powershell
$Bucket = terraform output -raw input_bucket_name

aws s3api get-bucket-lifecycle-configuration `
  --bucket "$Bucket" `
  --region us-east-1
```

## 8. API Gateway

Configuración verificada:

```json
{
  "DetailedMetricsEnabled": false,
  "ThrottlingBurstLimit": 20,
  "ThrottlingRateLimit": 10.0,
  "AccessLogGroup": "/aws/apigateway/datossur-dev-http-api/access"
}
```

Comando:

```powershell
$ApiId = aws apigatewayv2 get-apis `
  --region us-east-1 `
  --query "Items[?Name=='datossur-dev-http-api'].ApiId | [0]" `
  --output text

aws apigatewayv2 get-stage `
  --api-id "$ApiId" `
  --stage-name '$default' `
  --region us-east-1 `
  --query "{Throttling:DefaultRouteSettings,AccessLogSettings:AccessLogSettings}" `
  --output json
```

## 9. Observabilidad

### Logs

```powershell
aws logs tail /aws/lambda/datossur-dev-api `
  --region us-east-1 `
  --since 20m

aws logs tail /aws/lambda/datossur-dev-processor `
  --region us-east-1 `
  --since 20m
```

### Alarmas

```powershell
aws cloudwatch describe-alarms `
  --alarm-name-prefix "datossur-dev" `
  --region us-east-1 `
  --query "MetricAlarms[].{Name:AlarmName,State:StateValue,Metric:MetricName}" `
  --output table
```

### SNS

- topic creado por Terraform;
- suscripción de correo confirmada;
- alarmas conectadas al topic.

## 10. Terraform e idempotencia

Validaciones:

```powershell
terraform fmt -recursive
terraform validate
terraform plan
```

Resultados obtenidos durante las fases:

```text
Plan: 0 to add, 1 to change, 0 to destroy.
Plan: 0 to add, 3 to change, 0 to destroy.
Plan: 4 to add, 11 to change, 0 to destroy.
```

Después del hardening:

```text
No changes. Your infrastructure matches the configuration.
```

El hardening fue aplicado sin destruir recursos existentes.

## 11. Costos

Cost Explorer agrupado por servicio mostró:

```text
AWS Lambda                          USD 0
Amazon API Gateway                  USD 0
Amazon CloudFront                   USD 0
Amazon DynamoDB                     USD 0
Amazon SQS                          USD 0
Amazon SNS                          USD 0
AmazonCloudWatch                    USD 0
Amazon S3                           USD 0.0000000043
Total de la cuenta                  USD -0.0000001723
```

Interpretación práctica:

```text
Costo real observado: USD 0,00
```

El detalle y la proyección están en `docs/costos.md`.

## 12. Capturas finales recomendadas

| N.º | Archivo sugerido | Contenido |
|---:|---|---|
| 01 | `01_terraform_outputs.png` | Outputs vigentes |
| 02 | `02_terraform_validate.png` | Validación exitosa |
| 03 | `03_terraform_idempotencia.png` | Plan sin cambios |
| 04 | `04_frontend_dashboard.png` | Dashboard ejecutivo |
| 05 | `05_frontend_insights.png` | Insights y recomendaciones |
| 06 | `06_subida_csv.png` | Flujo de carga |
| 07 | `07_dataset_error.png` | Error controlado |
| 08 | `08_api_health.png` | Health y límites |
| 09 | `09_api_validacion_400.png` | Extensión o tamaño inválido |
| 10 | `10_processor_pruebas.png` | Tabla de siete pruebas |
| 11 | `11_processor_logs.png` | INFO y WARN |
| 12 | `12_dlq_cero.png` | Atributos de la DLQ |
| 13 | `13_api_gateway_stage.png` | Throttling y access logs |
| 14 | `14_cloudfront_headers.png` | Cabeceras de seguridad |
| 15 | `15_dynamodb_pitr.png` | Estado ENABLED |
| 16 | `16_s3_lifecycle.png` | Reglas lifecycle |
| 17 | `17_cloudwatch_alarms.png` | Alarmas |
| 18 | `18_budget.png` | Budget USD 5 |
| 19 | `19_cost_explorer.png` | Costo real |
| 20 | `20_destroy_final.png` | Cleanup final |

No deben aparecer access keys, secretos, tarjetas, credenciales ni información de pago.

## 13. Checklist de cierre

```text
[x] Flujo principal funcional.
[x] Dashboard ejecutivo.
[x] Insights y recomendaciones.
[x] Archivos válidos e inválidos.
[x] Error de negocio controlado.
[x] DLQ sin mensajes por validación.
[x] API con respuestas estructuradas.
[x] IAM mínimo privilegio.
[x] Buckets privados.
[x] CORS restringido.
[x] Cabeceras de seguridad.
[x] Throttling.
[x] Access logs.
[x] DynamoDB PITR.
[x] S3 Lifecycle.
[x] CloudWatch y SNS.
[x] Budget.
[x] Costos estimados y reales.
[x] Terraform idempotente.
[ ] Capturas finales ordenadas.
[ ] Informe técnico final.
[ ] Destroy final después de la evaluación.
```

## 14. Destroy final

La limpieza se realiza después de guardar las capturas y concluir la evaluación.

Infraestructura principal:

```powershell
cd infra
terraform destroy
```

Backend remoto, solo después:

```powershell
cd bootstrap
terraform destroy
```

El orden es obligatorio porque la infraestructura principal depende del estado remoto.
