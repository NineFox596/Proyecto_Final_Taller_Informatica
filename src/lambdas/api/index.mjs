import { DynamoDBClient, ScanCommand, GetItemCommand } from "@aws-sdk/client-dynamodb";
import crypto from "crypto";

const dynamodb = new DynamoDBClient({});

const RESULTS_TABLE_NAME = process.env.RESULTS_TABLE_NAME;
const INPUT_BUCKET_NAME = process.env.INPUT_BUCKET_NAME;
const AWS_REGION_NAME = process.env.AWS_REGION || "us-east-1";

const corsHeaders = {
  "content-type": "application/json",
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET,POST,OPTIONS",
  "access-control-allow-headers": "content-type"
};

function response(statusCode, body) {
  return {
    statusCode,
    headers: corsHeaders,
    body: JSON.stringify(body)
  };
}

function parseBody(event) {
  if (!event.body) {
    return {};
  }

  const rawBody = event.isBase64Encoded
    ? Buffer.from(event.body, "base64").toString("utf-8")
    : event.body;

  try {
    return JSON.parse(rawBody);
  } catch {
    return {};
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
    transaction_count: item.transaction_count?.N ? Number(item.transaction_count.N) : undefined,
    invalid_rows: item.invalid_rows?.N ? Number(item.invalid_rows.N) : undefined,
    error_message: item.error_message?.S
  };

  if (item.summary_json?.S) {
    try {
      result.summary = JSON.parse(item.summary_json.S);
    } catch {
      result.summary = item.summary_json.S;
    }
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

function createPresignedPutUrl(filename) {
  if (!INPUT_BUCKET_NAME) {
    throw new Error("INPUT_BUCKET_NAME no está configurado.");
  }

  const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
  const sessionToken = process.env.AWS_SESSION_TOKEN;

  if (!accessKeyId || !secretAccessKey) {
    throw new Error("No existen credenciales temporales disponibles para firmar la URL.");
  }

  const safeFilename = sanitizeFilename(filename || `ventas-${Date.now()}.csv`);

  if (!safeFilename.toLowerCase().endsWith(".csv")) {
    throw new Error("Solo se permiten archivos con extensión .csv.");
  }

  const key = `uploads/${Date.now()}-${safeFilename}`;
  const method = "PUT";
  const service = "s3";
  const host = `${INPUT_BUCKET_NAME}.s3.${AWS_REGION_NAME}.amazonaws.com`;
  const now = new Date();

  const amzDate = formatAmzDate(now);
  const dateStamp = formatDateStamp(now);
  const credentialScope = `${dateStamp}/${AWS_REGION_NAME}/${service}/aws4_request`;
  const expires = "900";

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
    expires_in_seconds: Number(expires),
    method: "PUT"
  };
}

export const handler = async (event) => {
  console.log("Evento API recibido:", JSON.stringify(event));

  const method = event.requestContext?.http?.method || event.httpMethod;
  const path = event.rawPath || event.path || "/";

  try {
    if (method === "OPTIONS") {
      return response(200, { message: "CORS preflight OK" });
    }

    if (method === "GET" && path === "/health") {
      return response(200, {
        status: "ok",
        project: "DatosSur",
        service: "api",
        timestamp: new Date().toISOString()
      });
    }

    if (method === "GET" && path === "/datasets") {
      const result = await dynamodb.send(
        new ScanCommand({
          TableName: RESULTS_TABLE_NAME,
          Limit: 25
        })
      );

      const datasets = (result.Items || [])
        .map(dynamoItemToObject)
        .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));

      return response(200, {
        count: datasets.length,
        datasets
      });
    }

    if (method === "GET" && path.startsWith("/datasets/")) {
      const datasetId = decodeURIComponent(path.split("/")[2] || "");

      if (!datasetId) {
        return response(400, { message: "dataset_id requerido." });
      }

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
        return response(404, { message: "Dataset no encontrado." });
      }

      return response(200, dataset);
    }

    if (method === "POST" && path === "/upload-url") {
      const body = parseBody(event);
      const uploadData = createPresignedPutUrl(body.filename);

      return response(200, uploadData);
    }

    return response(404, {
      message: "Ruta no encontrada.",
      method,
      path
    });
  } catch (error) {
    console.error("Error en Lambda API:", error);

    return response(500, {
      message: "Error interno en la API.",
      error: error.message || "Error desconocido"
    });
  }
};
