import process from "node:process";

export function getSeltraApiConfig() {
  const baseUrl = process.env.SELTRA_API_BASE_URL?.replace(/\/$/, "") ?? "";
  const apiKey =
    process.env.SELTRA_INTERNAL_API_KEY ||
    process.env.OPS_INTERNAL_API_KEY ||
    "";

  return { baseUrl, apiKey };
}

export async function seltraInternalFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const { baseUrl, apiKey } = getSeltraApiConfig();

  if (!baseUrl || !apiKey) {
    throw new Error("Missing SELTRA_API_BASE_URL or SELTRA_INTERNAL_API_KEY");
  }

  let response: Response;
  try {
    response = await fetch(`${baseUrl}${path}`, {
      ...init,
      headers: {
        Accept: "application/json",
        "X-Internal-Api-Key": apiKey,
        ...init?.headers,
      },
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
  const { baseUrl, apiKey } = getSeltraApiConfig();

  if (!baseUrl || !apiKey) {
    throw new Error("Missing SELTRA_API_BASE_URL or SELTRA_INTERNAL_API_KEY");
  }

  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      Accept: "text/csv",
      "X-Internal-Api-Key": apiKey,
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

