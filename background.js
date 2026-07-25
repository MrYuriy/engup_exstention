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

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "CAPTURE_WORD") {
    captureWord(message.payload).then(sendResponse);
    return true; // keep the channel open for the async response
  }
});
