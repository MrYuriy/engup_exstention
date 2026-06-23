// Shared config + auth/token helpers. Loaded by the popup and imported by the
// background service worker (importScripts). NOT used in the content script.
const LANGUP = {
  API_BASE: "https://langup-backend.onrender.com/api",
  GOOGLE_CLIENT_ID:
    "471613816800-9smmatdn665mn85tivimn9dh1iegto76.apps.googleusercontent.com",
};

async function langupGetTokens() {
  return chrome.storage.local.get(["access_token", "refresh_token"]);
}

async function langupSetTokens(tokens) {
  await chrome.storage.local.set({
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
  });
}

async function langupClearTokens() {
  await chrome.storage.local.remove(["access_token", "refresh_token"]);
}

async function langupRefresh() {
  const { refresh_token } = await langupGetTokens();
  if (!refresh_token) return false;
  const resp = await fetch(`${LANGUP.API_BASE}/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh_token }),
  });
  if (!resp.ok) return false;
  await langupSetTokens(await resp.json());
  return true;
}

// Authenticated fetch with a single transparent refresh retry on 401.
// Works from the popup and the background worker (host_permissions bypass CORS).
async function langupApiFetch(path, options = {}, retry = true) {
  const { access_token } = await langupGetTokens();
  const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
  if (access_token) headers["Authorization"] = "Bearer " + access_token;

  const resp = await fetch(`${LANGUP.API_BASE}${path}`, { ...options, headers });
  if (resp.status === 401 && retry && (await langupRefresh())) {
    return langupApiFetch(path, options, false);
  }
  return resp;
}
