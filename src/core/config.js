// Build-time configuration baked into the widget bundle.
//
// `NUVEMCHAT_BASE_URL` is the API host the widget talks to. Embedders do
// NOT pass this — the SDK is published per-environment, so the URL is
// fixed at build time. Override at build time by setting
// `VITE_WIDGET_BASE_URL` in the build environment (CI / local .env).

const BUILD_TIME_OVERRIDE =
  typeof import.meta !== 'undefined' && import.meta.env
    ? import.meta.env.VITE_WIDGET_BASE_URL
    : undefined;

export const NUVEMCHAT_BASE_URL = BUILD_TIME_OVERRIDE || 'https://back-chat.adslogin.com.br';

export const COPYRIGHT = 'Powered by MultiChat';
