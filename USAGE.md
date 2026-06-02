# Usage Guide — @multichat-adslogin/chat-widget

An embeddable React chat widget. A single component that already includes
drag-and-drop attachments, realtime messaging, quick-reply chips, and a built-in
emoji picker.

This document walks through every step from installation to a running widget in
your app.

---

## 1. Prerequisites

- **Node.js** 18+ and **npm** (or yarn / pnpm).
- A **React 18+** app (Vite, Next.js, Create React App, etc).
- An **`appId`** from the MultiChat dashboard. This is required — without an
  `appId` the widget will not render.

---

## 2. Installation

Install the package together with its peer dependencies:

```bash
npm install @multichat-adslogin/chat-widget lucide-react
```

`react`, `react-dom`, and `lucide-react` are **peer dependencies** — meaning
this package does not bundle them, and you must make sure all three exist in the
host app:

| Package        | Minimum version |
| -------------- | --------------- |
| `react`        | `>=18`          |
| `react-dom`    | `>=18`          |
| `lucide-react` | `>=0.300.0`     |

If your project already uses React, then `react` and `react-dom` are usually
already installed — you only need to add `lucide-react`.

With yarn / pnpm:

```bash
yarn add @multichat-adslogin/chat-widget lucide-react
# or
pnpm add @multichat-adslogin/chat-widget lucide-react
```

---

## 3. Import the CSS (required, once)

The widget ships its own stylesheet that **won't leak into** the host page's
styles. Import the CSS **once** near your app's entry point:

```js
import '@multichat-adslogin/chat-widget/styles.css';
```

---

## 4. Basic usage (Quick Start)

Mount the `<ChatWidget>` component once near the root of your app. The panel's
open/close state is controlled by you through the `isOpen` / `onOpen` /
`onClose` props.

```jsx
import { useState } from 'react';
import { ChatWidget } from '@multichat-adslogin/chat-widget';
import '@multichat-adslogin/chat-widget/styles.css';

export default function App() {
  const [open, setOpen] = useState(false);

  return (
    <ChatWidget
      appId="550e8400-e29b-41d4-a716-446655440000"
      isOpen={open}
      onOpen={() => setOpen(true)}
      onClose={() => setOpen(false)}
      user={{ name: 'Budi', email: 'budi@example.com' }}
    />
  );
}
```

**Only `appId` is required.** Everything else — template, brand color, welcome
message — is configured from the MultiChat dashboard and loaded automatically by
the widget.

---

## 5. Props reference

| Prop                  | Type                                          | Required | Notes |
| --------------------- | --------------------------------------------- | :------: | ----- |
| `appId`               | `string`                                      |    ✓     | Your connection identifier from the MultiChat dashboard. |
| `isOpen`              | `boolean`                                     |          | Controlled open/close state of the panel. |
| `onOpen`              | `() => void`                                  |          | Called when the panel opens. |
| `onClose`             | `() => void`                                  |          | Called when the panel closes. |
| `user`                | `{ name?, email?, meta? }`                    |          | Identifies the visitor to the support agent. |
| `theme`               | `Theme`                                       |          | Color overrides for the **proxybr** template (dark). The **global** template has its own light palette. |
| `template`            | `'proxybr' \| 'global'`                       |          | Initial template hint. The dashboard setting takes over once loaded. |
| `initialChatOptions`  | `Array<{ id, label, color?, message? }>`      |          | Quick-reply chips shown until the visitor sends their first message. |
| `debug`               | `boolean`                                     |          | Enables verbose lifecycle logging in the console. |

### Note on `user`

The `user` field identifies the visitor to the agent. The widget reads `name`
(or `full_name` / `firstName`), `email`, and `meta`. You can safely pass an
inline object literal.

---

## 6. Quick-reply chips (`initialChatOptions`)

Show shortcut buttons above the input. The chips disappear after the visitor
sends any message.

```jsx
<ChatWidget
  appId="550e8400-e29b-41d4-a716-446655440000"
  initialChatOptions={[
    { id: 'pricing', label: '💰 Ask about pricing', color: '#22c55e' },
    { id: 'support', label: '⚠️ Technical help', color: '#f59e0b' },
    {
      id: 'demo',
      label: '🎥 Request a demo',
      color: '#06b6d4',
      message: 'Hi, I would like to request a product demo.', // the text actually sent
    },
  ]}
/>
```

Clicking a chip sends `message` if provided, otherwise the `label`, as a normal
visitor message. Use `message` when you want a short chip label but a fuller
message to reach the agent.

| Field     | Required | Notes |
| --------- | :------: | ----- |
| `id`      |    ✓     | Stable key for React reconciliation. |
| `label`   |    ✓     | Text shown on the chip, also the default text sent when clicked. |
| `message` |          | Override the text sent to the agent. |
| `color`   |          | Chip accent color (hex). |

---

## 7. Templates & theming

Two templates are available:

- **`proxybr`** — dark appearance, colors can be overridden via the `theme` prop.
- **`global`** — light appearance with a fixed palette.

The template is ultimately decided by your dashboard setting, which **always
wins** over the `template` prop. The `template` prop is only an initial hint
before the configuration loads.

Example theme override (only applies to the proxybr template):

```jsx
<ChatWidget
  appId="..."
  template="proxybr"
  theme={{ accent: '#7c3aed' /* ...other color overrides... */ }}
/>
```

> If a brand accent color is set in the dashboard, it overrides the
> `theme.accent` you provide.

---

## 8. Features that work out of the box

Once mounted, the widget automatically handles:

- **Realtime messaging** — visitor and agent messages update live, no polling
  needed on your side.
- **Attachments** — drag-and-drop or file picker, with caption input and inline
  preview (image / audio / video / document).
- **Emoji picker** — built-in, ~250 emojis across 6 categories, inserts at the cursor.
- **Conversation status** — when a chat is resolved, the input is replaced with a
  "Start new conversation" button.
- **Unread badge** — increments when the agent replies, clears when the panel opens.
- **"Connecting…" placeholder** — shown while loading or on transient errors,
  instead of a broken UI.
- **Self-contained styles** — the widget's CSS is scoped and won't affect your
  page's styles.
- **Lightweight** — ~19 KB gzipped, with no extra runtime dependencies beyond the
  peer dependencies.

---

## 9. Full example

```jsx
import { useState } from 'react';
import { ChatWidget } from '@multichat-adslogin/chat-widget';
import '@multichat-adslogin/chat-widget/styles.css';

export default function App() {
  const [open, setOpen] = useState(false);

  return (
    <div>
      {/* your page content */}

      <button onClick={() => setOpen((v) => !v)}>
        {open ? 'Close chat' : 'Open chat'}
      </button>

      <ChatWidget
        appId="550e8400-e29b-41d4-a716-446655440000"
        isOpen={open}
        onOpen={() => setOpen(true)}
        onClose={() => setOpen(false)}
        user={{ name: 'Anderson', email: 'anderson@example.com' }}
        initialChatOptions={[
          { id: 'pricing', label: '💰 Ask about pricing', color: '#22c55e' },
          { id: 'support', label: '⚠️ Technical help', color: '#f59e0b' },
          { id: 'demo', label: '🎥 Request a demo', color: '#06b6d4',
            message: 'Hi, I would like to request a product demo.' },
          { id: 'human', label: '🎧 Talk to an agent', color: '#a855f7' },
        ]}
      />
    </div>
  );
}
```

---

## 10. Troubleshooting

| Symptom | Likely cause & fix |
| ------- | ------------------ |
| Widget doesn't appear at all | `appId` is empty/not provided (check for the `[chat-widget] appId is required` warning in the console), or the connection is disabled in the dashboard. |
| Stuck on "Connecting…" | The `appId` is invalid, or there's a temporary network issue. Double-check the `appId` from your dashboard. |
| Widget styles look broken | The CSS wasn't imported. Make sure `import '@multichat-adslogin/chat-widget/styles.css';` is present. |
| Icon / `lucide-react` error | The `lucide-react` peer dependency isn't installed. Run `npm install lucide-react`. |

---

## License

MIT © MultiChat
