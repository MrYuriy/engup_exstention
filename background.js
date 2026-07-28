// Background service worker: performs authenticated API calls on behalf of the
// content script (extension context bypasses page CORS via host_permissions).
importScripts("config.js");

const MENU_ID = "langup-save-word";

// Right-click "save word" — works on regular pages AND inside Chrome's built-in
// PDF viewer (where the floating "+" content-script button cannot reach).
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: MENU_ID,
      title: 'Save "%s" to LangUp',
      contexts: ["selection"],
    });
  });
  console.log("LangUp extension installed");
});

function flashBadge(text, color) {
  chrome.action.setBadgeText({ text });
  chrome.action.setBadgeBackgroundColor({ color });
  setTimeout(() => chrome.action.setBadgeText({ text: "" }), 1600);
}

chrome.contextMenus.onClicked.addListener(async (info) => {
  if (info.menuItemId !== MENU_ID) return;
  const word = (info.selectionText || "").trim();
  if (!word) return;

  // Language of the word being learned isn't reliably available in the PDF
  // viewer, so default to "en" (change here if you mostly read other languages).
  const res = await captureWord({ word, language: "en" });
  if (res.ok) flashBadge("✓", "#2f9e44");
  else if (res.error === "not_authed" || res.error === "no_native_language") flashBadge("!", "#e8590c");
  else flashBadge("✗", "#e03131");
});

async function captureWord({ word, language, sentence, url, title }) {
  const { access_token } = await langupGetTokens();
  if (!access_token) return { ok: false, error: "not_authed" };

  // Don't save anything until the account has a native language: without it we
  // can't translate the word. Check the cached flag first, then confirm once
  // against the server (in case the picker was completed in another session).
  if (!(await langupHasNativeLanguage())) {
    const me = await langupApiFetch("/auth/me");
    const user = me.ok ? await me.json() : null;
    if (user && user.native_language) {
      await langupSetNativeLanguage(user.native_language);
    } else {
      return { ok: false, error: "no_native_language" };
    }
  }

  // Personal vocabulary: stores the word + its sentence/source for the user.
  const resp = await langupApiFetch("/vocabulary", {
    method: "POST",
    body: JSON.stringify({
      word,
      language,
      sentence: sentence || null,
      source_url: url || null,
      source_title: title || null,
    }),
  });

  if (resp.ok) return { ok: true };
  if (resp.status === 401) return { ok: false, error: "not_authed" };
  if (resp.status === 400) {
    // The backend also enforces the native-language rule; if our cached flag was
    // stale (e.g. it was cleared server-side), honour the server and re-prompt.
    const body = await resp.json().catch(() => ({}));
    if (body.detail === "native_language_required") {
      await langupSetNativeLanguage(null);
      return { ok: false, error: "no_native_language" };
    }
  }
  return { ok: false, error: String(resp.status) };
}

// Google sign-in runs HERE, in the service worker — not in the popup. On Linux
// the popup closes the moment the Google auth window takes focus, which killed
// the popup-based flow silently (its JS context was gone before the token came
// back). The worker survives, so the flow completes and tokens are stored; the
// popup just reads them when it reopens.
async function googleSignIn() {
  const redirectUri = chrome.identity.getRedirectURL();
  const nonce = Math.random().toString(36).slice(2) + Date.now();
  const params = new URLSearchParams({
    client_id: LANGUP.GOOGLE_CLIENT_ID,
    response_type: "id_token",
    redirect_uri: redirectUri,
    scope: "openid email profile",
    nonce,
    prompt: "select_account",
  });
  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;

  let redirectedTo;
  try {
    redirectedTo = await chrome.identity.launchWebAuthFlow({ url: authUrl, interactive: true });
  } catch (e) {
    return { ok: false, error: (e && e.message) || "auth_flow_failed" };
  }
  const match = /[#&]id_token=([^&]+)/.exec(redirectedTo || "");
  if (!match) return { ok: false, error: "no_id_token" };

  const resp = await fetch(`${LANGUP.API_BASE}/auth/google`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id_token: match[1] }),
  });
  if (!resp.ok) return { ok: false, error: "backend_" + resp.status };
  await langupSetTokens(await resp.json());
  // The popup may have closed during the flow; a badge signals "signed in —
  // reopen me" so the user isn't left staring at a blank icon.
  flashBadge("✓", "#2f9e44");
  return { ok: true };
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "CAPTURE_WORD") {
    captureWord(message.payload).then(sendResponse);
    return true; // keep the channel open for the async response
  }
  if (message?.type === "GOOGLE_SIGN_IN") {
    googleSignIn()
      .then(sendResponse)
      .catch((e) => sendResponse({ ok: false, error: (e && e.message) || String(e) }));
    return true;
  }
});
