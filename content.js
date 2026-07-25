// Content script: show an "add to LangUp" button next to the selected word and
// send the capture to the background worker (which talks to the API).
let button = null;

function pageLanguage() {
  const raw = document.documentElement.lang || navigator.language || "en";
  const code = raw.slice(0, 2).toLowerCase();
  return code.length >= 2 ? code : "en";
}

function setButtonState(text, color) {
  if (!button) return;
  button.textContent = text;
  button.style.color = color || "#3b5bdb";
}

function createButton(x, y, selectedText, sentence) {
  removeButton();

  button = document.createElement("button");
  button.textContent = "+";
  Object.assign(button.style, {
    position: "absolute",
    left: x + "px",
    top: y + "px",
    zIndex: "2147483647",
    background: "#fff",
    color: "#3b5bdb",
    border: "1px solid #c7d0ff",
    borderRadius: "50%",
    width: "30px",
    height: "30px",
    fontSize: "18px",
    fontWeight: "700",
    lineHeight: "1",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
    userSelect: "none",
    padding: "0",
  });
  button.title = `Save "${selectedText}" to LangUp`;

  document.body.appendChild(button);

  button.addEventListener("click", async function (e) {
    e.stopPropagation();
    e.preventDefault();
    setButtonState("…", "#888");

    const payload = {
      word: selectedText,
      sentence: sentence,
      language: pageLanguage(),
      url: location.href,
      title: document.title,
    };

    // A content script injected before the extension was reloaded/updated is
    // orphaned: chrome.runtime is gone and every call throws "Extension context
    // invalidated". Ask for a refresh instead of failing silently.
    if (!chrome.runtime?.id) return warnStaleContext();

    try {
      chrome.runtime.sendMessage({ type: "CAPTURE_WORD", payload }, (res) => {
        if (chrome.runtime.lastError || !res) {
          setButtonState("✗", "#e03131");
        } else if (res.ok) {
          setButtonState("✓", "#2f9e44");
        } else if (res.error === "not_authed") {
          setButtonState("🔒", "#e8590c");
          showBubble("Sign in to LangUp first — click the extension icon.");
        } else if (res.error === "no_native_language") {
          // Gentle, one-time nudge: the word is NOT saved until a language is set.
          setButtonState("🌐", "#f08c00");
          showBubble("Almost there! Open LangUp (click the icon) and choose your native language — we need it to translate your words.");
        } else {
          setButtonState("✗", "#e03131");
        }
        // Keep the button briefly; the bubble lives on its own and lingers longer.
        setTimeout(removeButton, 1100);
      });
    } catch {
      warnStaleContext();
    }
  });

  setTimeout(() => document.addEventListener("click", documentClickHandler), 0);
}

// A soft, self-dismissing note next to the "+" — gentler than a blocking alert.
function showBubble(message) {
  if (!button) return;
  const bubble = document.createElement("div");
  bubble.textContent = message;
  Object.assign(bubble.style, {
    position: "absolute",
    left: button.style.left,
    top: parseInt(button.style.top, 10) + 36 + "px",
    zIndex: "2147483647",
    maxWidth: "230px",
    background: "#1e2240",
    color: "#e8eaf6",
    border: "1px solid #6c8cff",
    borderRadius: "10px",
    padding: "9px 11px",
    fontSize: "12px",
    fontFamily: "system-ui, 'Segoe UI', Arial, sans-serif",
    lineHeight: "1.4",
    boxShadow: "0 6px 18px rgba(0,0,0,0.35)",
    userSelect: "none",
    pointerEvents: "none",
  });
  document.body.appendChild(bubble);
  setTimeout(() => bubble.remove(), 4000);
}

function warnStaleContext() {
  setButtonState("⟳", "#e8590c");
  showBubble("LangUp was updated — reload the page (F5) to keep saving words.");
  setTimeout(removeButton, 1100);
}

function documentClickHandler(e) {
  if (button && e.target !== button) removeButton();
}

function removeButton() {
  if (button) {
    button.remove();
    button = null;
    document.removeEventListener("click", documentClickHandler);
  }
}

function handleSelection() {
  const selection = window.getSelection();
  const selectedText = selection.toString().trim();

  if (!selectedText || selection.rangeCount === 0) {
    removeButton();
    return;
  }

  const range = selection.getRangeAt(0);
  const rect = range.getBoundingClientRect();
  if (rect.width === 0 && rect.height === 0) return;

  const nodeText = range.startContainer.textContent || "";
  const sentences = nodeText
    .split(/(?<=[.!?;:])\s+/)
    .map((s) => s.trim().replace(/^[;:,"'\s]+|[;:,"'\s]+$/g, ""))
    .filter((s) => s.length > 0);
  const sentence = sentences.find((s) => s.includes(selectedText)) || nodeText.trim();

  const x = rect.right + window.scrollX + 5;
  const y = rect.top + window.scrollY + rect.height / 2 - 15;

  createButton(x, y, selectedText, sentence);
}

document.addEventListener("mouseup", (e) => {
  if (button && button.contains(e.target)) return;
  handleSelection();
});

document.addEventListener("dblclick", (e) => {
  if (button && button.contains(e.target)) return;
  handleSelection();
});

document.addEventListener("selectionchange", () => {
  if (window.getSelection().toString().trim() === "") removeButton();
});
