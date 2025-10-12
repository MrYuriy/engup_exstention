document.getElementById("loginBtn").addEventListener("click", async () => {
    const username = document.getElementById("username").value.trim();
    const password = document.getElementById("password").value.trim();
    const status = document.getElementById("status");

    if (!username || !password) {
        status.textContent = "❌ Введіть логін і пароль";
        return;
    }

    try {
        const formData = new FormData();
        formData.append('username', username);
        formData.append('password', password);

        const response = await fetch("https://engup-backend.onrender.com/users/login", {
            method: "POST",
            body: formData
        });

     if (!response.ok) {
            status.textContent = "❌ Помилка авторизації";
            return;
        }

        const data = await response.json();
        const token = data.access_token;

        await chrome.storage.local.set({ token: token });

        const result = await chrome.storage.local.get("token");
        console.log("🔑 Token збережений:", result.token);

        status.textContent = "✅ Успішний вхід!";
    } catch (err) {
        console.error("⚠️ Fetch error:", err);
        status.textContent = "⚠️ Помилка мережі";
    }
});