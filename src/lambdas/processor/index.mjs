import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { DynamoDBClient, PutItemCommand } from "@aws-sdk/client-dynamodb";
import crypto from "crypto";

const s3 = new S3Client({});
const dynamodb = new DynamoDBClient({});

const RESULTS_TABLE_NAME = process.env.RESULTS_TABLE_NAME;
const MAX_FILE_SIZE_BYTES = Number(process.env.MAX_FILE_SIZE_BYTES || 5 * 1024 * 1024);
const MAX_INVALID_ROW_SAMPLES = 5;

const REQUIRED_HEADERS = [
  "fecha",
  "producto",
  "categoria",
  "cantidad",
  "precio_unitario"
];

class CsvValidationError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = "CsvValidationError";
    this.details = details;
  }
}

function streamToString(stream) {
  if (!stream) {
    throw new Error("El objeto S3 no contiene un cuerpo legible.");
  }

  if (typeof stream.transformToString === "function") {
    return stream.transformToString("utf-8");
  }

  return new Promise((resolve, reject) => {
    const chunks = [];

    stream.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    stream.on("error", reject);
    stream.on("end", () => resolve(Buffer.concat(chunks).toString("utf-8")));
  });
}

/**
 * Parser CSV liviano compatible con:
 * - campos entre comillas;
 * - comas dentro de campos entre comillas;
 * - comillas escapadas mediante "";
 * - saltos de línea dentro de campos entre comillas.
 *
 * No requiere dependencias externas, lo que simplifica el empaquetado de Lambda.
 */
function parseCsvRows(rawContent) {
  const content = String(rawContent || "").replace(/^\uFEFF/, "");
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < content.length; i += 1) {
    const char = content[i];
    const next = content[i + 1];

    if (inQuotes) {
      if (char === '"' && next === '"') {
        field += '"';
        i += 1;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"' && field.trim().length === 0) {
      inQuotes = true;
    } else if (char === ",") {
      row.push(field.trim());
      field = "";
    } else if (char === "\n") {
      row.push(field.trim());
      field = "";

      if (row.some((value) => value.length > 0)) {
        rows.push(row);
      }

      row = [];
    } else if (char !== "\r") {
      field += char;
    }
  }

  if (inQuotes) {
    throw new CsvValidationError("El CSV contiene un campo entre comillas sin cerrar.");
  }

  row.push(field.trim());
  if (row.some((value) => value.length > 0)) {
    rows.push(row);
  }

  return rows;
}

function isValidIsoDate(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || "").trim());
  if (!match) {
    return false;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function round(value, decimals = 2) {
  const factor = 10 ** decimals;
  return Math.round((Number(value) + Number.EPSILON) * factor) / factor;
}

function percentage(part, total, decimals = 1) {
  if (!total) {
    return 0;
  }
  return round((part / total) * 100, decimals);
}

function formatCurrencyClp(value) {
  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0
  }).format(Number(value) || 0);
}

function classifyConcentration(share) {
  if (share >= 60) return "ALTA";
  if (share >= 35) return "MEDIA";
  return "BAJA";
}

/**
 * Indicador orientativo del archivo analizado.
 * No representa rentabilidad ni reemplaza un análisis financiero.
 * Considera calidad de datos, diversificación de productos/categorías
 * y amplitud del conjunto de ventas.
 */
function calculateBusinessHealth({
  datasetQuality,
  bestProductShare,
  bestCategoryShare,
  uniqueProducts,
  uniqueCategories
}) {
  const productDiversification = Math.max(0, 100 - bestProductShare);
  const categoryDiversification = Math.max(0, 100 - bestCategoryShare);
  const breadth = Math.min(100, uniqueProducts * 12 + uniqueCategories * 10);

  const score = Math.round(
    datasetQuality * 0.5 +
      productDiversification * 0.25 +
      categoryDiversification * 0.15 +
      breadth * 0.1
  );

  let status = "CRÍTICA";
  if (score >= 85) status = "EXCELENTE";
  else if (score >= 70) status = "BUENA";
  else if (score >= 50) status = "REGULAR";

  return {
    status,
    score,
    scope:
      "Indicador orientativo basado en calidad y concentración de las ventas del archivo; no mide rentabilidad."
  };
}

function buildRecommendations({
  bestProduct,
  bestProductShare,
  secondProduct,
  bestCategory,
  bestCategoryShare,
  datasetQuality,
  averageTicket,
  productConcentration,
  categoryConcentration
}) {
  const recommendations = [];
  const recommendationDetails = [];

  if (bestProduct) {
    const message =
      `Revisar el nivel de stock y priorizar la reposición de "${bestProduct}", ` +
      `que concentra el ${bestProductShare}% de las unidades vendidas.`;

    recommendations.push(message);
    recommendationDetails.push({
      id: "REVIEW_TOP_PRODUCT_STOCK",
      priority: bestProductShare >= 50 ? "ALTA" : "MEDIA",
      title: "Proteger disponibilidad del producto líder",
      message,
      evidence: {
        product: bestProduct,
        unitSharePercentage: bestProductShare
      }
    });
  }

  if (bestProduct && secondProduct) {
    const message =
      `Evaluar una venta cruzada entre "${bestProduct}" y "${secondProduct}" ` +
      `para aprovechar el interés del producto líder y elevar el ticket promedio actual de ${formatCurrencyClp(averageTicket)}.`;

    recommendations.push(message);
    recommendationDetails.push({
      id: "CROSS_SELL_TOP_PRODUCTS",
      priority: "MEDIA",
      title: "Probar una venta cruzada",
      message,
      evidence: {
        leadingProduct: bestProduct,
        complementaryProduct: secondProduct,
        averageTicket
      }
    });
  }

  if (bestCategory) {
    const message =
      `Usar la categoría "${bestCategory}" como foco comercial, ya que representa ` +
      `el ${bestCategoryShare}% de las ventas del archivo.`;

    recommendations.push(message);
    recommendationDetails.push({
      id: "FOCUS_TOP_CATEGORY",
      priority: bestCategoryShare >= 60 ? "ALTA" : "MEDIA",
      title: "Priorizar la categoría líder",
      message,
      evidence: {
        category: bestCategory,
        salesSharePercentage: bestCategoryShare
      }
    });
  }

  if (productConcentration === "ALTA" || categoryConcentration === "ALTA") {
    const message =
      "La venta está concentrada en pocos productos o categorías. Conviene probar promociones para artículos de menor rotación y reducir dependencia.";

    recommendations.push(message);
    recommendationDetails.push({
      id: "REDUCE_SALES_CONCENTRATION",
      priority: "ALTA",
      title: "Reducir concentración comercial",
      message,
      evidence: {
        productConcentration,
        categoryConcentration
      }
    });
  }

  if (datasetQuality < 95) {
    const message =
      `La calidad del archivo es ${datasetQuality}%. Revisar el origen de los datos y corregir filas inválidas antes de tomar decisiones comerciales.`;

    recommendations.push(message);
    recommendationDetails.push({
      id: "IMPROVE_DATA_QUALITY",
      priority: datasetQuality < 75 ? "ALTA" : "MEDIA",
      title: "Mejorar calidad de datos",
      message,
      evidence: {
        datasetQuality
      }
    });
  }

  if (recommendations.length === 0) {
    const message =
      "Mantener el registro de ventas actualizado y comparar próximos períodos para detectar tendencias.";

    recommendations.push(message);
    recommendationDetails.push({
      id: "KEEP_MONITORING",
      priority: "BAJA",
      title: "Mantener seguimiento periódico",
      message,
      evidence: {}
    });
  }

  return { recommendations, recommendationDetails };
}

function parseCsv(content) {
  const rows = parseCsvRows(content);

  if (rows.length < 2) {
    throw new CsvValidationError(
      "El CSV debe contener encabezado y al menos una fila de datos."
    );
  }

  const headers = rows[0].map((header) => header.trim().toLowerCase());
  const duplicateHeaders = headers.filter(
    (header, position) => header && headers.indexOf(header) !== position
  );

  if (duplicateHeaders.length > 0) {
    throw new CsvValidationError(
      `El CSV contiene columnas duplicadas: ${[...new Set(duplicateHeaders)].join(", ")}`
    );
  }

  const missingHeaders = REQUIRED_HEADERS.filter(
    (header) => !headers.includes(header)
  );

  if (missingHeaders.length > 0) {
    throw new CsvValidationError(
      `Faltan columnas obligatorias: ${missingHeaders.join(", ")}`,
      { missingHeaders }
    );
  }

  const index = Object.fromEntries(
    headers.map((header, position) => [header, position])
  );
  const minimumColumnCount =
    Math.max(...REQUIRED_HEADERS.map((header) => index[header])) + 1;

  let totalSales = 0;
  let totalUnits = 0;
  let transactionCount = 0;
  let invalidRows = 0;

  const productStats = {};
  const categoryStats = {};
  const invalidRowSamples = [];

  for (const [rowOffset, columns] of rows.slice(1).entries()) {
    const rowNumber = rowOffset + 2;
    let invalidReason = null;

    if (columns.length < minimumColumnCount) {
      invalidReason = "Cantidad de columnas insuficiente.";
    }

    const date = columns[index.fecha]?.trim();
    const product = columns[index.producto]?.trim();
    const category = columns[index.categoria]?.trim();
    const quantityRaw = columns[index.cantidad]?.trim();
    const unitPriceRaw = columns[index.precio_unitario]?.trim();
    const quantity = Number(quantityRaw);
    const unitPrice = Number(unitPriceRaw);

    if (!invalidReason && !isValidIsoDate(date)) {
      invalidReason = "Fecha inválida; se espera formato AAAA-MM-DD.";
    } else if (!invalidReason && !product) {
      invalidReason = "Producto vacío.";
    } else if (!invalidReason && !category) {
      invalidReason = "Categoría vacía.";
    } else if (
      !invalidReason &&
      (quantityRaw === "" || !Number.isFinite(quantity) || quantity <= 0)
    ) {
      invalidReason = "Cantidad inválida; debe ser mayor que cero.";
    } else if (
      !invalidReason &&
      (unitPriceRaw === "" || !Number.isFinite(unitPrice) || unitPrice < 0)
    ) {
      invalidReason = "Precio unitario inválido; debe ser mayor o igual que cero.";
    }

    if (invalidReason) {
      invalidRows += 1;
      if (invalidRowSamples.length < MAX_INVALID_ROW_SAMPLES) {
        invalidRowSamples.push({
          rowNumber,
          reason: invalidReason
        });
      }
      continue;
    }

    const saleTotal = quantity * unitPrice;

    totalSales += saleTotal;
    totalUnits += quantity;
    transactionCount += 1;

    productStats[product] ||= { units: 0, sales: 0, transactions: 0 };
    productStats[product].units += quantity;
    productStats[product].sales += saleTotal;
    productStats[product].transactions += 1;

    categoryStats[category] ||= { sales: 0, units: 0, transactions: 0 };
    categoryStats[category].sales += saleTotal;
    categoryStats[category].units += quantity;
    categoryStats[category].transactions += 1;
  }

  if (transactionCount === 0) {
    throw new CsvValidationError(
      "El archivo no contiene filas válidas para analizar.",
      { invalidRows, invalidRowSamples }
    );
  }

  const productRanking = Object.entries(productStats)
    .map(([product, stats]) => ({
      product,
      units: stats.units,
      sales: round(stats.sales, 2),
      transactions: stats.transactions,
      unitSharePercentage: percentage(stats.units, totalUnits),
      salesSharePercentage: percentage(stats.sales, totalSales)
    }))
    .sort((a, b) => b.units - a.units || b.sales - a.sales);

  const topProducts = productRanking.slice(0, 5).map(({ product, units }) => ({
    product,
    units
  }));

  const topProductsDetailed = productRanking.slice(0, 5);
  const topProductsByRevenue = [...productRanking]
    .sort((a, b) => b.sales - a.sales || b.units - a.units)
    .slice(0, 5);

  const categoryRanking = Object.entries(categoryStats)
    .map(([category, stats]) => ({
      category,
      sales: round(stats.sales, 2),
      units: stats.units,
      transactions: stats.transactions,
      salesSharePercentage: percentage(stats.sales, totalSales)
    }))
    .sort((a, b) => b.sales - a.sales);

  const salesByCategory = Object.fromEntries(
    categoryRanking.map(({ category, sales }) => [category, sales])
  );

  const leaderByUnits = productRanking[0];
  const leaderByRevenue = topProductsByRevenue[0];
  const leaderCategory = categoryRanking[0];
  const averageTicket = round(totalSales / transactionCount, 2);
  const averageUnitValue = round(totalSales / totalUnits, 2);
  const totalRows = transactionCount + invalidRows;
  const datasetQuality = percentage(transactionCount, totalRows);
  const bestProductShare = leaderByUnits?.unitSharePercentage || 0;
  const bestCategoryShare = leaderCategory?.salesSharePercentage || 0;
  const productConcentration = classifyConcentration(bestProductShare);
  const categoryConcentration = classifyConcentration(bestCategoryShare);

  const businessHealth = calculateBusinessHealth({
    datasetQuality,
    bestProductShare,
    bestCategoryShare,
    uniqueProducts: productRanking.length,
    uniqueCategories: categoryRanking.length
  });

  const { recommendations, recommendationDetails } = buildRecommendations({
    bestProduct: leaderByUnits?.product,
    bestProductShare,
    secondProduct: productRanking[1]?.product,
    bestCategory: leaderCategory?.category,
    bestCategoryShare,
    datasetQuality,
    averageTicket,
    productConcentration,
    categoryConcentration
  });

  return {
    analysisVersion: "2.0",
    totalRows,
    validRows: transactionCount,
    totalSales: round(totalSales, 2),
    totalUnits,
    transactionCount,
    invalidRows,
    invalidRowSamples,
    topProducts,
    topProductsDetailed,
    topProductsByRevenue,
    salesByCategory,
    categoryRanking,
    insights: {
      bestProduct: leaderByUnits?.product || "Sin información",
      bestProductUnits: leaderByUnits?.units || 0,
      bestProductShare,
      bestProductByRevenue: leaderByRevenue?.product || "Sin información",
      bestProductRevenue: leaderByRevenue?.sales || 0,
      bestCategory: leaderCategory?.category || "Sin información",
      bestCategorySales: leaderCategory?.sales || 0,
      bestCategoryShare,
      averageTicket,
      averageUnitValue,
      datasetQuality,
      productConcentration,
      categoryConcentration,
      businessHealth: businessHealth.status,
      businessHealthScore: businessHealth.score,
      businessHealthScope: businessHealth.scope,
      uniqueProducts: productRanking.length,
      uniqueCategories: categoryRanking.length
    },
    recommendations,
    recommendationDetails
  };
}

function buildDatasetId(bucket, key, etag) {
  return crypto
    .createHash("sha256")
    .update(`${bucket}/${key}/${etag || ""}`)
    .digest("hex")
    .slice(0, 24);
}

async function saveDatasetResult({
  datasetId,
  key,
  bucket,
  status,
  summary,
  error
}) {
  const item = {
    dataset_id: { S: datasetId },
    filename: { S: key },
    bucket_name: { S: bucket },
    status: { S: status },
    created_at: { S: new Date().toISOString() }
  };

  if (summary) {
    item.total_sales = { N: String(summary.totalSales) };
    item.total_units = { N: String(summary.totalUnits) };
    item.transaction_count = { N: String(summary.transactionCount) };
    item.invalid_rows = { N: String(summary.invalidRows) };
    item.summary_json = { S: JSON.stringify(summary) };
  }

  if (error) {
    item.error_type = { S: error.name || "Error" };
    item.error_message = { S: error.message || "Error desconocido" };

    if (error.details && Object.keys(error.details).length > 0) {
      item.error_details_json = { S: JSON.stringify(error.details) };
    }
  }

  await dynamodb.send(
    new PutItemCommand({
      TableName: RESULTS_TABLE_NAME,
      Item: item
    })
  );
}

export const handler = async (event) => {
  console.log("Evento recibido:", JSON.stringify(event));

  if (!RESULTS_TABLE_NAME) {
    throw new Error("La variable de entorno RESULTS_TABLE_NAME no está configurada.");
  }

  const records = event.Records || [];
  const results = [];

  for (const record of records) {
    const bucket = record.s3?.bucket?.name;
    const encodedKey = record.s3?.object?.key;
    const objectSize = Number(record.s3?.object?.size || 0);
    const etag = record.s3?.object?.eTag || "";

    if (!bucket || !encodedKey) {
      throw new Error("El evento S3 no contiene bucket o key válidos.");
    }

    const key = decodeURIComponent(encodedKey.replace(/\+/g, " "));
    const datasetId = buildDatasetId(bucket, key, etag);

    try {
      if (!key.toLowerCase().endsWith(".csv")) {
        throw new CsvValidationError("Solo se permiten archivos con extensión .csv.");
      }

      if (objectSize === 0) {
        throw new CsvValidationError("El archivo CSV está vacío.");
      }

      if (objectSize > MAX_FILE_SIZE_BYTES) {
        throw new CsvValidationError(
          `El archivo supera el tamaño máximo permitido de ${MAX_FILE_SIZE_BYTES} bytes.`,
          { objectSize, maxFileSizeBytes: MAX_FILE_SIZE_BYTES }
        );
      }

      const objectResponse = await s3.send(
        new GetObjectCommand({
          Bucket: bucket,
          Key: key
        })
      );

      const csvContent = await streamToString(objectResponse.Body);
      const summary = parseCsv(csvContent);

      await saveDatasetResult({
        datasetId,
        key,
        bucket,
        status: "COMPLETADO",
        summary
      });

      console.log(`Archivo procesado correctamente: ${key}`);
      results.push({ datasetId, key, status: "COMPLETADO" });
    } catch (error) {
      if (error instanceof CsvValidationError) {
        console.warn(`Validación controlada para ${key}: ${error.message}`);
      } else {
        console.error(`Error técnico procesando archivo ${key}:`, error);
      }

      await saveDatasetResult({
        datasetId,
        key,
        bucket,
        status: "ERROR",
        error
      });

      results.push({
        datasetId,
        key,
        status: "ERROR",
        errorType: error.name,
        message: error.message
      });

      // Los errores de validación son errores de negocio controlados.
      // Se registran en DynamoDB, pero no se relanzan para evitar reintentos,
      // DLQ y alarmas repetidas por un archivo que simplemente es inválido.
      if (error instanceof CsvValidationError) {
        continue;
      }

      // Los errores técnicos sí se relanzan para aprovechar reintentos y DLQ.
      throw error;
    }
  }

  return {
    statusCode: 200,
    body: JSON.stringify({
      message: "Procesamiento finalizado",
      records: records.length,
      results
    })
  };
};
