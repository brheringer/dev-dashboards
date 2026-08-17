import { config } from "../config.js";

function getAuthHeader() {
  const pat = config.secrets.adoPat;
  if (!pat) {
    throw new Error("ADO_PAT is not set. Add it to your .env file.");
  }
  const token = Buffer.from(`:${pat}`).toString("base64");
  return `Basic ${token}`;
}

function baseUrl() {
  const org = encodeURIComponent(config.azureDevOps.organization);
  return `https://dev.azure.com/${org}`;
}

/**
 * Shared Azure DevOps REST helper.
 * @param {string} pathRelative - path after org, starting with /
 * @param {object} [options]
 */
export async function adoFetch(pathRelative, options = {}) {
  const { method = "GET", body, apiVersion = "7.1", query = {} } = options;
  const url = new URL(`${baseUrl()}${pathRelative}`);
  url.searchParams.set("api-version", apiVersion);
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null) {
      url.searchParams.set(key, String(value));
    }
  }

  const headers = {
    Authorization: getAuthHeader(),
    Accept: "application/json",
  };

  let payload;
  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    payload = JSON.stringify(body);
  }

  const response = await fetch(url, { method, headers, body: payload });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(
      `Azure DevOps ${method} ${url.pathname} failed (${response.status}): ${text}`
    );
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
}

export function projectPath() {
  return `/${encodeURIComponent(config.azureDevOps.project)}`;
}
