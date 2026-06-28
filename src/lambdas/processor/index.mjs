import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { DynamoDBClient, PutItemCommand } from "@aws-sdk/client-dynamodb";
import crypto from "crypto";

const s3 = new S3Client({});
const dynamodb = new DynamoDBClient({});

const RESULTS_TABLE_NAME = process.env.RESULTS_TABLE_NAME;

function streamToString(stream) {
  return new Promise((resolve, reject) => {
    const chunks = [];

    stream.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    stream.on("error", reject);
    stream.on("end", () => resolve(Buffer.concat(chunks).toString("utf-8")));
  });
}

function parseCsv(content) {
  const lines = content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (lines.length < 2) {
    throw new Error("El CSV debe tener encabezado y al menos una fila de datos.");
  }

  const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());

  const requiredHeaders = [
    "fecha",
    "producto",
    "categoria",
    "cantidad",
    "precio_unitario"
  ];

  const missingHeaders = requiredHeaders.filter((header) => !headers.includes(header));

  if (missingHeaders.length > 0) {
    throw new Error(`Faltan columnas obligatorias: ${missingHeaders.join(", ")}`);
  }

  const index = Object.fromEntries(headers.map((header, position) => [header, position]));

  let totalSales = 0;
  let totalUnits = 0;
  let transactionCount = 0;
  let invalidRows = 0;

  const productUnits = {};
  const salesByCategory = {};

  for (const line of lines.slice(1)) {
    const columns = line.split(",").map((value) => value.trim());

    const product = columns[index.producto];
    const category = columns[index.categoria];
    const quantity = Number(columns[index.cantidad]);
    const unitPrice = Number(columns[index.precio_unitario]);

    const isValid =
      product &&
      category &&
      Number.isFinite(quantity) &&
      Number.isFinite(unitPrice) &&
      quantity > 0 &&
      unitPrice >= 0;

    if (!isValid) {
      invalidRows += 1;
      continue;
    }

    const saleTotal = quantity * unitPrice;

    totalSales += saleTotal;
    totalUnits += quantity;
    transactionCount += 1;

    productUnits[product] = (productUnits[product] || 0) + quantity;
    salesByCategory[category] = (salesByCategory[category] || 0) + saleTotal;
  }

  const topProducts = Object.entries(productUnits)
    .map(([product, units]) => ({ product, units }))
    .sort((a, b) => b.units - a.units)
    .slice(0, 5);

  return {
    totalSales,
    totalUnits,
    transactionCount,
    invalidRows,
    topProducts,
    salesByCategory
  };
}

function buildDatasetId(bucket, key, etag) {
  return crypto
    .createHash("sha256")
    .update(`${bucket}/${key}/${etag || ""}`)
    .digest("hex")
    .slice(0, 24);
}

export const handler = async (event) => {
  console.log("Evento recibido:", JSON.stringify(event));

  if (!RESULTS_TABLE_NAME) {
    throw new Error("La variable de entorno RESULTS_TABLE_NAME no está configurada.");
  }

  const records = event.Records || [];

  for (const record of records) {
    const bucket = record.s3.bucket.name;
    const key = decodeURIComponent(record.s3.object.key.replace(/\+/g, " "));
    const etag = record.s3.object.eTag || "";
    const datasetId = buildDatasetId(bucket, key, etag);

    try {
      const objectResponse = await s3.send(
        new GetObjectCommand({
          Bucket: bucket,
          Key: key
        })
      );

      const csvContent = await streamToString(objectResponse.Body);
      const summary = parseCsv(csvContent);

      await dynamodb.send(
        new PutItemCommand({
          TableName: RESULTS_TABLE_NAME,
          Item: {
            dataset_id: { S: datasetId },
            filename: { S: key },
            bucket_name: { S: bucket },
            status: { S: "COMPLETADO" },
            created_at: { S: new Date().toISOString() },
            total_sales: { N: String(summary.totalSales) },
            total_units: { N: String(summary.totalUnits) },
            transaction_count: { N: String(summary.transactionCount) },
            invalid_rows: { N: String(summary.invalidRows) },
            summary_json: { S: JSON.stringify(summary) }
          }
        })
      );

      console.log(`Archivo procesado correctamente: ${key}`);
    } catch (error) {
      console.error(`Error procesando archivo ${key}:`, error);

      await dynamodb.send(
        new PutItemCommand({
          TableName: RESULTS_TABLE_NAME,
          Item: {
            dataset_id: { S: datasetId },
            filename: { S: key },
            bucket_name: { S: bucket },
            status: { S: "ERROR" },
            created_at: { S: new Date().toISOString() },
            error_message: { S: error.message || "Error desconocido" }
          }
        })
      );

      throw error;
    }
  }

  return {
    statusCode: 200,
    body: JSON.stringify({
      message: "Procesamiento finalizado",
      records: records.length
    })
  };
};
