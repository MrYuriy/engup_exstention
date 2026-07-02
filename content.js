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
  button.title = `Зберегти "${selectedText}" у LangUp`;

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

    chrome.runtime.sendMessage({ type: "CAPTURE_WORD", payload }, (res) => {
      if (chrome.runtime.lastError || !res) {
        setButtonState("✗", "#e03131");
      } else if (res.ok) {
        setButtonState("✓", "#2f9e44");
      } else if (res.error === "not_authed") {
        setButtonState("🔒", "#e8590c");
        alert("Увійдіть через Google у вікні розширення (натисніть на іконку LangUp).");
      } else {
        setButtonState("✗", "#e03131");
      }
      setTimeout(removeButton, 900);
    });
  });

  setTimeout(() => document.addEventListener("click", documentClickHandler), 0);
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
