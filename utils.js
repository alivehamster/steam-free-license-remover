import { setTimeout as sleep } from "timers/promises";

function isRetryableFetchError(error) {
  const code = error?.cause?.code ?? error?.code;
  return [
    "EAI_AGAIN",
    "ENOTFOUND",
    "ECONNRESET",
    "ETIMEDOUT",
    "ECONNREFUSED",
    "EHOSTUNREACH",
    "UND_ERR_CONNECT_TIMEOUT",
    "UND_ERR_HEADERS_TIMEOUT",
    "UND_ERR_SOCKET",
  ].includes(code);
}

export async function fetchWithRetry(url, options = {}, config = {}) {
  const {
    retries = 5,
    initialDelayMs = 800,
    maxDelayMs = 12000,
    timeoutMs = 30000,
    retryLabel = "request",
  } = config;

  let lastError;
  for (let attempt = 1; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      lastError = error;

      if (attempt >= retries || !isRetryableFetchError(error)) {
        throw error;
      }

      const delay = Math.min(initialDelayMs * 2 ** (attempt - 1), maxDelayMs);
      console.warn(
        `Network error during ${retryLabel} (${error?.cause?.code ?? error?.code ?? "unknown"}). Retrying ${attempt}/${retries} in ${delay}ms`,
      );
      await sleep(delay);
    }
  }

  throw lastError;
}

export async function GetSteamLoginSecure(token) {
  const formData = new FormData();
  formData.append("redir", "https://store.steampowered.com/account/licenses/");

  const response = await fetchWithRetry(
    "https://login.steampowered.com/jwt/ajaxrefresh",
    {
      method: "POST",
      headers: {
        Cookie: `steamRefresh_steam=${token}`,
        Origin: "https://store.steampowered.com",
      },
      body: formData,
    },
    { retryLabel: "Steam token refresh" },
  );

  if (!response.ok) {
    throw new Error(`Steam token refresh failed with status ${response.status}`);
  }

  const data = await response.json();

  const newFormData = new FormData();
  newFormData.append("steamID", data.steamID);
  newFormData.append("nonce", data.nonce);
  newFormData.append("redir", data.redir);
  newFormData.append("auth", data.auth);

  const finalResponse = await fetchWithRetry(
    "https://store.steampowered.com/login/settoken",
    {
      method: "POST",
      body: newFormData,
    },
    { retryLabel: "Steam settoken" },
  );

  if (!finalResponse.ok) {
    throw new Error(`Steam settoken failed with status ${finalResponse.status}`);
  }

  const steamLoginSecure = finalResponse.headers
    .get("set-cookie")
    ?.match(/steamLoginSecure=([^;]+)/)?.[1];
  if (!steamLoginSecure) {
    console.error("Error: steamLoginSecure not found in response cookies.");
    process.exit(1);
  }
  return steamLoginSecure;
}
