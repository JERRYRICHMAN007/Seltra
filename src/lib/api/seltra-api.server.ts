import process from "node:process";

const PRODUCTION_SELTRA_API_BASE_URL = "https://seltra-merchant-backend.onrender.com";
const LOCAL_SELTRA_API_BASE_URL = "http://localhost:3001";

function defaultSeltraApiBaseUrl() {
  // Prefer local merchant backend during local Ops development.
  if (process.env.NODE_ENV !== "production") return LOCAL_SELTRA_API_BASE_URL;
  return PRODUCTION_SELTRA_API_BASE_URL;
}

export function getSeltraApiConfig() {
  const baseUrl = (
    process.env.SELTRA_API_BASE_URL ||
    process.env.VITE_SELTRA_API_BASE_URL ||
    defaultSeltraApiBaseUrl()
  ).replace(/\/$/, "");

  const apiKey =
    process.env.SELTRA_INTERNAL_API_KEY ||
    process.env.OPS_INTERNAL_API_KEY ||
    "";

  const opsActor = process.env.OPS_ACTOR || "admin@seltra.co";

  return { baseUrl, apiKey, opsActor };
}

function opsHeaders(apiKey: string, opsActor: string, init?: RequestInit): HeadersInit {
  return {
    Accept: "application/json",
    "X-Internal-Api-Key": apiKey,
    "X-Ops-Actor": opsActor,
    ...init?.headers,
  };
}

export async function seltraInternalFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const { baseUrl, apiKey, opsActor } = getSeltraApiConfig();

  if (!apiKey) {
    throw new Error(
      "Missing SELTRA_INTERNAL_API_KEY (or OPS_INTERNAL_API_KEY). Add it in .env for local, or Vercel → Environment Variables for production.",
    );
  }

  let response: Response;
  try {
    response = await fetch(`${baseUrl}${path}`, {
      ...init,
      headers: opsHeaders(apiKey, opsActor, init),
    });
  } catch (err) {
    const reason = err instanceof Error ? err.message : "network error";
    throw new Error(`Cannot reach Seltra API at ${baseUrl}${path} (${reason})`);
  }

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(
      body ? `Seltra API ${response.status}: ${body}` : `Seltra API request failed (${response.status})`,
    );
  }

  return response.json() as Promise<T>;
}

export async function seltraInternalFetchText(path: string, init?: RequestInit): Promise<string> {
  const { baseUrl, apiKey, opsActor } = getSeltraApiConfig();

  if (!apiKey) {
    throw new Error(
      "Missing SELTRA_INTERNAL_API_KEY (or OPS_INTERNAL_API_KEY). Add it in .env for local, or Vercel → Environment Variables for production.",
    );
  }

  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      Accept: "text/csv",
      "X-Internal-Api-Key": apiKey,
      "X-Ops-Actor": opsActor,
      ...init?.headers,
    },
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(
      body ? `Seltra API ${response.status}: ${body}` : `Seltra API request failed (${response.status})`,
    );
  }

  return response.text();
}

export function buildSeltraQuery(params: Record<string, string | number | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") search.set(key, String(value));
  }
  const query = search.toString();
  return query ? `?${query}` : "";
}
