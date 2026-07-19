import { DynamoDBClient, ScanCommand, GetItemCommand } from "@aws-sdk/client-dynamodb";
import crypto from "crypto";

const dynamodb = new DynamoDBClient({});

const RESULTS_TABLE_NAME = process.env.RESULTS_TABLE_NAME;
const INPUT_BUCKET_NAME = process.env.INPUT_BUCKET_NAME;
const AWS_REGION_NAME = process.env.AWS_REGION || "us-east-1";
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || "*";

const DEFAULT_MAX_UPLOAD_SIZE_BYTES = 5 * 1024 * 1024;
const DEFAULT_UPLOAD_URL_EXPIRATION_SECONDS = 900;
const DEFAULT_DATASET_LIMIT = 25;

const MAX_UPLOAD_SIZE_BYTES = parsePositiveInteger(
  process.env.MAX_UPLOAD_SIZE_BYTES,
  DEFAULT_MAX_UPLOAD_SIZE_BYTES
);

const UPLOAD_URL_EXPIRATION_SECONDS = clamp(
  parsePositiveInteger(
    process.env.UPLOAD_URL_EXPIRATION_SECONDS,
    DEFAULT_UPLOAD_URL_EXPIRATION_SECONDS
  ),
  60,
  900
);

const DATASET_LIMIT = clamp(
  parsePositiveInteger(process.env.DATASET_LIMIT, DEFAULT_DATASET_LIMIT),
  1,
  100
);

class ApiValidationError extends Error {
  constructor(message, code = "INVALID_REQUEST", details = undefined) {
    super(message);
    this.name = "ApiValidationError";
    this.code = code;
    this.details = details;
  }
}

function parsePositiveInteger(value, fallback) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function buildCorsHeaders() {
  return {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "access-control-allow-origin": ALLOWED_ORIGIN,
    "access-control-allow-methods": "GET,POST,OPTIONS",
    "access-control-allow-headers": "content-type"
  };
}

function response(statusCode, body) {
  return {
    statusCode,
    headers: buildCorsHeaders(),
    body: JSON.stringify(body)
  };
}

function ensureEnvironment() {
  const missing = [];

  if (!RESULTS_TABLE_NAME) {
    missing.push("RESULTS_TABLE_NAME");
  }

  if (!INPUT_BUCKET_NAME) {
    missing.push("INPUT_BUCKET_NAME");
  }

  if (missing.length > 0) {
    throw new Error(`Faltan variables de entorno: ${missing.join(", ")}`);
  }
}

function parseBody(event) {
  if (!event.body) {
    return {};
  }

  const rawBody = event.isBase64Encoded
    ? Buffer.from(event.body, "base64").toString("utf-8")
    : event.body;

  try {
    const parsed = JSON.parse(rawBody);

    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new ApiValidationError(
        "El cuerpo de la solicitud debe ser un objeto JSON.",
        "INVALID_JSON_BODY"
      );
    }

    return parsed;
  } catch (error) {
    if (error instanceof ApiValidationError) {
      throw error;
    }

    throw new ApiValidationError(
      "El cuerpo de la solicitud no contiene JSON válido.",
      "INVALID_JSON_BODY"
    );
  }
}

function parseJsonAttribute(value) {
  if (!value) {
    return undefined;
  }

  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function dynamoItemToObject(item) {
  if (!item) {
    return null;
  }

  const result = {
    dataset_id: item.dataset_id?.S,
    filename: item.filename?.S,
    bucket_name: item.bucket_name?.S,
    status: item.status?.S,
    created_at: item.created_at?.S,
    total_sales: item.total_sales?.N ? Number(item.total_sales.N) : undefined,
    total_units: item.total_units?.N ? Number(item.total_units.N) : undefined,
    transaction_count: item.transaction_count?.N
      ? Number(item.transaction_count.N)
      : undefined,
    invalid_rows: item.invalid_rows?.N ? Number(item.invalid_rows.N) : undefined,
    error_message: item.error_message?.S,
    error_type: item.error_type?.S,
    error_details: parseJsonAttribute(item.error_details_json?.S)
  };

  if (item.summary_json?.S) {
    result.summary = parseJsonAttribute(item.summary_json.S);
  }

  return result;
}

function encodeRFC3986(value) {
  return encodeURIComponent(value).replace(/[!'()*]/g, (char) =>
    "%" + char.charCodeAt(0).toString(16).toUpperCase()
  );
}

function sha256Hex(value) {
  return crypto.createHash("sha256").update(value, "utf8").digest("hex");
}

function hmac(key, value, encoding) {
  return crypto.createHmac("sha256", key).update(value, "utf8").digest(encoding);
}

function getSigningKey(secretAccessKey, dateStamp, regionName, serviceName) {
  const kDate = hmac(`AWS4${secretAccessKey}`, dateStamp);
  const kRegion = hmac(kDate, regionName);
  const kService = hmac(kRegion, serviceName);
  return hmac(kService, "aws4_request");
}

function formatAmzDate(date) {
  return date.toISOString().replace(/[:-]|\.\d{3}/g, "");
}

function formatDateStamp(date) {
  return date.toISOString().slice(0, 10).replace(/-/g, "");
}

function sanitizeFilename(filename) {
  return filename
    .trim()
    .replace(/\s+/g, "_")
    .replace(/[^a-zA-Z0-9._-]/g, "_");
}

function validateUploadRequest(body) {
  const filename = typeof body.filename === "string" ? body.filename.trim() : "";

  if (!filename) {
    throw new ApiValidationError(
      "El nombre del archivo es obligatorio.",
      "FILENAME_REQUIRED"
    );
  }

  if (filename.length > 180) {
    throw new ApiValidationError(
      "El nombre del archivo es demasiado largo.",
      "FILENAME_TOO_LONG",
      { max_length: 180 }
    );
  }

  if (!filename.toLowerCase().endsWith(".csv")) {
    throw new ApiValidationError(
      "Solo se permiten archivos con extensión .csv.",
      "INVALID_FILE_EXTENSION",
      { allowed_extension: ".csv" }
    );
  }

  const rawFileSize = body.file_size ?? body.fileSize;
  let fileSize;

  if (rawFileSize !== undefined && rawFileSize !== null && rawFileSize !== "") {
    fileSize = Number(rawFileSize);

    if (!Number.isInteger(fileSize) || fileSize <= 0) {
      throw new ApiValidationError(
        "El tamaño del archivo debe ser un número entero mayor que cero.",
        "INVALID_FILE_SIZE"
      );
    }

    if (fileSize > MAX_UPLOAD_SIZE_BYTES) {
      throw new ApiValidationError(
        `El archivo supera el límite permitido de ${MAX_UPLOAD_SIZE_BYTES} bytes.`,
        "FILE_TOO_LARGE",
        {
          max_file_size_bytes: MAX_UPLOAD_SIZE_BYTES,
          received_file_size_bytes: fileSize
        }
      );
    }
  }

  return { filename, fileSize };
}

function createPresignedPutUrl(filename, fileSize) {
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
  const sessionToken = process.env.AWS_SESSION_TOKEN;

  if (!accessKeyId || !secretAccessKey) {
    throw new Error("No existen credenciales temporales disponibles para firmar la URL.");
  }

  const safeFilename = sanitizeFilename(filename);

  if (!safeFilename || safeFilename === ".csv") {
    throw new ApiValidationError(
      "El nombre del archivo no contiene caracteres válidos.",
      "INVALID_FILENAME"
    );
  }

  const key = `uploads/${Date.now()}-${safeFilename}`;
  const method = "PUT";
  const service = "s3";
  const host = `${INPUT_BUCKET_NAME}.s3.${AWS_REGION_NAME}.amazonaws.com`;
  const now = new Date();

  const amzDate = formatAmzDate(now);
  const dateStamp = formatDateStamp(now);
  const credentialScope = `${dateStamp}/${AWS_REGION_NAME}/${service}/aws4_request`;
  const expires = String(UPLOAD_URL_EXPIRATION_SECONDS);

  const queryParams = {
    "X-Amz-Algorithm": "AWS4-HMAC-SHA256",
    "X-Amz-Credential": `${accessKeyId}/${credentialScope}`,
    "X-Amz-Date": amzDate,
    "X-Amz-Expires": expires,
    "X-Amz-SignedHeaders": "host"
  };

  if (sessionToken) {
    queryParams["X-Amz-Security-Token"] = sessionToken;
  }

  const canonicalUri = "/" + key.split("/").map(encodeRFC3986).join("/");
  const canonicalQueryString = Object.keys(queryParams)
    .sort()
    .map((param) => `${encodeRFC3986(param)}=${encodeRFC3986(queryParams[param])}`)
    .join("&");

  const canonicalHeaders = `host:${host}\n`;
  const signedHeaders = "host";
  const payloadHash = "UNSIGNED-PAYLOAD";

  const canonicalRequest = [
    method,
    canonicalUri,
    canonicalQueryString,
    canonicalHeaders,
    signedHeaders,
    payloadHash
  ].join("\n");

  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    credentialScope,
    sha256Hex(canonicalRequest)
  ].join("\n");

  const signingKey = getSigningKey(secretAccessKey, dateStamp, AWS_REGION_NAME, service);
  const signature = hmac(signingKey, stringToSign, "hex");

  const url = `https://${host}${canonicalUri}?${canonicalQueryString}&X-Amz-Signature=${signature}`;

  return {
    upload_url: url,
    bucket: INPUT_BUCKET_NAME,
    key,
    expires_in_seconds: UPLOAD_URL_EXPIRATION_SECONDS,
    method: "PUT",
    content_type: "text/csv",
    max_file_size_bytes: MAX_UPLOAD_SIZE_BYTES,
    declared_file_size_bytes: fileSize
  };
}

function validateDatasetId(datasetId) {
  if (!datasetId) {
    throw new ApiValidationError("dataset_id requerido.", "DATASET_ID_REQUIRED");
  }

  if (!/^[a-f0-9]{24}$/i.test(datasetId)) {
    throw new ApiValidationError(
      "El formato de dataset_id no es válido.",
      "INVALID_DATASET_ID"
    );
  }
}

export const handler = async (event) => {
  console.log("Evento API recibido:", JSON.stringify(event));

  const method = event.requestContext?.http?.method || event.httpMethod;
  const path = event.rawPath || event.path || "/";
  const requestId = event.requestContext?.requestId;

  try {
    ensureEnvironment();

    if (method === "OPTIONS") {
      return response(200, { message: "CORS preflight OK" });
    }

    if (method === "GET" && path === "/health") {
      return response(200, {
        status: "ok",
        project: "DatosSur",
        service: "api",
        api_version: "2.0.0",
        timestamp: new Date().toISOString(),
        upload: {
          allowed_extension: ".csv",
          max_file_size_bytes: MAX_UPLOAD_SIZE_BYTES,
          presigned_url_expiration_seconds: UPLOAD_URL_EXPIRATION_SECONDS
        }
      });
    }

    if (method === "GET" && path === "/datasets") {
      const result = await dynamodb.send(
        new ScanCommand({
          TableName: RESULTS_TABLE_NAME,
          Limit: DATASET_LIMIT
        })
      );

      const datasets = (result.Items || [])
        .map(dynamoItemToObject)
        .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));

      return response(200, {
        count: datasets.length,
        limit: DATASET_LIMIT,
        datasets
      });
    }

    if (method === "GET" && path.startsWith("/datasets/")) {
      const datasetId = decodeURIComponent(path.split("/")[2] || "");
      validateDatasetId(datasetId);

      const result = await dynamodb.send(
        new GetItemCommand({
          TableName: RESULTS_TABLE_NAME,
          Key: {
            dataset_id: { S: datasetId }
          }
        })
      );

      const dataset = dynamoItemToObject(result.Item);

      if (!dataset) {
        return response(404, {
          code: "DATASET_NOT_FOUND",
          message: "Dataset no encontrado."
        });
      }

      return response(200, dataset);
    }

    if (method === "POST" && path === "/upload-url") {
      const body = parseBody(event);
      const { filename, fileSize } = validateUploadRequest(body);
      const uploadData = createPresignedPutUrl(filename, fileSize);

      return response(200, uploadData);
    }

    return response(404, {
      code: "ROUTE_NOT_FOUND",
      message: "Ruta no encontrada.",
      method,
      path
    });
  } catch (error) {
    if (error instanceof ApiValidationError) {
      console.warn("Solicitud inválida:", {
        code: error.code,
        message: error.message,
        details: error.details,
        requestId
      });

      return response(400, {
        code: error.code,
        message: error.message,
        details: error.details
      });
    }

    console.error("Error interno en Lambda API:", error);

    return response(500, {
      code: "INTERNAL_ERROR",
      message: "No fue posible completar la solicitud.",
      request_id: requestId
    });
  }
};
