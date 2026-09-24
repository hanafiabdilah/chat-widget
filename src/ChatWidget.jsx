import React, { useEffect, useMemo, useRef } from 'react';
import { templates } from './templates/index.js';
import { createOmnichannelAdapter } from './core/adapters/omnichannelAdapter.js';
import { useConversation } from './core/useConversation.js';
import { NUVEMCHAT_BASE_URL } from './core/config.js';
import { buildPalette } from './theme/palette.js';
import { useColorScheme } from './theme/useColorScheme.js';
import { resolveStrings } from './i18n/strings.js';

// Public React component. Mount it once near the root of the host app:
//
//   <ChatWidget
//     appId="550e8400-..."             // Nuvemchat connection identifier
//     isOpen={open}
//     onOpen={() => setOpen(true)}
//     onClose={() => setOpen(false)}
//     user={user}                       // forwarded as `identify` to the API
//     accent="#7c3aed"                  // optional — overrides the dashboard colour
//     appearance="auto"                 // follows the host page's light/dark
//   />
//
// The widget is fully API-driven (see API.md):
//   - Visitor messages POST to `/widget-api/session/{token}/messages`
//   - Agent replies arrive via Reverb broadcast on `widget-session.{token}`
//   - Template + brand (title + accent colour) come from `/widget-api/config`
//
// `baseUrl` is baked into the build (see `core/config.js`) — embedders don't
// pass it.
export const ChatWidget = ({
  appId,
  template = 'proxybr',
  adapter,
  isOpen,
  onOpen,
  onClose,
  user,
  theme,
  // Host-defined quick-reply chips. Shown above the input until the visitor
  // sends their first message. Each option: { id, label, color?, message? }.
  // See `core/types.js > InitialChatOption`.
  initialChatOptions,
  // Display name for the bot (AI / flow) in message bubbles and the header.
  // Defaults to "Atendente Virtual" when empty/omitted.
  virtualAssistantName,
  // Wait for the visitor's first message before creating the conversation.
  // Off by default so existing hosts keep the boot they have; worth turning on
  // for a widget on a public page, where `POST /session` at load time files
  // every passing visitor as a conversation nobody will read. Ignored when the
  // host passes its own `adapter` — that adapter decides for itself.
  deferSession = false,

  /* ---------------------------------------------------------------- *
   * Appearance
   * ---------------------------------------------------------------- */

  // Brand colour. The dashboard's `connection.color` is the default — brand
  // belongs to the workspace, not to the page it is embedded on — and this
  // prop exists for the host that wants the widget to match its own product
  // instead. Any CSS hex or rgb() value; anything unparseable falls back to
  // the default accent rather than rendering something unreadable.
  accent,
  // 'auto' (default) follows the host page and keeps following it, so a site's
  // own theme toggle switches the widget too. 'light' / 'dark' pin it.
  appearance = 'auto',
  // Any palette key, flat (`{ bg }`) or per-scheme (`{ dark: { bg } }`).
  // See `theme/palette.js` for the full set.
  colors,
  // BCP-47 tag picking the built-in dictionary (pt-BR, en, id) and the clock
  // format on message bubbles. Unknown tags fall back to pt-BR.
  locale,
  // Overrides for individual lines — see `i18n/strings.js` for the keys.
  strings: stringOverrides,

  /* ---------------------------------------------------------------- *
   * Home screen
   * ---------------------------------------------------------------- */

  // The screen the panel opens on: greeting, the last conversation, and the
  // button that starts a new one. `false` opens straight into the composer,
  // which is how the widget behaved before the home screen existed.
  home = true,
  // `{ title, subtitle }` — overrides the localised greeting.
  greeting,
  // Faces in the hero: `[{ name, avatarUrl?, color? }]` or plain strings.
  // Falls back to whoever is currently replying; renders nothing when neither
  // is known, because a row of grey placeholders promises people who are not
  // there.
  agents,
  // Square mark in the top-left of the hero. Falls back to the workspace's
  // initial.
  logoUrl,

  debug = false,
}) => {
  // The host typically passes `user` as an inline object literal, which
  // creates a fresh reference every render and would otherwise cause the
  // adapter useMemo to recreate (tearing down and restarting the boot flow on
  // every parent re-render). Reading the latest value via a ref keeps `user`
  // out of the dep array while still using current data when the adapter
  // actually needs it (during `POST /session`).
  const userRef = useRef(user);
  userRef.current = user;

  // Adapter selection:
  //   1. Explicit `adapter` from the host (advanced — useful for tests).
  //   2. Otherwise build the omnichannel adapter from `appId`. `baseUrl` comes
  //      from the build-time constant — embedders cannot override.
  const resolvedAdapter = useMemo(() => {
    if (adapter) return adapter;
    if (!appId) return null;
    return createOmnichannelAdapter({
      appId,
      baseUrl: NUVEMCHAT_BASE_URL,
      getIdentify: () => {
        const u = userRef.current;
        if (!u) return null;
        return {
          name: u.name || u.full_name || u.firstName,
          email: u.email,
          meta: u.meta,
        };
      },
      locale,
      virtualAssistantName,
      deferSession,
      debug,
    });
  }, [adapter, appId, locale, virtualAssistantName, deferSession, debug]);

  // Hook order must stay stable, so all hooks are called unconditionally and
  // the render-gate checks happen below.
  const conversation = useConversation(resolvedAdapter);
  const scheme = useColorScheme(appearance);

  // When the panel opens, mark the conversation as seen so the server-side
  // `unread_count` resets. Conversation lifecycle changes (e.g. agent resolves
  // the chat) arrive separately via the WS `conversation-status-changed`
  // event, so no /session refetch here.
  useEffect(() => {
    if (!isOpen || conversation.status !== 'ready') return;
    if (conversation.unreadCount > 0) conversation.markSeen();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, conversation.status]);

  const dashboardAccent = conversation.config?.brand?.accentColor;

  const mergedTheme = useMemo(() => {
    if (!theme) return undefined;
    const accentColor = accent || dashboardAccent;
    if (!accentColor) return theme;
    return { ...theme, accent: accentColor };
  }, [theme, accent, dashboardAccent]);

  // `colors` and `strings` are almost always inline object literals, so a
  // plain reference in the dep array would rebuild the palette on every
  // render of the host. Serialising is cheap next to what it saves.
  const colorsKey = colors ? JSON.stringify(colors) : '';
  const stringsKey = stringOverrides ? JSON.stringify(stringOverrides) : '';

  const palette = useMemo(
    // Precedence: an explicit `accent` prop beats the dashboard, which beats
    // the built-in default. The prop is the deliberate act of the two.
    () => buildPalette({ accent: accent || dashboardAccent, scheme, overrides: colors }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [accent, dashboardAccent, scheme, colorsKey],
  );

  const strings = useMemo(
    () => resolveStrings(locale, stringOverrides),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [locale, stringsKey],
  );

  if (!resolvedAdapter) {
    if (typeof console !== 'undefined') {
      console.warn('[chat-widget] appId is required — widget not rendered.');
    }
    return null;
  }

  // Only `inactive` (403) hides the widget entirely — per API.md §9 the owner
  // has explicitly disabled the connection and we must not retry.
  //
  // `unavailable` (422, invalid app_id) intentionally keeps the widget
  // visible: the template renders a "not ready" placeholder so visitors don't
  // see a broken/empty chat and assume the site is misconfigured.
  if (conversation.status === 'inactive') {
    if (typeof console !== 'undefined' && conversation.error) {
      console.warn(
        '[chat-widget] connection inactive — hiding widget.',
        conversation.error?.body || conversation.error?.message,
      );
    }
    return null;
  }
  if (conversation.status === 'unavailable' && typeof console !== 'undefined') {
    console.warn(
      '[chat-widget] app_id unavailable — rendering not-ready state.',
      conversation.error?.body || conversation.error?.message,
    );
  }

  // Adapter config (backend `template_type`) wins over host props so owners
  // can control UI from the dashboard. Falls back to props otherwise.
  const activeTemplate = conversation.config?.template || template;
  const Template = templates[activeTemplate] || templates.proxybr;

  return (
    <Template
      isOpen={isOpen}
      onOpen={onOpen}
      onClose={onClose}
      theme={mergedTheme}
      conversation={conversation}
      user={user}
      initialChatOptions={initialChatOptions}
      palette={palette}
      strings={strings}
      locale={locale}
      home={home}
      greeting={greeting}
      agents={agents}
      logoUrl={logoUrl}
    />
  );
};

export default ChatWidget;
