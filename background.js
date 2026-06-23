// Background service worker: performs authenticated API calls on behalf of the
// content script (extension context bypasses page CORS via host_permissions).
importScripts("config.js");

chrome.runtime.onInstalled.addListener(() => {
  console.log("LangUp extension installed");
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
