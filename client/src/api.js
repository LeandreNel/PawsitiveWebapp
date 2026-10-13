const apiRoot = import.meta.env.VITE_API_URL || "";

export function apiUrl(path) {
  return `${apiRoot}/api${path}`;
}

export async function api(path, options = {}) {
  const response = await fetch(apiUrl(path), {
    ...options,
    credentials: "include",
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...options.headers,
    },
  });

  if (response.status === 204) return null;
  const contentType = response.headers.get("content-type") || "";
  const payload = contentType.includes("application/json")
    ? await response.json()
    : await response.text();
  if (!response.ok) {
    throw new Error(
      typeof payload === "object" && payload?.error
        ? payload.error
        : `Request failed (${response.status}).`,
    );
  }
  return payload;
}
