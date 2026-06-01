let apiTokenCache: string | null = null;

export async function apiFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  let token = apiTokenCache;
  if (!token && typeof window !== "undefined") {
    try {
      const electron = (window as any).electron;
      if (electron?.getWsToken) {
        token = await electron.getWsToken();
        apiTokenCache = token;
      }
    } catch {
      // Ignore
    }
  }

  const newInit = { ...init };
  const headers = new Headers(newInit.headers || {});
  if (token) {
    headers.set("x-api-token", token);
  }
  newInit.headers = headers;

  const res = await fetch(input, newInit);
  if (!res.ok) {
    const originalJson = res.json.bind(res);
    res.json = async () => {
      try {
        return await originalJson();
      } catch {
        return { error: res.statusText || "Unauthorized", ok: false };
      }
    };
  }
  return res;
}
