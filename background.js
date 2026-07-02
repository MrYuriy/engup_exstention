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
      title: 'Зберегти "%s" у LangUp',
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
  else if (res.error === "not_authed") flashBadge("!", "#e8590c");
  else flashBadge("✗", "#e03131");
});

async function captureWord({ word, language }) {
  const { access_token } = await langupGetTokens();
  if (!access_token) return { ok: false, error: "not_authed" };

  const resp = await langupApiFetch("/words", {
    method: "POST",
    body: JSON.stringify({ lemma: word, language }),
  });

  if (resp.ok) return { ok: true };
  if (resp.status === 409) return { ok: true, duplicate: true }; // already in dictionary
  if (resp.status === 401) return { ok: false, error: "not_authed" };
  return { ok: false, error: String(resp.status) };
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "CAPTURE_WORD") {
    captureWord(message.payload).then(sendResponse);
    return true; // keep the channel open for the async response
  }
});
