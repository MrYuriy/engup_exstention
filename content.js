let button = null;

function createButton(x, y, selectedText, sentence) {
    removeButton();

    button = document.createElement("button");
    button.textContent = "+";
    button.style.position = "absolute";
    button.style.left = x + "px";
    button.style.top = y + "px";
    button.style.zIndex = "10000";
    button.style.background = "white";
    button.style.border = "1px solid #ccc";
    button.style.borderRadius = "50%";
    button.style.width = "30px";
    button.style.height = "30px";
    button.style.display = "flex";
    button.style.alignItems = "center";
    button.style.justifyContent = "center";
    button.style.cursor = "pointer";
    button.style.boxShadow = "0 2px 5px rgba(0,0,0,0.2)";
    button.style.userSelect = "none";

    document.body.appendChild(button);

    button.addEventListener("click", async function (e) {
        e.stopPropagation();
        e.preventDefault();

        const payload = {
            word: selectedText,
            sentence: sentence,
            user_id: 1, // додати логіку користувача пізніше
        };

        console.log("Sending:", payload);

        try {
            const response = await fetch("http://127.0.0.1:8000/words/", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(payload),
            });

            if (!response.ok) {
                console.error("❌ Server error:", response.status, await response.text());
            } else {
                const data = await response.json();
                console.log("✅ Server response:", data);
            }
        } catch (err) {
            console.error("⚠️ Fetch error:", err);
        }

        removeButton();
        return false;
    });

    setTimeout(() => {
        document.addEventListener("click", documentClickHandler);
    }, 0);
}

function documentClickHandler(e) {
    if (button && e.target !== button) {
        removeButton();
    }
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

    if (rect.width === 0 && rect.height === 0) {
        return;
    }

    let nodeText = range.startContainer.textContent || "";

    const sentences = nodeText
        .split(/(?<=[.!?;:])\s+/) // ділимо по . ! ? ; :
        .map(s => s.trim().replace(/^[;:,"'\s]+|[;:,"'\s]+$/g, ""))
        .filter(s => s.length > 0);

    let sentence = sentences.find(s => s.includes(selectedText)) || nodeText.trim();

    const x = rect.right + window.scrollX + 5;
    const y = rect.top + window.scrollY + rect.height / 2 - 15;

    createButton(x, y, selectedText, sentence);
}

document.addEventListener("mouseup", function (e) {
    if (button && button.contains(e.target)) return;
    handleSelection();
});

document.addEventListener("dblclick", function (e) {
    if (button && button.contains(e.target)) return;
    handleSelection();
});

document.addEventListener("selectionchange", function () {
    const selection = window.getSelection();
    if (selection.toString().trim() === "") {
        removeButton();
    }
});
