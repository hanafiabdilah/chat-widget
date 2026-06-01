import React, { useEffect, useMemo, useRef } from 'react';
import { templates } from './templates/index.js';
import { createOmnichannelAdapter } from './core/adapters/omnichannelAdapter.js';
import { useConversation } from './core/useConversation.js';
import { NUVEMCHAT_BASE_URL } from './core/config.js';

// Public React component. Mount it once near the root of the host app:
//
//   <ChatWidget
//     appId="550e8400-..."             // Nuvemchat connection identifier
//     isOpen={open}
//     onOpen={() => setOpen(true)}
//     onClose={() => setOpen(false)}
//     user={user}                       // forwarded as `identify` to the API
//     theme={theme}                     // host theme object (proxybr template only)
//   />
//
// The widget is fully API-driven (see API.md):
//   - Visitor messages POST to `/widget-api/session/{token}/messages`
//   - Agent replies arrive via Reverb broadcast on `widget-session.{token}`
//   - Template + brand (title + accent color) come from `/widget-api/config`
//
// `baseUrl` is baked into the build (see `core/config.js`) — embedders
// don't pass it. Brand (title, accent) is owned by the connection in the
// dashboard, not the embedding site (per API.md §11), so there's no prop
// for it either.
export const ChatWidget = ({
  appId,
  template = 'proxybr',
  adapter,
  isOpen,
  onOpen,
  onClose,
  user,
  theme,
  // Host-defined quick-reply chips. Shown above the input until the
  // visitor sends their first message. Each option: { id, label, color?,
  // message? }. See `core/types.js > InitialChatOption`.
  initialChatOptions,
  debug = false,
}) => {
  // The host typically passes `user` as an inline object literal, which
  // creates a fresh reference every render and would otherwise cause the
  // adapter useMemo to recreate (tearing down and restarting the boot
  // flow on every parent re-render). Reading the latest value via a ref
  // keeps `user` out of the dep array while still using current data
  // when the adapter actually needs it (during `POST /session`).
  const userRef = useRef(user);
  userRef.current = user;

  // Adapter selection:
  //   1. Explicit `adapter` from the host (advanced — useful for tests).
  //   2. Otherwise build the omnichannel adapter from `appId`. `baseUrl`
  //      comes from the build-time constant — embedders cannot override.
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
      debug,
    });
  }, [adapter, appId, debug]);

  // Hook order must stay stable, so all hooks are called unconditionally
  // and the render-gate checks happen below.
  const conversation = useConversation(resolvedAdapter);

  // When the panel opens, mark the conversation as seen so the
  // server-side `unread_count` resets. Conversation lifecycle changes
  // (e.g. agent resolves the chat) arrive separately via the WS
  // `conversation-status-changed` event, so no /session refetch here.
  useEffect(() => {
    if (!isOpen || conversation.status !== 'ready') return;
    if (conversation.unreadCount > 0) conversation.markSeen();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, conversation.status]);
  const mergedTheme = useMemo(() => {
    if (!theme) return undefined;
    const accent = conversation.config?.brand?.accentColor;
    if (!accent) return theme;
    return { ...theme, accent };
  }, [theme, conversation.config]);

  if (!resolvedAdapter) {
    if (typeof console !== 'undefined') {
      console.warn('[chat-widget] appId is required — widget not rendered.');
    }
    return null;
  }

  // Only `inactive` (403) hides the widget entirely — per API.md §9 the
  // owner has explicitly disabled the connection and we must not retry.
  //
  // `unavailable` (422, invalid app_id) intentionally keeps the widget
  // visible: the template renders a "not ready" placeholder so visitors
  // don't see a broken/empty chat and assume the site is misconfigured.
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
    />
  );
};

export default ChatWidget;
