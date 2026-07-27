# Chrome Web Store — submission pack

Everything you paste into the Developer Dashboard when publishing LangUp.

## Basics
- **Name:** LangUp
- **Category:** Education
- **Language:** English
- **Version:** 2.0 (from manifest.json)

## Single purpose (Dashboard → "Single purpose")
> LangUp lets a language learner save words — together with the sentence they
> appeared in and the page they came from — from any web page into their personal
> LangUp vocabulary, to study and practise later.

## Short description (≤132 chars)
> Save words from any web page into your LangUp vocabulary and learn them in
> context.

## Detailed description
> LangUp turns your everyday reading into vocabulary practice.
>
> • Select any word on any page and click "+" to save it — the extension keeps
>   the sentence it appeared in and the source, so you learn words in context.
> • Also works from the right‑click menu, including Chrome's built‑in PDF viewer.
> • Sign in with Google or with an email and password.
> • Saved words sync to your LangUp account, where they're translated into your
>   native language and turned into practice exercises.
>
> LangUp only acts on the words you choose to save — it doesn't track your
> browsing.

## Permission justifications (Dashboard → "Privacy practices")

- **storage** — Store the login session (auth tokens) and the user's chosen native
  language locally so they stay signed in and aren't reconfigured on every use.
- **identity** — "Sign in with Google": obtain a Google ID token via
  `chrome.identity.launchWebAuthFlow` to authenticate the user to the LangUp
  backend. No other use.
- **contextMenus** — Add a right‑click "Save to LangUp" item so a selected word can
  be saved, including inside Chrome's built‑in PDF viewer where the on‑page button
  cannot appear.
- **Host permission `https://langup.piatek-magazyn.com/*`** — The LangUp API. Saving
  words and managing the account require calling it; it is the only host the
  extension sends data to.
- **Content script on `<all_urls>`** — The core purpose is capturing vocabulary from
  whatever the user reads, so the small "save word" button must be available on any
  site. It activates only on the user's text selection and sends data only when the
  user explicitly clicks save.

## Remote code
> No. All code is bundled in the package; nothing is fetched or executed from a
> remote source.

## Data usage disclosures (checkboxes)
- Personally identifiable information (name, email): **Yes** — for authentication.
- Authentication information: **Yes** — tokens stored locally; credentials sent only
  to the LangUp backend.
- Website content (the saved word, its sentence, the page URL/title): **Yes** — only
  for words the user explicitly saves.
- Location, health, financial, personal communications, web history, user activity
  beyond explicit saves: **No.**
- We do **not** sell data or use it for purposes unrelated to the single purpose.
- We do **not** use or transfer data for advertising/creditworthiness.

## Privacy policy URL
> Host `PRIVACY_POLICY.md` (or `privacy.html`) at a public URL and paste it here,
> e.g. `https://langup.piatek-magazyn.com/app/privacy.html`.

## Assets still needed (manual)
- **Screenshots:** 1–5 at 1280×800 or 640×400 (e.g. the popup sign‑in, the "+" on a
  selected word, the native‑language step, the saved‑word confirmation).
- **Store icon:** 128×128 (already in the package as `icon-128.png`).
- Optional: small promo tile 440×280.

## Pre‑submit checklist
- [ ] Privacy policy hosted; URL added.
- [ ] Permission justifications pasted (above).
- [ ] Data‑usage disclosures filled (above).
- [ ] Screenshots uploaded.
- [ ] Contact email set in the Dashboard and in PRIVACY_POLICY.md.
- [ ] Upload `langup-extension-v2.0.zip`.
