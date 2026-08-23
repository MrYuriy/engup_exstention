const $ = (id) => document.getElementById(id);

let currentUser = null;

function setStatus(text) {
  $("status").textContent = text || "";
}

function showView(id) {
  for (const v of ["login-view", "lang-view", "profile-view"]) {
    $(v).classList.toggle("hidden", v !== id);
  }
}

function renderProfile(user) {
  $("p-name").textContent = user.full_name || extT("no_name");
  $("p-email").textContent = user.email;
  $("avatar").textContent = (user.full_name || user.email || "?").trim().charAt(0).toUpperCase();
  showView("profile-view");
  // Saving is blocked until the email is confirmed; nudge the user to the site,
  // where the confirmation email can be resent.
  setStatus(user.is_email_verified ? "" : extT("confirm_email"));
}

// After any successful sign-in decide where to land: a brand-new account has no
// native language yet, so it must pick one before it can use the dictionary.
// An existing profile (e.g. created on the website) already has it and skips this.
function routeAfterAuth(user) {
  currentUser = user;
  if (!user) return showView("login-view");
  // Mirror the account's language into storage so the background worker can
  // gate word saves without an extra round-trip.
  langupSetNativeLanguage(user.native_language);
  // The popup's own language follows the account: on the first open storage may
  // not have held it yet when i18n initialised, so apply it now.
  if (user.native_language && EXT_STRINGS[user.native_language]) {
    EXT_LANG = user.native_language;
    extApplyI18n();
  }
  if (!user.native_language) return showView("lang-view");
  renderProfile(user);
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
    // detail is a string for our errors, or a 422 validation array (e.g. a weak
    // password) — surface the first field message in that case.
    let msg = "Error (" + resp.status + ")";
    if (typeof body?.detail === "string") msg = body.detail;
    else if (Array.isArray(body?.detail) && body.detail[0]?.msg) {
      msg = body.detail[0].msg.replace(/^Value error, /, "");
    }
    throw new Error(msg);
  }
  await langupSetTokens(await resp.json());
}

// Sign in with Google. The actual flow runs in the background service worker
// (see background.js) because the popup can close mid-flow — especially on
// Linux — which would abandon it silently. If the popup does survive, we get
// the result here; if it closed, the worker still finished and stored the
// tokens, so reopening the popup shows the signed-in state.
async function signInWithGoogle() {
  const res = await chrome.runtime.sendMessage({ type: "GOOGLE_SIGN_IN" });
  if (!res || !res.ok) throw new Error((res && res.error) || extT("google_failed"));
}

// Save the chosen native language onto the current account, then land on the profile.
async function saveNativeLanguage(event) {
  event.preventDefault();
  const native_language = $("native-language").value;
  if (!native_language || !currentUser) return;
  $("lang-status").textContent = extT("saving");
  const resp = await langupApiFetch(`/users/${currentUser.id}`, {
    method: "PATCH",
    body: JSON.stringify({ native_language }),
  });
  if (!resp.ok) {
    $("lang-status").textContent = extT("lang_save_fail");
    return;
  }
  EXT_LANG = EXT_STRINGS[native_language] ? native_language : EXT_LANG; // popup now follows the new choice
  extApplyI18n();
  await langupSetNativeLanguage(native_language);
  $("lang-status").textContent = "";
  renderProfile(await resp.json());
}

document.addEventListener("DOMContentLoaded", async () => {
  await extI18nInit();
  extApplyI18n();
  $("redirect-uri").textContent = chrome.identity.getRedirectURL();

  $("password-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    setStatus(extT("signing_in"));
    try {
      await passwordAuth("login");
      routeAfterAuth(await loadProfile());
      setStatus("");
    } catch (err) {
      setStatus(extT("signin_error", { msg: err.message }));
    }
  });

  $("register-btn").addEventListener("click", async () => {
    if (!$("password-form").reportValidity()) return;
    setStatus(extT("creating"));
    try {
      await passwordAuth("register");
      routeAfterAuth(await loadProfile());
      setStatus("");
    } catch (err) {
      setStatus(extT("signup_error", { msg: err.message }));
    }
  });

  $("login-btn").addEventListener("click", async () => {
    setStatus(extT("opening_google"));
    try {
      await signInWithGoogle();
      routeAfterAuth(await loadProfile());
      setStatus("");
    } catch (err) {
      setStatus(extT("signin_error", { msg: err.message }));
    }
  });

  $("lang-form").addEventListener("submit", saveNativeLanguage);

  $("logout-btn").addEventListener("click", async () => {
    await langupLogout();
    currentUser = null;
    showView("login-view");
  });

  routeAfterAuth(await loadProfile());
});
