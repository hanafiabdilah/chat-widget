import React, { useMemo } from 'react';
import { templates } from './templates/index.js';
import { createMockAdapter } from './core/adapters/mockAdapter.js';
import { createOmnichannelAdapter } from './core/adapters/omnichannelAdapter.js';
import { useConversation } from './core/useConversation.js';

// Public React component. Mount it once near the root of the host app:
//
//   <ChatWidget
//     appId="tenant-key"           // → omnichannel adapter (real API)
//     baseUrl="https://api.nuvemchat.app"
//     template="proxybr"           // 'proxybr' | 'global' — overridden by
//                                  //   adapter config when available
//     isOpen={open}
//     onOpen={() => setOpen(true)}
//     onClose={() => setOpen(false)}
//     user={user}                  // forwarded as `identify` to the API
//     theme={theme}                // host theme object (proxybr template only)
//     brand={{ title, statusLine }}
//   />
//
// Templates are pure presentation; adapters own the conversation transport
// (mock by default, omnichannel when `appId` + `baseUrl` are provided). For
// full control, pass a pre-built `adapter` instance to override the default
// selection.
//
// `template_type` and `connection.color` returned by the widget config
// endpoint take precedence over host-provided props — per API.md §11 the
// connection owner decides UI from the dashboard, not the embedding site.
export const ChatWidget = ({
  appId,
  baseUrl,
  template = 'proxybr',
  adapter,
  isOpen,
  onOpen,
  onClose,
  user,
  theme,
  brand,
  debug = false,
}) => {
  // Adapter selection precedence:
  // 1. Explicit `adapter` instance from the host (advanced).
  // 2. `appId` + `baseUrl` set → omnichannel adapter (real backend).
  // 3. Fallback → mock adapter so the widget always has something to say.
  const resolvedAdapter = useMemo(() => {
    if (adapter) return adapter;
    if (appId && baseUrl) {
      return createOmnichannelAdapter({
        appId,
        baseUrl,
        identify: user ? {
          name: user.name || user.full_name || user.firstName,
          email: user.email,
          meta: user.meta,
        } : undefined,
        debug,
      });
    }
    return createMockAdapter({ user });
  }, [adapter, appId, baseUrl, user, debug]);

  const conversation = useConversation(resolvedAdapter);

  // Fatal-status gate (API.md §9):
  //   - `inactive` (403): owner disabled the connection → hide widget entirely.
  //   - `unavailable` (422): invalid app_id → don't render; nothing useful
  //     to show without a valid config.
  // A console warning helps embedders notice their `app_id` is wrong without
  // breaking their page.
  if (conversation.status === 'inactive' || conversation.status === 'unavailable') {
    if (typeof console !== 'undefined' && conversation.error) {
      console.warn(
        `[chat-widget] ${conversation.status} — hiding widget.`,
        conversation.error?.body || conversation.error?.message,
      );
    }
    return null;
  }

  // Adapter config (e.g. backend `template_type`) wins over host props so
  // owners can control UI from the dashboard. Falls back to props otherwise.
  const activeTemplate = conversation.config?.template || template;
  const Template = templates[activeTemplate] || templates.proxybr;

  const mergedBrand = useMemo(() => {
    if (!conversation.config?.brand) return brand;
    return { ...(brand || {}), ...conversation.config.brand };
  }, [brand, conversation.config]);

  // Splice the brand accent color into the host theme so the ProxyBR
  // template's `t.accent` reflects the connection's brand color when set.
  const mergedTheme = useMemo(() => {
    const accent = conversation.config?.brand?.accentColor;
    if (!theme || !accent) return theme;
    return { ...theme, accent };
  }, [theme, conversation.config]);

  return (
    <Template
      isOpen={isOpen}
      onOpen={onOpen}
      onClose={onClose}
      theme={mergedTheme}
      conversation={conversation}
      brand={mergedBrand}
      user={user}
    />
  );
};

export default ChatWidget;
