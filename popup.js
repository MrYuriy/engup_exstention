const $ = (id) => document.getElementById(id);

function setStatus(text) {
  $("status").textContent = text || "";
}

function render(user) {
  if (user) {
    $("p-name").textContent = user.full_name || "Без імені";
    $("p-email").textContent = user.email;
    $("avatar").textContent = (user.full_name || user.email || "?").trim().charAt(0).toUpperCase();
    $("login-view").classList.add("hidden");
    $("profile-view").classList.remove("hidden");
  } else {
    $("profile-view").classList.add("hidden");
    $("login-view").classList.remove("hidden");
  }
}

async function loadProfile() {
  const { access_token } = await langupGetTokens();
  if (!access_token) return null;
  const resp = await langupApiFetch("/auth/me");
  return resp.ok ? resp.json() : null;
}

// Email + password sign-in/sign-up against our backend.
async function passwordAuth(endpoint) {
  const email = $("email").value.trim();
  const password = $("password").value;
  const resp = await fetch(`${LANGUP.API_BASE}/auth/${endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!resp.ok) {
    const body = await resp.json().catch(() => null);
    throw new Error((body && body.detail) || "Помилка (" + resp.status + ")");
  }
  await langupSetTokens(await resp.json());
}

// Get a Google ID token via the extension auth flow, then exchange it with our backend.
async function signInWithGoogle() {
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

  const redirectedTo = await chrome.identity.launchWebAuthFlow({ url: authUrl, interactive: true });
  const match = /[#&]id_token=([^&]+)/.exec(redirectedTo || "");
  if (!match) throw new Error("Google не повернув id_token");

  const resp = await fetch(`${LANGUP.API_BASE}/auth/google`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id_token: match[1] }),
  });
  if (!resp.ok) throw new Error("Бекенд відхилив токен (" + resp.status + ")");
  await langupSetTokens(await resp.json());
}

document.addEventListener("DOMContentLoaded", async () => {
  $("redirect-uri").textContent = chrome.identity.getRedirectURL();

  $("password-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    setStatus("Входжу…");
    try {
      await passwordAuth("login");
      render(await loadProfile());
      setStatus("");
    } catch (err) {
      setStatus("Помилка входу: " + err.message);
    }
  });

  $("register-btn").addEventListener("click", async () => {
    if (!$("password-form").reportValidity()) return;
    setStatus("Створюю акаунт…");
    try {
      await passwordAuth("register");
      render(await loadProfile());
      setStatus("");
    } catch (err) {
      setStatus("Помилка реєстрації: " + err.message);
    }
  });

  $("login-btn").addEventListener("click", async () => {
    setStatus("Відкриваю Google…");
    try {
      await signInWithGoogle();
      render(await loadProfile());
      setStatus("");
    } catch (err) {
      setStatus("Помилка входу: " + err.message);
    }
  });

  $("logout-btn").addEventListener("click", async () => {
    await langupLogout();
    render(null);
  });

  render(await loadProfile());
});
