const apiEndpoint = window.DATOSSUR_CONFIG?.apiEndpoint;

const healthOutput = document.getElementById("health-output");
const datasetsOutput = document.getElementById("datasets-output");

function print(element, data) {
  element.textContent = JSON.stringify(data, null, 2);
}

async function getJson(path) {
  if (!apiEndpoint) {
    throw new Error("API endpoint no configurado.");
  }

  const response = await fetch(`${apiEndpoint}${path}`);

  if (!response.ok) {
    throw new Error(`Error HTTP ${response.status}`);
  }

  return response.json();
}

document.getElementById("btn-health").addEventListener("click", async () => {
  try {
    healthOutput.textContent = "Consultando...";
    const data = await getJson("/health");
    print(healthOutput, data);
  } catch (error) {
    print(healthOutput, { error: error.message });
  }
});

document.getElementById("btn-datasets").addEventListener("click", async () => {
  try {
    datasetsOutput.textContent = "Consultando...";
    const data = await getJson("/datasets");
    print(datasetsOutput, data);
  } catch (error) {
    print(datasetsOutput, { error: error.message });
  }
});
