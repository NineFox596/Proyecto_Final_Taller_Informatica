# DatosSur — Análisis y optimización de costos AWS

**Región de referencia:** `us-east-1`  
**Moneda:** dólares estadounidenses (USD)  
**Fecha de estimación:** julio de 2026  
**Tipo de estimación:** proyección académica basada en supuestos explícitos y contrastada con AWS Cost Explorer.

---

## 1. Objetivo

Estimar el costo mensual de la arquitectura serverless de DatosSur, justificar su elección frente a una alternativa basada en EC2 e identificar medidas de optimización ya implementadas.

La estimación se contrasta con el consumo real observado durante el despliegue y las pruebas del proyecto.

---

## 2. Servicios considerados

- Amazon S3 para frontend y archivos CSV.
- Amazon CloudFront.
- Amazon API Gateway HTTP API.
- Dos funciones AWS Lambda.
- Amazon DynamoDB en modo `PAY_PER_REQUEST`.
- Point-in-Time Recovery de DynamoDB.
- Amazon SQS como DLQ.
- Amazon SNS.
- Amazon CloudWatch Logs y cuatro alarmas.
- AWS Budgets.

No se incluyen servicios que el proyecto no utiliza, como EC2, RDS, NAT Gateway, Application Load Balancer o una VPC administrada.

---

## 3. Modalidad actual de CloudFront

La cuenta utilizada por el proyecto no puede activar los planes CloudFront de tarifa plana porque dichos planes no están disponibles para cuentas AWS Free Tier.

Por esta razón, la distribución vigente utiliza la modalidad:

```text
Pay-as-you-go
```

Esto no genera un costo relevante para DatosSur, porque la modalidad pay-as-you-go incluye mensualmente:

- 1 TB de transferencia de datos hacia Internet.
- 10.000.000 de solicitudes HTTP o HTTPS.
- Certificados SSL sin costo.
- Transferencia desde un origen AWS, como S3, hacia CloudFront sin cargo adicional.

El tráfico académico de DatosSur está muy por debajo de esos límites.

---

## 4. Tarifas de referencia

| Servicio | Tarifa de referencia |
|---|---:|
| API Gateway HTTP API | USD 1,00 por millón de solicitudes |
| Lambda | USD 0,20 por millón de solicitudes |
| Lambda x86 | USD 0,0000166667 por GB-segundo |
| DynamoDB writes | USD 0,625 por millón |
| DynamoDB reads | USD 0,125 por millón |
| DynamoDB almacenamiento | USD 0,25 por GB-mes |
| DynamoDB PITR | USD 0,20 por GB-mes |
| CloudWatch Logs | USD 0,50 por GB ingerido |
| Alarma CloudWatch estándar | USD 0,10 por métrica de alarma al mes |
| SQS estándar | USD 0,40 por millón de solicitudes |
| EC2 t3.micro Linux | USD 0,0104 por hora |
| EBS gp3 | USD 0,08 por GB-mes |
| IPv4 pública | USD 0,005 por hora |

Para S3 se usa una referencia conservadora de USD 0,023 por GB-mes, USD 0,005 por 1.000 solicitudes PUT/LIST y USD 0,0004 por 1.000 solicitudes GET.

Las tarifas son valores de referencia para `us-east-1`. El cobro real puede variar según consumo, región, cuotas gratuitas, créditos y modificaciones futuras de precios.

---

## 5. Escenario base: MVP académico

### 5.1 Supuestos mensuales

- 20 pequeños negocios.
- 25 archivos CSV por negocio.
- 500 archivos mensuales.
- 1 MB promedio por archivo.
- 10.000 solicitudes a la API.
- Lambda API:
  - 10.000 invocaciones.
  - 256 MB.
  - 150 ms promedio.
- Lambda Processor:
  - 500 invocaciones.
  - 256 MB.
  - 1,5 segundos promedio.
- DynamoDB:
  - 500 escrituras.
  - 10.000 lecturas.
  - 0,05 GB de almacenamiento promedio.
- CloudFront:
  - 50.000 solicitudes.
  - 10 GB de transferencia.
- CloudWatch:
  - 0,5 GB de logs.
  - 4 alarmas estándar.
- Ciclo de vida S3:
  - CSV eliminados después de 30 días.
  - Versiones antiguas eliminadas después de 7 días.

### 5.2 Estimación conservadora sin descontar todas las cuotas gratuitas

| Componente | USD/mes |
|---|---:|
| API Gateway HTTP API | 0,0100 |
| Lambda API: solicitudes y cómputo | 0,0083 |
| Lambda Processor: solicitudes y cómputo | 0,0032 |
| S3: almacenamiento y solicitudes | 0,0148 |
| DynamoDB: lecturas, escrituras, almacenamiento y PITR | 0,0241 |
| CloudWatch Logs | 0,2500 |
| CloudWatch Alarms | 0,4000 |
| SQS, SNS y Budget | 0,0001 |
| CloudFront pay-as-you-go dentro de cuota gratuita | 0,0000 |
| **Total estimado conservador** | **0,71** |

El costo conservador del MVP es cercano a **USD 0,71 mensuales**.

El costo real puede ser inferior porque el consumo académico se mantiene dentro de distintas cuotas gratuitas de AWS.

---

## 6. Escenario de crecimiento

### 6.1 Supuestos

- 10.000 CSV mensuales.
- 2 MB por archivo.
- 200.000 solicitudes a la API.
- 200.000 invocaciones de Lambda API.
- 10.000 invocaciones de Lambda Processor.
- 20 GB temporales en S3.
- 200.000 lecturas y 10.000 escrituras en DynamoDB.
- 1 GB almacenado en DynamoDB.
- 5 GB de logs.
- CloudFront bajo 10 millones de solicitudes y 1 TB de transferencia.

### 6.2 Estimación conservadora

| Componente | USD/mes |
|---|---:|
| API Gateway HTTP API | 0,2000 |
| Lambda API | 0,1650 |
| Lambda Processor | 0,0645 |
| S3 | 0,5140 |
| DynamoDB y PITR | 0,4813 |
| CloudWatch Logs y alarmas | 2,9000 |
| SQS, SNS y Budget | 0,0005 |
| CloudFront pay-as-you-go dentro de cuota gratuita | 0,0000 |
| **Total estimado conservador** | **4,33** |

Este escenario continúa dentro del Budget mensual de USD 5, aunque deja poco margen frente a aumentos en logs, almacenamiento o volumen de procesamiento.

---

## 7. Costo real observado

AWS Cost Explorer fue consultado mediante AWS CLI durante julio de 2026.

El resultado agrupado por servicio mostró:

- AWS Lambda: USD 0.
- Amazon API Gateway: USD 0.
- Amazon CloudFront: USD 0.
- Amazon DynamoDB: aproximadamente USD 0.
- Amazon SQS: USD 0.
- Amazon SNS: USD 0.
- Amazon CloudWatch: USD 0.
- Amazon S3: USD 0,0000000043.
- Total de la cuenta: USD -0,0000001723.

Para fines prácticos, el costo real observado es:

```text
USD 0,00
```

El valor negativo microscópico no representa una ganancia ni una deuda negativa. Cost Explorer puede mostrar diferencias muy pequeñas por redondeos, ajustes, créditos o reembolsos. La factura final de AWS es la fuente definitiva del monto a pagar.

### 7.1 Interpretación

La diferencia entre la estimación conservadora de USD 0,71 y el costo observado de USD 0,00 se explica por:

- Bajo volumen de pruebas.
- Cuotas gratuitas aplicables.
- Archivos pequeños.
- Pocas invocaciones.
- Tráfico de CloudFront muy por debajo de los límites gratuitos.
- Retención acotada de logs.
- Ausencia de servidores permanentes.

La estimación conservadora sigue siendo útil para proyectar el costo cuando el sistema tenga un uso mensual constante.

---

## 8. Comparación con EC2

Una alternativa mínima con una instancia `t3.micro` funcionando durante 730 horas mensuales tendría:

| Componente | USD/mes |
|---|---:|
| EC2 t3.micro | 7,59 |
| EBS gp3 de 8 GB | 0,64 |
| Dirección IPv4 pública | 3,65 |
| **Subtotal mínimo** | **11,88** |

Este subtotal no incluye:

- Base de datos administrada.
- Alta disponibilidad.
- Balanceador de carga.
- Respaldos.
- Monitoreo adicional.
- Escalamiento.
- Administración del sistema operativo.
- Parches.
- Recuperación ante fallos.

Por lo tanto, una implementación EC2 tendría un costo fijo mayor incluso con poco uso y ofrecería menos resiliencia sin incorporar recursos adicionales.

---

## 9. Justificación económica de la arquitectura

### 9.1 Pago por uso

Lambda, API Gateway y DynamoDB on-demand no requieren capacidad reservada. El costo aumenta principalmente con el número de solicitudes, duración de ejecución y datos almacenados.

### 9.2 Ausencia de servidores permanentes

DatosSur evita costos fijos asociados a:

- EC2.
- EBS de servidor.
- IPv4 pública.
- ALB.
- NAT Gateway.
- RDS.

### 9.3 Escalamiento administrado

La arquitectura puede atender aumentos de carga sin preaprovisionar servidores.

### 9.4 Ciclo de vida de objetos

Los CSV se eliminan después de 30 días y las versiones antiguas se eliminan automáticamente, evitando crecimiento indefinido del almacenamiento.

### 9.5 Retención limitada de logs

Los logs tienen una retención de 14 días, lo que reduce almacenamiento innecesario.

### 9.6 Budget

El proyecto cuenta con un Budget mensual de USD 5 y alertas al 80 %, 100 % real y 100 % proyectado.

---

## 10. Riesgos de costo

1. Exceso de logs en CloudWatch.
2. Uso abusivo de una API pública.
3. Acumulación de versiones en S3.
4. Aumento del tamaño de DynamoDB y de su PITR.
5. Uso de `Scan` cuando la tabla crezca.
6. Aumento de archivos o tiempos de ejecución.
7. Reintentos provocados por errores no controlados.
8. Superar los límites gratuitos de CloudFront pay-as-you-go.

---

## 11. Medidas de optimización implementadas

- API Gateway HTTP API en vez de REST API.
- DynamoDB `PAY_PER_REQUEST`.
- Lambdas de 256 MB con timeout parametrizado.
- Carga directa a S3 mediante URL prefirmada.
- Límite de 5 MB por archivo.
- S3 Lifecycle:
  - objetos actuales: 30 días;
  - versiones no vigentes: 7 días.
- Retención de CloudWatch de 14 días.
- Throttling:
  - 10 solicitudes por segundo;
  - burst de 20.
- Frontend estático con S3 y CloudFront.
- Manejo controlado de CSV inválidos para evitar reintentos.
- Budget mensual de USD 5.
- Destrucción de infraestructura con Terraform fuera del periodo de evaluación.

---

## 12. Recomendaciones futuras

1. Revisar periódicamente Cost Explorer y AWS Budgets.
2. Mantener logs estructurados y evitar registrar cuerpos completos.
3. Incorporar paginación real en `/datasets`.
4. Activar cost allocation tags si se requiere separar el costo exacto de DatosSur.
5. Mantener un único ambiente desplegado.
6. Registrar la evidencia del `terraform destroy` final.
7. Comparar mensualmente la proyección con el gasto real.
8. Evaluar otro modelo de CloudFront solo si el tráfico supera las cuotas gratuitas.

---

## 13. Conclusión

DatosSur presenta una estructura de costos adecuada para un MVP académico y para pequeños negocios.

La estimación conservadora del escenario base es de aproximadamente **USD 0,71 mensuales**, mientras que el costo real observado durante el desarrollo fue de **USD 0,00**.

Incluso en un escenario de 10.000 archivos mensuales, la proyección permanece alrededor de **USD 4,33**, dentro del Budget configurado de USD 5.

Una alternativa mínima con EC2 parte desde aproximadamente **USD 11,88 mensuales** antes de agregar alta disponibilidad, base de datos y operación. Por ello, la arquitectura serverless resulta más económica, escalable y coherente con el patrón event-driven de DatosSur.

---

## 14. Fuentes de referencia

- AWS CloudFront Pay-As-You-Go Pricing.
- AWS CloudFront Flat-Rate Plans.
- AWS Lambda Pricing.
- Amazon API Gateway Pricing.
- Amazon DynamoDB Pricing.
- Amazon S3 Pricing.
- Amazon CloudWatch Pricing.
- Amazon SQS Pricing.
- Amazon SNS Pricing.
- AWS Budgets Pricing.
- Amazon EC2 T3 Pricing.
- Amazon EBS Pricing.
- AWS Public IPv4 Pricing.
- AWS Cost Explorer Documentation.
