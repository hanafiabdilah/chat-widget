// Public entry for the npm package. Re-exports the React surface the
// host consumes. CSS lives at `@multichat-adslogin/chat-widget/styles.css` and the
// host imports it once near its bundle entry — keeping CSS imports out of
// the JS module so SSR/CJS users aren't forced to handle stylesheets.
import './styles.css';

export { ChatWidget, default } from './ChatWidget.jsx';
export { templates, ProxybrTemplate, GlobalTemplate } from './templates/index.js';
export { createOmnichannelAdapter } from './core/adapters/omnichannelAdapter.js';
export { useConversation } from './core/useConversation.js';

// Lower-level API building blocks — exposed so advanced hosts can build a
// custom adapter without re-implementing the wire protocol.
export { createRestClient, ApiError } from './core/api/restClient.js';
export { createRealtimeClient } from './core/api/realtimeClient.js';
export { createWidgetStorage } from './core/api/storage.js';
export { mapMessage, agentFromResource } from './core/api/messageMapper.js';

// Theming. Exported so a host can render its own surfaces against the same
// palette the widget derived — a "Talk to us" button that matches the
// launcher without the site hard-coding the accent twice.
export { buildPalette, DEFAULT_ACCENT } from './theme/palette.js';
export { useColorScheme, detectHostScheme } from './theme/useColorScheme.js';
export { resolveStrings, DICTIONARIES } from './i18n/strings.js';
