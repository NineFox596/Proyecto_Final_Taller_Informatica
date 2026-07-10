const apiEndpoint = window.DATOSSUR_CONFIG?.apiEndpoint;

const healthOutput = document.getElementById("health-output");
const uploadState = document.getElementById("upload-state");
const uploadMessage = document.getElementById("upload-message");
const csvFileInput = document.getElementById("csv-file");
const datasetsTable = document.getElementById("datasets-table");
const datasetCount = document.getElementById("dataset-count");
const metrics = document.getElementById("metrics");
const topProducts = document.getElementById("top-products");
const salesByCategory = document.getElementById("sales-by-category");

const currencyFormatter = new Intl.NumberFormat("es-CL", {
  style: "currency",
  currency: "CLP",
  maximumFractionDigits: 0
});

const numberFormatter = new Intl.NumberFormat("es-CL");

function print(element, data) {
  element.textContent = JSON.stringify(data, null, 2);
}

function setUploadState(text, type = "neutral") {
  uploadState.textContent = text;
  uploadState.className = `status-pill ${type}`;
}

function setUploadMessage(text, type = "neutral") {
  uploadMessage.textContent = text;
  uploadMessage.className = `message ${type}`;
}

function requireApiEndpoint() {
  if (!apiEndpoint) {
    throw new Error("API endpoint no configurado. Revisa config.js generado por Terraform.");
  }
}

async function requestJson(path, options = {}) {
  requireApiEndpoint();

  const response = await fetch(`${apiEndpoint}${path}`, {
    headers: {
      "content-type": "application/json",
      ...(options.headers || {})
    },
    ...options
  });

  const text = await response.text();
  const data = text ? JSON.parse(text) : {};

  if (!response.ok) {
    throw new Error(data.message || data.error || `Error HTTP ${response.status}`);
  }

  return data;
}

function filenameFromKey(filename = "") {
  return filename.split("/").pop() || filename || "Sin nombre";
}

function formatDate(value) {
  if (!value) {
    return "-";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString("es-CL");
}

function renderStatus(status) {
  const normalized = String(status || "SIN_ESTADO").toUpperCase();
  const className = normalized === "COMPLETADO" ? "ok" : normalized === "ERROR" ? "error" : "pending";
  return { text: normalized, className };
}

function renderMetrics(dataset) {
  const values = dataset
    ? [
        ["Total vendido", currencyFormatter.format(dataset.total_sales || 0)],
        ["Unidades", numberFormatter.format(dataset.total_units || 0)],
        ["Transacciones", numberFormatter.format(dataset.transaction_count || 0)],
        ["Filas inválidas", numberFormatter.format(dataset.invalid_rows || 0)]
      ]
    : [
        ["Total vendido", "-"],
        ["Unidades", "-"],
        ["Transacciones", "-"],
        ["Filas inválidas", "-"]
      ];

  metrics.replaceChildren();

  for (const [label, value] of values) {
    const article = document.createElement("article");
    const span = document.createElement("span");
    const strong = document.createElement("strong");

    span.textContent = label;
    strong.textContent = value;

    article.append(span, strong);
    metrics.appendChild(article);
  }
}

function renderBars(container, rows, labelKey, valueKey, formatter = numberFormatter.format) {
  container.replaceChildren();
  container.className = "bars";

  if (!rows || rows.length === 0) {
    container.textContent = "Sin datos todavía.";
    container.classList.add("empty");
    return;
  }

  const maxValue = Math.max(...rows.map((row) => Number(row[valueKey]) || 0), 1);

  for (const row of rows) {
    const value = Number(row[valueKey]) || 0;
    const item = document.createElement("div");
    const top = document.createElement("div");
    const label = document.createElement("span");
    const amount = document.createElement("strong");
    const bar = document.createElement("div");
    const fill = document.createElement("span");

    item.className = "bar-item";
    top.className = "bar-top";
    bar.className = "bar";
    fill.style.width = `${Math.max((value / maxValue) * 100, 4)}%`;

    label.textContent = row[labelKey];
    amount.textContent = formatter(value);

    top.append(label, amount);
    bar.appendChild(fill);
    item.append(top, bar);
    container.appendChild(item);
  }
}

function renderSummary(dataset) {
  const summary = dataset?.summary || {};
  const productRows = Array.isArray(summary.topProducts) ? summary.topProducts : [];
  const categoryRows = Object.entries(summary.salesByCategory || {}).map(([category, total]) => ({
    category,
    total
  }));

  renderBars(topProducts, productRows, "product", "units", (value) => `${numberFormatter.format(value)} unidades`);
  renderBars(salesByCategory, categoryRows, "category", "total", (value) => currencyFormatter.format(value));
}

function renderDatasets(datasets) {
  datasetsTable.replaceChildren();
  datasetCount.textContent = `${datasets.length} dataset${datasets.length === 1 ? "" : "s"}`;

  if (datasets.length === 0) {
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = 6;
    cell.textContent = "Sin resultados todavía. Sube un CSV para iniciar el flujo.";
    row.appendChild(cell);
    datasetsTable.appendChild(row);
    renderMetrics(null);
    renderSummary(null);
    return;
  }

  for (const dataset of datasets) {
    const row = document.createElement("tr");
    const status = renderStatus(dataset.status);

    const values = [
      filenameFromKey(dataset.filename),
      status.text,
      currencyFormatter.format(dataset.total_sales || 0),
      numberFormatter.format(dataset.total_units || 0),
      numberFormatter.format(dataset.invalid_rows || 0),
      formatDate(dataset.created_at)
    ];

    values.forEach((value, index) => {
      const cell = document.createElement("td");
      cell.textContent = value;

      if (index === 1) {
        cell.className = `table-status ${status.className}`;
      }

      row.appendChild(cell);
    });

    datasetsTable.appendChild(row);
  }

  const latestCompleted = datasets.find((dataset) => dataset.status === "COMPLETADO") || datasets[0];
  renderMetrics(latestCompleted);
  renderSummary(latestCompleted);
}

async function loadDatasets() {
  const data = await requestJson("/datasets");
  const datasets = Array.isArray(data.datasets) ? data.datasets : [];
  renderDatasets(datasets);
  return datasets;
}

async function uploadCsv() {
  const file = csvFileInput.files?.[0];

  if (!file) {
    setUploadState("Sin archivo", "error");
    setUploadMessage("Debes seleccionar un archivo CSV antes de subirlo.", "error");
    return;
  }

  if (!file.name.toLowerCase().endsWith(".csv")) {
    setUploadState("Archivo inválido", "error");
    setUploadMessage("Solo se permiten archivos con extensión .csv.", "error");
    return;
  }

  try {
    setUploadState("Solicitando URL", "pending");
    setUploadMessage("Solicitando URL prefirmada a la API...");

    const uploadData = await requestJson("/upload-url", {
      method: "POST",
      body: JSON.stringify({ filename: file.name })
    });

    const uploadUrl = uploadData.upload_url || uploadData.uploadUrl;

    if (!uploadUrl) {
      throw new Error("La API no devolvió upload_url.");
    }

    setUploadState("Subiendo CSV", "pending");
    setUploadMessage("Subiendo archivo directamente a S3...");

    const uploadResponse = await fetch(uploadUrl, {
      method: "PUT",
      body: file,
      headers: {
        "content-type": file.type || "text/csv"
      }
    });

    if (!uploadResponse.ok) {
      throw new Error(`S3 respondió con HTTP ${uploadResponse.status}`);
    }

    setUploadState("Procesando", "pending");
    setUploadMessage("Archivo subido. Esperando procesamiento de Lambda...");

    await refreshAfterUpload();

    setUploadState("Completado", "ok");
    setUploadMessage("Carga completada. Revisa el resumen y la tabla de datasets.", "ok");
    csvFileInput.value = "";
  } catch (error) {
    setUploadState("Error", "error");
    setUploadMessage(error.message, "error");
  }
}

async function refreshAfterUpload() {
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 1800));
    setUploadMessage(`Consultando resultados... intento ${attempt}/4`);
    const datasets = await loadDatasets();

    if (datasets.length > 0) {
      return;
    }
  }
}

document.getElementById("btn-health").addEventListener("click", async () => {
  try {
    healthOutput.textContent = "Consultando...";
    const data = await requestJson("/health");
    print(healthOutput, data);
  } catch (error) {
    print(healthOutput, { error: error.message });
  }
});

document.getElementById("btn-datasets").addEventListener("click", async () => {
  try {
    await loadDatasets();
  } catch (error) {
    setUploadMessage(error.message, "error");
  }
});

document.getElementById("btn-refresh").addEventListener("click", async () => {
  try {
    await loadDatasets();
  } catch (error) {
    setUploadMessage(error.message, "error");
  }
});

document.getElementById("btn-upload").addEventListener("click", uploadCsv);

loadDatasets().catch(() => {
  renderDatasets([]);
});
