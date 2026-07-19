// Shared config + auth/token helpers. Loaded by the popup and imported by the
// background service worker (importScripts). NOT used in the content script.
const LANGUP = {
  API_BASE: "https://langup.piatek-magazyn.com/api",
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

async function langupLogout() {
  // Tell the server too, otherwise the refresh token stays usable for a month.
  const { refresh_token } = await langupGetTokens();
  await langupClearTokens();
  if (!refresh_token) return;
  try {
    await fetch(`${LANGUP.API_BASE}/auth/logout`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token }),
    });
  } catch {
    /* already signed out locally; nothing useful to do */
  }
}

// Refresh tokens rotate: the server retires each one as it is used, and
// replaying a spent token is treated as theft and ends every session. The popup
// and the background worker both make calls, so refreshes are funnelled through
// one promise instead of racing with the same token.
let langupRefreshInFlight = null;

async function langupRefresh() {
  if (!langupRefreshInFlight) {
    langupRefreshInFlight = langupDoRefresh().finally(() => (langupRefreshInFlight = null));
  }
  return langupRefreshInFlight;
}

async function langupDoRefresh() {
  const { refresh_token } = await langupGetTokens();
  if (!refresh_token) return false;
  try {
    const resp = await fetch(`${LANGUP.API_BASE}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token }),
    });
    if (!resp.ok) {
      // The session is gone for good; dead tokens would only make every later
      // request retry against them.
      await langupClearTokens();
      return false;
    }
    await langupSetTokens(await resp.json());
    return true;
  } catch {
    return false; // network blip — keep the tokens and let the caller retry
  }
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
