document.addEventListener("DOMContentLoaded", () => {
  const input = document.getElementById("apiUrl");
  const saveBtn = document.getElementById("saveBtn");

  // Завантажуємо існуючий URL
  chrome.storage.sync.get("apiUrl", (data) => {
    if (data.apiUrl) {
      input.value = data.apiUrl;
    }
  });

  // Зберігаємо новий URL
  saveBtn.addEventListener("click", () => {
    const url = input.value.trim();
    if (url) {
      chrome.storage.sync.set({ apiUrl: url }, () => {
        alert("API URL збережено!");
      });
    } else {
      alert("Будь ласка, введіть коректний URL.");
    }
  });
});
