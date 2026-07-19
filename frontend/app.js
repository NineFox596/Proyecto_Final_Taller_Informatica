const apiEndpoint = window.DATOSSUR_CONFIG?.apiEndpoint;

const DEFAULT_MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;
const POLLING_ATTEMPTS = 8;
const POLLING_DELAY_MS = 2000;

const state = {
  datasets: [],
  selectedDatasetId: null,
  maxFileSizeBytes: DEFAULT_MAX_FILE_SIZE_BYTES,
  uploadInProgress: false
};

const elements = {
  healthOutput: document.getElementById("health-output"),
  uploadState: document.getElementById("upload-state"),
  uploadMessage: document.getElementById("upload-message"),
  uploadLimit: document.getElementById("upload-limit"),
  selectedFile: document.getElementById("selected-file"),
  csvFileInput: document.getElementById("csv-file"),
  uploadButton: document.getElementById("btn-upload"),
  datasetsTable: document.getElementById("datasets-table"),
  datasetCount: document.getElementById("dataset-count"),
  metrics: document.getElementById("metrics"),
  businessHealth: document.getElementById("business-health"),
  insights: document.getElementById("insights"),
  recommendations: document.getElementById("recommendations"),
  recommendationCount: document.getElementById("recommendation-count"),
  analysisVersion: document.getElementById("analysis-version"),
  topProducts: document.getElementById("top-products"),
  salesByCategory: document.getElementById("sales-by-category"),
  selectedDatasetTitle: document.getElementById("selected-dataset-title"),
  selectedDatasetDate: document.getElementById("selected-dataset-date"),
  datasetErrorCard: document.getElementById("dataset-error-card"),
  datasetErrorMessage: document.getElementById("dataset-error-message"),
  datasetErrorDetails: document.getElementById("dataset-error-details")
};

const currencyFormatter = new Intl.NumberFormat("es-CL", {
  style: "currency",
  currency: "CLP",
  maximumFractionDigits: 0
});

const numberFormatter = new Intl.NumberFormat("es-CL", {
  maximumFractionDigits: 2
});

const percentageFormatter = new Intl.NumberFormat("es-CL", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 1
});

class ApiError extends Error {
  constructor(message, { status, code, details } = {}) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

function print(element, data) {
  element.textContent = JSON.stringify(data, null, 2);
}

function setUploadState(text, type = "neutral") {
  elements.uploadState.textContent = text;
  elements.uploadState.className = `status-pill ${type}`;
}

function setUploadMessage(text, type = "neutral") {
  elements.uploadMessage.textContent = text;
  elements.uploadMessage.className = `message ${type}`;
}

function setUploadBusy(isBusy) {
  state.uploadInProgress = isBusy;
  elements.uploadButton.disabled = isBusy;
  elements.csvFileInput.disabled = isBusy;
  elements.uploadButton.textContent = isBusy ? "Procesando…" : "Subir y analizar";
}

function requireApiEndpoint() {
  if (!apiEndpoint) {
    throw new Error("API endpoint no configurado. Revisa config.js generado por Terraform.");
  }
}

async function requestJson(path, options = {}) {
  requireApiEndpoint();

  const response = await fetch(`${apiEndpoint}${path}`, {
    ...options,
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...(options.headers || {})
    }
  });

  const text = await response.text();
  let data = {};

  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      throw new ApiError("La API devolvió una respuesta que no es JSON válido.", {
        status: response.status
      });
    }
  }

  if (!response.ok) {
    throw new ApiError(data.message || data.error || `Error HTTP ${response.status}`, {
      status: response.status,
      code: data.code,
      details: data.details
    });
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
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString("es-CL");
}

function formatBytes(bytes) {
  const value = Number(bytes);

  if (!Number.isFinite(value) || value < 0) {
    return "-";
  }

  if (value < 1024) {
    return `${value} B`;
  }

  if (value < 1024 * 1024) {
    return `${(value / 1024).toFixed(1)} KB`;
  }

  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

function renderStatus(status) {
  const normalized = String(status || "SIN_ESTADO").toUpperCase();
  const className =
    normalized === "COMPLETADO"
      ? "ok"
      : normalized === "ERROR"
        ? "error"
        : "pending";

  return { text: normalized, className };
}

function getSelectedDataset() {
  return state.datasets.find((dataset) => dataset.dataset_id === state.selectedDatasetId) || null;
}

function selectDefaultDataset(datasets) {
  if (datasets.some((dataset) => dataset.dataset_id === state.selectedDatasetId)) {
    return;
  }

  const latestCompleted = datasets.find((dataset) => dataset.status === "COMPLETADO");
  state.selectedDatasetId = (latestCompleted || datasets[0])?.dataset_id || null;
}

function createMetric(label, value, helper) {
  const article = document.createElement("article");
  const span = document.createElement("span");
  const strong = document.createElement("strong");

  span.textContent = label;
  strong.textContent = value;
  article.append(span, strong);

  if (helper) {
    const small = document.createElement("small");
    small.textContent = helper;
    article.appendChild(small);
  }

  return article;
}

function renderMetrics(dataset) {
  const insights = dataset?.summary?.insights || {};
  const values = dataset
    ? [
        ["Total vendido", currencyFormatter.format(dataset.total_sales || 0)],
        ["Ticket promedio", currencyFormatter.format(insights.averageTicket || 0)],
        ["Unidades", numberFormatter.format(dataset.total_units || 0)],
        ["Transacciones", numberFormatter.format(dataset.transaction_count || 0)],
        [
          "Calidad del dataset",
          `${percentageFormatter.format(insights.datasetQuality || 0)}%`,
          `${numberFormatter.format(dataset.invalid_rows || 0)} filas inválidas`
        ],
        ["Filas inválidas", numberFormatter.format(dataset.invalid_rows || 0)]
      ]
    : [
        ["Total vendido", "-"],
        ["Ticket promedio", "-"],
        ["Unidades", "-"],
        ["Transacciones", "-"],
        ["Calidad del dataset", "-"],
        ["Filas inválidas", "-"]
      ];

  elements.metrics.replaceChildren(...values.map(([label, value, helper]) =>
    createMetric(label, value, helper)
  ));
}

function healthClass(status) {
  const normalized = String(status || "").toUpperCase();

  if (normalized === "EXCELENTE") return "excellent";
  if (normalized === "BUENA") return "good";
  if (normalized === "REGULAR") return "regular";
  return "critical";
}

function renderBusinessHealth(dataset) {
  const insights = dataset?.summary?.insights;

  elements.businessHealth.replaceChildren();

  if (!insights) {
    elements.businessHealth.className = "health-panel empty-panel";
    elements.businessHealth.textContent =
      "Selecciona un dataset completado para ver el indicador comercial.";
    return;
  }

  const status = insights.businessHealth || "SIN DATOS";
  const score = Number(insights.businessHealthScore) || 0;
  const wrapper = document.createElement("div");
  const badge = document.createElement("span");
  const text = document.createElement("div");
  const title = document.createElement("strong");
  const scope = document.createElement("p");
  const progress = document.createElement("div");
  const fill = document.createElement("span");

  elements.businessHealth.className = `health-panel ${healthClass(status)}`;
  badge.className = "health-score";
  badge.textContent = `${score}/100`;
  title.textContent = `Indicador comercial: ${status}`;
  scope.textContent =
    insights.businessHealthScope ||
    "Indicador orientativo basado en la calidad y concentración del archivo.";
  progress.className = "health-progress";
  fill.style.width = `${Math.min(Math.max(score, 0), 100)}%`;

  progress.appendChild(fill);
  text.append(title, scope, progress);
  wrapper.append(badge, text);
  elements.businessHealth.appendChild(wrapper);
}

function createInsightCard(label, value, description) {
  const article = document.createElement("article");
  const span = document.createElement("span");
  const strong = document.createElement("strong");
  const paragraph = document.createElement("p");

  span.textContent = label;
  strong.textContent = value;
  paragraph.textContent = description;
  article.append(span, strong, paragraph);
  return article;
}

function renderInsights(dataset) {
  const summary = dataset?.summary || {};
  const insights = summary.insights;

  elements.insights.replaceChildren();
  elements.analysisVersion.textContent = summary.analysisVersion
    ? `Análisis v${summary.analysisVersion}`
    : "Sin análisis";

  if (!insights) {
    elements.insights.className = "insight-grid empty-panel";
    elements.insights.textContent = "Aún no hay insights para mostrar.";
    return;
  }

  elements.insights.className = "insight-grid";
  elements.insights.append(
    createInsightCard(
      "Producto líder por unidades",
      insights.bestProduct || "Sin información",
      `${numberFormatter.format(insights.bestProductUnits || 0)} unidades · ${percentageFormatter.format(insights.bestProductShare || 0)}% de participación`
    ),
    createInsightCard(
      "Producto líder por ingresos",
      insights.bestProductByRevenue || "Sin información",
      currencyFormatter.format(insights.bestProductRevenue || 0)
    ),
    createInsightCard(
      "Categoría principal",
      insights.bestCategory || "Sin información",
      `${currencyFormatter.format(insights.bestCategorySales || 0)} · ${percentageFormatter.format(insights.bestCategoryShare || 0)}% de las ventas`
    ),
    createInsightCard(
      "Diversificación",
      `${numberFormatter.format(insights.uniqueProducts || 0)} productos`,
      `${numberFormatter.format(insights.uniqueCategories || 0)} categorías · concentración de producto ${String(insights.productConcentration || "sin datos").toLowerCase()}`
    ),
    createInsightCard(
      "Valor medio por unidad",
      currencyFormatter.format(insights.averageUnitValue || 0),
      "Promedio calculado sobre las unidades válidas del archivo."
    ),
    createInsightCard(
      "Concentración por categoría",
      String(insights.categoryConcentration || "Sin datos"),
      "Permite detectar dependencia de una categoría principal."
    )
  );
}

function priorityClass(priority) {
  const normalized = String(priority || "BAJA").toUpperCase();
  if (normalized === "ALTA") return "high";
  if (normalized === "MEDIA") return "medium";
  return "low";
}

function renderRecommendations(dataset) {
  const summary = dataset?.summary || {};
  const detailed = Array.isArray(summary.recommendationDetails)
    ? summary.recommendationDetails
    : [];
  const simple = Array.isArray(summary.recommendations) ? summary.recommendations : [];

  elements.recommendations.replaceChildren();

  const recommendations = detailed.length > 0
    ? detailed
    : simple.map((message, index) => ({
        id: `RECOMMENDATION_${index + 1}`,
        priority: "MEDIA",
        title: `Recomendación ${index + 1}`,
        message
      }));

  elements.recommendationCount.textContent = `${recommendations.length} recomendación${recommendations.length === 1 ? "" : "es"}`;

  if (recommendations.length === 0) {
    elements.recommendations.className = "recommendations empty-panel";
    elements.recommendations.textContent = "Aún no hay recomendaciones para mostrar.";
    return;
  }

  elements.recommendations.className = "recommendations";

  for (const recommendation of recommendations) {
    const article = document.createElement("article");
    const header = document.createElement("div");
    const priority = document.createElement("span");
    const title = document.createElement("h3");
    const message = document.createElement("p");

    article.className = `recommendation ${priorityClass(recommendation.priority)}`;
    header.className = "recommendation-header";
    priority.className = "priority-pill";
    priority.textContent = `Prioridad ${String(recommendation.priority || "MEDIA").toLowerCase()}`;
    title.textContent = recommendation.title || "Recomendación";
    message.textContent = recommendation.message || "Sin detalle disponible.";

    header.append(title, priority);
    article.append(header, message);
    elements.recommendations.appendChild(article);
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

function renderCharts(dataset) {
  const summary = dataset?.summary || {};
  const productRows = Array.isArray(summary.topProductsDetailed)
    ? summary.topProductsDetailed
    : Array.isArray(summary.topProducts)
      ? summary.topProducts
      : [];
  const categoryRows = Array.isArray(summary.categoryRanking)
    ? summary.categoryRanking
    : Object.entries(summary.salesByCategory || {}).map(([category, sales]) => ({
        category,
        sales
      }));

  renderBars(
    elements.topProducts,
    productRows,
    "product",
    "units",
    (value) => `${numberFormatter.format(value)} unidades`
  );
  renderBars(
    elements.salesByCategory,
    categoryRows,
    "category",
    "sales",
    (value) => currencyFormatter.format(value)
  );
}

function renderDatasetError(dataset) {
  const isError = dataset?.status === "ERROR";
  elements.datasetErrorCard.classList.toggle("hidden", !isError);

  if (!isError) {
    elements.datasetErrorMessage.textContent = "";
    elements.datasetErrorDetails.replaceChildren();
    return;
  }

  elements.datasetErrorMessage.textContent =
    dataset.error_message || "El archivo no pudo ser procesado.";
  elements.datasetErrorDetails.replaceChildren();

  const errorType = document.createElement("p");
  errorType.textContent = `Tipo: ${dataset.error_type || "Error de validación"}`;
  elements.datasetErrorDetails.appendChild(errorType);

  if (dataset.error_details && typeof dataset.error_details === "object") {
    const pre = document.createElement("pre");
    pre.textContent = JSON.stringify(dataset.error_details, null, 2);
    elements.datasetErrorDetails.appendChild(pre);
  }
}

function renderSelectedDataset(dataset) {
  elements.selectedDatasetTitle.textContent = dataset
    ? filenameFromKey(dataset.filename)
    : "Último análisis disponible";
  elements.selectedDatasetDate.textContent = dataset
    ? `${renderStatus(dataset.status).text} · ${formatDate(dataset.created_at)}`
    : "Sin dataset seleccionado.";

  const completedDataset = dataset?.status === "COMPLETADO" ? dataset : null;
  renderMetrics(completedDataset);
  renderBusinessHealth(completedDataset);
  renderInsights(completedDataset);
  renderRecommendations(completedDataset);
  renderCharts(completedDataset);
  renderDatasetError(dataset);
}

function qualityText(dataset) {
  const quality = dataset?.summary?.insights?.datasetQuality;
  return Number.isFinite(Number(quality))
    ? `${percentageFormatter.format(Number(quality))}%`
    : "-";
}

function renderDatasets(datasets) {
  state.datasets = datasets;
  selectDefaultDataset(datasets);

  elements.datasetsTable.replaceChildren();
  elements.datasetCount.textContent = `${datasets.length} dataset${datasets.length === 1 ? "" : "s"}`;

  if (datasets.length === 0) {
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = 6;
    cell.textContent = "Sin resultados todavía. Sube un CSV para iniciar el flujo.";
    row.appendChild(cell);
    elements.datasetsTable.appendChild(row);
    state.selectedDatasetId = null;
    renderSelectedDataset(null);
    return;
  }

  for (const dataset of datasets) {
    const row = document.createElement("tr");
    const status = renderStatus(dataset.status);
    row.classList.toggle("selected-row", dataset.dataset_id === state.selectedDatasetId);

    const filenameCell = document.createElement("td");
    const statusCell = document.createElement("td");
    const totalCell = document.createElement("td");
    const qualityCell = document.createElement("td");
    const dateCell = document.createElement("td");
    const actionCell = document.createElement("td");
    const actionButton = document.createElement("button");

    filenameCell.textContent = filenameFromKey(dataset.filename);
    statusCell.textContent = status.text;
    statusCell.className = `table-status ${status.className}`;
    totalCell.textContent = dataset.status === "COMPLETADO"
      ? currencyFormatter.format(dataset.total_sales || 0)
      : "-";
    qualityCell.textContent = dataset.status === "COMPLETADO" ? qualityText(dataset) : "-";
    dateCell.textContent = formatDate(dataset.created_at);
    actionButton.type = "button";
    actionButton.className = "table-action";
    actionButton.textContent = "Ver análisis";
    actionButton.dataset.datasetId = dataset.dataset_id;

    actionCell.appendChild(actionButton);
    row.append(filenameCell, statusCell, totalCell, qualityCell, dateCell, actionCell);
    elements.datasetsTable.appendChild(row);
  }

  renderSelectedDataset(getSelectedDataset());
}

async function loadDatasets({ preferredKey } = {}) {
  const data = await requestJson("/datasets");
  const datasets = Array.isArray(data.datasets) ? data.datasets : [];

  if (preferredKey) {
    const preferred = datasets.find((dataset) => dataset.filename === preferredKey);
    if (preferred) {
      state.selectedDatasetId = preferred.dataset_id;
    }
  }

  renderDatasets(datasets);
  return datasets;
}

async function loadHealth({ showOutput = false } = {}) {
  const data = await requestJson("/health");
  const maxSize = Number(data.upload?.max_file_size_bytes);

  if (Number.isInteger(maxSize) && maxSize > 0) {
    state.maxFileSizeBytes = maxSize;
  }

  elements.uploadLimit.textContent = `Límite de carga: ${formatBytes(state.maxFileSizeBytes)}`;

  if (showOutput) {
    print(elements.healthOutput, data);
  }

  return data;
}

function validateFileBeforeUpload(file) {
  if (!file) {
    throw new ApiError("Debes seleccionar un archivo CSV antes de subirlo.", {
      code: "FILE_REQUIRED"
    });
  }

  if (!file.name.toLowerCase().endsWith(".csv")) {
    throw new ApiError("Solo se permiten archivos con extensión .csv.", {
      code: "INVALID_FILE_EXTENSION"
    });
  }

  if (file.size <= 0) {
    throw new ApiError("El archivo seleccionado está vacío.", {
      code: "EMPTY_FILE"
    });
  }

  if (file.size > state.maxFileSizeBytes) {
    throw new ApiError(
      `El archivo pesa ${formatBytes(file.size)} y supera el límite de ${formatBytes(state.maxFileSizeBytes)}.`,
      { code: "FILE_TOO_LARGE" }
    );
  }
}

async function waitForDataset(expectedKey) {
  for (let attempt = 1; attempt <= POLLING_ATTEMPTS; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, POLLING_DELAY_MS));
    setUploadMessage(`Procesando archivo… consulta ${attempt}/${POLLING_ATTEMPTS}`);

    const datasets = await loadDatasets({ preferredKey: expectedKey });
    const uploadedDataset = datasets.find((dataset) => dataset.filename === expectedKey);

    if (!uploadedDataset) {
      continue;
    }

    if (uploadedDataset.status === "COMPLETADO") {
      return uploadedDataset;
    }

    if (uploadedDataset.status === "ERROR") {
      throw new ApiError(
        uploadedDataset.error_message || "El archivo fue rechazado durante la validación.",
        {
          code: uploadedDataset.error_type || "CSV_VALIDATION_ERROR",
          details: uploadedDataset.error_details
        }
      );
    }
  }

  throw new ApiError(
    "El archivo fue subido, pero el procesamiento todavía no termina. Usa “Actualizar resultados” en unos segundos.",
    { code: "PROCESSING_TIMEOUT" }
  );
}

async function uploadCsv() {
  if (state.uploadInProgress) {
    return;
  }

  const file = elements.csvFileInput.files?.[0];

  try {
    validateFileBeforeUpload(file);
    setUploadBusy(true);
    setUploadState("Solicitando URL", "pending");
    setUploadMessage("Solicitando una URL de carga segura a la API…");

    const uploadData = await requestJson("/upload-url", {
      method: "POST",
      body: JSON.stringify({
        filename: file.name,
        file_size: file.size
      })
    });

    if (!uploadData.upload_url || !uploadData.key) {
      throw new ApiError("La API no devolvió los datos necesarios para subir el archivo.", {
        code: "INVALID_UPLOAD_RESPONSE"
      });
    }

    setUploadState("Subiendo CSV", "pending");
    setUploadMessage(`Subiendo ${filenameFromKey(uploadData.key)} directamente a S3…`);

    const uploadResponse = await fetch(uploadData.upload_url, {
      method: "PUT",
      body: file,
      headers: {
        "content-type": file.type || "text/csv"
      }
    });

    if (!uploadResponse.ok) {
      throw new ApiError(`S3 respondió con HTTP ${uploadResponse.status}.`, {
        code: "S3_UPLOAD_FAILED",
        status: uploadResponse.status
      });
    }

    setUploadState("Analizando", "pending");
    setUploadMessage("Archivo recibido. Esperando el análisis de la Lambda procesadora…");

    await waitForDataset(uploadData.key);

    setUploadState("Completado", "ok");
    setUploadMessage("Análisis completado. El panel muestra el dataset recién procesado.", "ok");
    elements.csvFileInput.value = "";
    elements.selectedFile.textContent = "Ningún archivo seleccionado";
  } catch (error) {
    setUploadState("No completado", "error");
    setUploadMessage(error.message || "Ocurrió un error inesperado.", "error");
  } finally {
    setUploadBusy(false);
  }
}

elements.csvFileInput.addEventListener("change", () => {
  const file = elements.csvFileInput.files?.[0];
  elements.selectedFile.textContent = file
    ? `${file.name} · ${formatBytes(file.size)}`
    : "Ningún archivo seleccionado";
});

elements.datasetsTable.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-dataset-id]");

  if (!button) {
    return;
  }

  state.selectedDatasetId = button.dataset.datasetId;
  renderDatasets(state.datasets);
  document.getElementById("analysis-content")?.scrollIntoView({
    behavior: "smooth",
    block: "start"
  });
});

document.getElementById("btn-health").addEventListener("click", async () => {
  try {
    elements.healthOutput.textContent = "Consultando…";
    await loadHealth({ showOutput: true });
  } catch (error) {
    print(elements.healthOutput, {
      error: error.message,
      code: error.code
    });
  }
});

for (const buttonId of ["btn-datasets", "btn-refresh"]) {
  document.getElementById(buttonId).addEventListener("click", async () => {
    try {
      setUploadMessage("Actualizando resultados…");
      await loadDatasets();
      setUploadMessage("Resultados actualizados.", "ok");
    } catch (error) {
      setUploadMessage(error.message, "error");
    }
  });
}

elements.uploadButton.addEventListener("click", uploadCsv);

Promise.all([
  loadHealth().catch(() => {
    elements.uploadLimit.textContent = `Límite de carga: ${formatBytes(state.maxFileSizeBytes)}`;
  }),
  loadDatasets().catch(() => {
    renderDatasets([]);
  })
]);
