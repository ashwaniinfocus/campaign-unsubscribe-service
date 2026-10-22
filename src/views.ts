import { config } from "./config";

const esc = (s: string) =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

export const maskEmail = (email: string): string => {
  const [local = "", domain = ""] = email.split("@");
  return `${local.slice(0, 1)}***@${domain}`;
};

const LOGO = `<svg viewBox="0 0 40 40" width="40" height="40" aria-hidden="true">
  <rect width="40" height="40" rx="10" fill="#fff"/>
  <path d="M20 8a12 12 0 1 0 12 12" fill="none" stroke="#0b1020" stroke-width="4" stroke-linecap="round"/>
  <path d="M20 14a6 6 0 1 0 6 6" fill="none" stroke="#0b1020" stroke-width="4" stroke-linecap="round"/>
  <circle cx="30" cy="10" r="3" fill="#e11d48"/>
</svg>`;

const ICONS = {
  mail: `<path d="M4 6h16a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1Z"/><path d="m3 7 9 6 9-6"/>`,
  check: `<circle cx="12" cy="12" r="9"/><path d="m8 12.5 2.8 2.8L16 9.5"/>`,
  alert: `<path d="M12 4 2.8 19.5h18.4L12 4Z"/><path d="M12 10v4.5M12 17.5v.01"/>`,
};

type Tone = "blue" | "green" | "amber";

const icon = (name: keyof typeof ICONS, tone: Tone) =>
  `<span class="icon icon-${tone}"><svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name]}</svg></span>`;

const layout = (title: string, inner: string) => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>${esc(title)} · ${esc(config.brandName)}</title>
<link rel="stylesheet" href="/static/styles.css">
</head>
<body>
<header class="topbar">
  <div class="brand">
    ${LOGO}
    <div>
      <div class="brand-name">${esc(config.brandName)} <span class="pill pill-violet">Email preferences</span></div>
      <div class="brand-sub">Manage the emails you receive</div>
    </div>
  </div>
</header>
<main class="stage">
  <section class="card" aria-live="polite">
${inner}
  </section>
  <p class="foot">${esc(config.brandName)} · This page only changes your own email preferences.</p>
</main>
</body>
</html>`;

const homeLink = () =>
  config.homeUrl
    ? `<a class="btn btn-ghost" href="${esc(config.homeUrl)}" rel="noopener noreferrer">Back to website</a>`
    : "";

export const confirmPage = (email: string, token: string) =>
  layout(
    "Unsubscribe",
    `    ${icon("mail", "blue")}
    <h1>Unsubscribe from emails?</h1>
    <p class="lead">You'll stop receiving emails from ${esc(config.brandName)} at</p>
    <p class="email">${esc(maskEmail(email))}</p>
    <form method="post" action="/unsubscribe" class="actions">
      <input type="hidden" name="token" value="${esc(token)}">
      <button type="submit" class="btn btn-primary">Confirm unsubscribe</button>
    </form>
    <p class="hint">Changed your mind? Close this window. Nothing changes unless you confirm. This request expires in ${config.tokenTtlMinutes} minutes.</p>`,
  );

export const donePage = (already = false) =>
  layout(
    already ? "Already unsubscribed" : "Unsubscribed",
    `    ${icon("check", "green")}
    <h1>${already ? "You're already unsubscribed" : "You've been unsubscribed"}</h1>
    <p class="lead">You won't receive further emails from ${esc(config.brandName)} at this address.</p>
    <div class="actions">${homeLink()}</div>`,
  );

export const invalidPage = () =>
  layout(
    "Link not valid",
    `    ${icon("alert", "amber")}
    <h1>This link isn't valid</h1>
    <p class="lead">Open the unsubscribe link in your email again. If it still doesn't work, reply to that email and we'll remove you manually.</p>
    <div class="actions">${homeLink()}</div>`,
  );

export const expiredPage = () =>
  layout(
    "Request expired",
    `    ${icon("alert", "amber")}
    <h1>This request expired</h1>
    <p class="lead">For your security, the confirmation only works for a short time. Open the unsubscribe link in your email again to start over.</p>
    <div class="actions">${homeLink()}</div>`,
  );

export const errorPage = () =>
  layout(
    "Something went wrong",
    `    ${icon("alert", "amber")}
    <h1>Something went wrong</h1>
    <p class="lead">We couldn't process your request. Try again in a few minutes by opening the link in your email.</p>`,
  );
