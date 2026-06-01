# Live Chat Widget — SDK Integration Guide

Backend reference untuk tim SDK JavaScript. Dokumen ini mencakup seluruh endpoint, kontrak data, realtime channel, dan flow yang harus diimplementasikan SDK widget.

---

## 1. Overview

Live Chat Widget adalah channel omnichannel Nuvemchat yang berjalan tanpa dependensi pihak ketiga. SDK di-embed di website klien lewat satu `<script>` tag, dan berkomunikasi dengan backend melalui:

- **HTTP REST** untuk bootstrap, kirim pesan visitor, fetch history
- **WebSocket (Laravel Reverb, protokol Pusher)** untuk menerima pesan dari agent secara realtime

```
┌─────────────┐    HTTP REST     ┌─────────────┐    Broadcast    ┌─────────────┐
│  Widget JS  │ ───────────────► │   Backend   │ ──────────────► │   Agent     │
│  (visitor)  │ ◄─────────────── │  (Laravel)  │ ◄────────────── │  Dashboard  │
└─────────────┘   WebSocket      └─────────────┘    HTTP REST    └─────────────┘
```

---

## 2. Base URL & CORS

| Aspect          | Value                                                         |
| --------------- | ------------------------------------------------------------- |
| Base URL        | `https://{your-nuvemchat-host}`                               |
| Endpoint prefix | `/widget-api`                                                 |
| CORS            | Mengizinkan semua origin (`*`), method, dan header            |
| CSRF            | Diabaikan untuk `/widget-api/*`                               |
| Credentials     | **Tidak** menggunakan cookies (`supports_credentials: false`) |
| Content-Type    | `application/json`                                            |

SDK aman dipanggil dari domain klien manapun tanpa konfigurasi CORS tambahan.

---

## 3. Authentication Model

Tidak ada login user. Otentikasi berbasis dua identifier:

| Identifier      | Origin                                            | Scope                             | Lifetime                                  |
| --------------- | ------------------------------------------------- | --------------------------------- | ----------------------------------------- |
| `app_id`        | Disediakan klien via `<script data-app-id="...">` | Mengidentifikasi tenant + channel | Permanen (selama connection aktif)        |
| `session_token` | Diterbitkan backend saat init session             | Mengidentifikasi 1 sesi visitor   | Hingga visitor reset / connection deleted |

Aturan keamanan SDK:

1. `app_id` **public** — boleh muncul di HTML.
2. `session_token` **secret** — simpan di `localStorage`, jangan log, jangan kirim di URL/query string. SDK kirim hanya di path parameter / body.
3. Channel realtime `widget-session.{session_token}` adalah **public channel** Reverb; keamanannya bergantung pada secrecy `session_token`.

---

## 4. Endpoints Reference

Seluruh endpoint mengembalikan JSON. Error mengikuti format Laravel:

```json
{ "message": "Human-readable error", "errors": { "field": ["..."] } }
```

Status code: `200` sukses, `403` connection inactive, `404` resource tidak ada, `422` validation error.

### 4.1 `GET /widget-api/config/{appId}`

Dipanggil saat SDK boot up. Mengembalikan konfigurasi tampilan widget. Aman dipanggil tanpa session.

**Path parameters**

| Param   | Type   | Required | Catatan                       |
| ------- | ------ | :------: | ----------------------------- |
| `appId` | string |    ✓     | Dari `data-app-id` script tag |

**Response 200**

```json
{
  "app_id": "550e8400-e29b-41d4-a716-446655440000",
  "template_type": "global",
  "connection": {
    "id": 7,
    "name": "Toko XYZ",
    "color": "#ff5500",
    "accept_message": "Halo, ada yang bisa kami bantu?"
  },
  "realtime": {
    "driver": "reverb",
    "key": "abc123xyz",
    "host": "ws.nuvemchat.app",
    "port": 443,
    "scheme": "https"
  }
}
```

| Field                       | Type                      | Catatan                                            |
| --------------------------- | ------------------------- | -------------------------------------------------- |
| `template_type`             | `"global"` \| `"proxybr"` | SDK gunakan untuk pilih template UI yang di-render |
| `connection.name`           | string                    | Nama bisnis untuk header widget                    |
| `connection.color`          | string \| null            | Warna brand (hex), gunakan sebagai accent          |
| `connection.accept_message` | string \| null            | Auto-greeting yang muncul saat conversation baru   |
| `realtime.driver`           | string                    | Selalu `"reverb"` saat ini                         |
| `realtime.key`              | string                    | Public app key untuk Pusher protocol               |
| `realtime.host`             | string                    | WebSocket host tanpa scheme/port                   |
| `realtime.port`             | number                    | Port WebSocket (umumnya 443 di production)         |
| `realtime.scheme`           | `"http"` \| `"https"`     | `"https"` → `forceTLS: true` di Echo config        |

**Error responses**

| Status | Kapan                               |
| ------ | ----------------------------------- |
| `422`  | `app_id` tidak dikenal di sistem    |
| `403`  | Connection di-disconnect oleh owner |

---

### 4.2 `POST /widget-api/session/{appId}`

Membuat sesi visitor baru. **Panggil hanya jika belum ada `session_token` tersimpan di `localStorage`.** Membuat resource:

- `Contact` (visitor)
- `Conversation` (status `pending`)
- `LiveChatSession` (sesi widget)

**Request body** (semua opsional)

```json
{
  "name": "Budi Santoso",
  "email": "budi@example.com",
  "visitor_id": "anon-uuid-dari-localStorage",
  "page_url": "https://klien.com/checkout",
  "meta": {
    "plan": "pro",
    "lang": "id",
    "referrer": "google"
  }
}
```

| Field        | Type           | Catatan                                                                                                            |
| ------------ | -------------- | ------------------------------------------------------------------------------------------------------------------ |
| `name`       | string \| null | Nama visitor. Kalau null → fallback "Visitor"                                                                      |
| `email`      | string \| null | Harus valid email                                                                                                  |
| `visitor_id` | string \| null | UUID stabil per browser (SDK generate & simpan di `localStorage`). Membantu de-dup contact saat user reset session |
| `page_url`   | string \| null | URL halaman tempat widget di-embed                                                                                 |
| `meta`       | object \| null | Custom data klien (paspor, role, dll). Tersedia di dashboard agent                                                 |

**Response 200**

```json
{
  "session_token": "550e8400-e29b-41d4-a716-446655440000",
  "conversation_id": 123,
  "contact_id": 456
}
```

SDK **harus** menyimpan `session_token` ke `localStorage` dengan key seperti `nuvemchat:session:{appId}`.

---

### 4.3 `GET /widget-api/session/{sessionToken}`

Lightweight status check untuk conversation aktif. Dipanggil saat reconnect, atau sebagai polling fallback kalau WebSocket disconnect.

**Response 200**

```json
{
  "session": {
    "token": "550e8400-e29b-41d4-a716-446655440000",
    "last_seen_at": "2026-05-28T10:30:00+00:00"
  },
  "conversation": {
    "id": 123,
    "status": "active",
    "last_message_at": "2026-05-28T10:32:11+00:00",
    "agent": {
      "id": 3,
      "name": "Agen Sari"
    },
    "last_message": {
      "id": 99,
      "sender_type": "outgoing",
      "message_type": "text",
      "body": "Tunggu sebentar ya...",
      "sent_at": 1748441531
    }
  },
  "unread_count": 2
}
```

| Field                       | Type                                      | Catatan                                                                              |
| --------------------------- | ----------------------------------------- | ------------------------------------------------------------------------------------ |
| `conversation.status`       | `"pending"` \| `"active"` \| `"resolved"` | `pending` = belum di-accept agent. `active` = sedang ditangani. `resolved` = ditutup |
| `conversation.agent`        | object \| null                            | Agent yang menangani. `null` kalau belum di-accept                                   |
| `conversation.last_message` | object \| null                            | Preview pesan terakhir (untuk notifikasi badge)                                      |
| `unread_count`              | integer                                   | Jumlah pesan outgoing yang lebih baru dari `last_seen_at`. Pakai untuk badge unread  |

SDK gunakan untuk:

- Decide apakah tampilkan badge "Agent X is helping you"
- Display unread count di chat bubble (sebelum widget dibuka)
- Tahu kalau conversation sudah `resolved` → tampilkan "End of conversation" CTA

---

### 4.4 `POST /widget-api/session/{sessionToken}/seen`

Tandai conversation sebagai sudah dibaca oleh visitor (update `last_seen_at` ke sekarang). Panggil saat user buka widget atau scroll ke pesan terbaru.

**Request body**: kosong / `{}`

**Response 200**

```json
{ "last_seen_at": "2026-05-28T10:35:00+00:00" }
```

Setelah ini, response `/status` berikutnya akan punya `unread_count: 0` (sampai ada pesan outgoing baru).

---

### 4.5 `POST /widget-api/session/{sessionToken}/messages`

Visitor mengirim pesan teks. Saat ini hanya mendukung text. Pesan langsung muncul di dashboard agent + memicu flow otomatis (kalau connection ter-attach ke flow).

**Path parameters**

| Param          | Type          | Required |
| -------------- | ------------- | :------: |
| `sessionToken` | string (UUID) |    ✓     |

**Request body**

```json
{ "message": "Halo, saya mau tanya tentang produk X" }
```

**Response 200**

```json
{
  "message": {
    "id": 99,
    "conversation_id": 123,
    "sender_type": "incoming",
    "message_type": "text",
    "body": "Halo, saya mau tanya tentang produk X",
    "attachment_url": null,
    "replied_message": null,
    "sent_at": 1748441234,
    "delivery_at": 1748441234,
    "read_at": null,
    "edited_at": null,
    "unsend_at": null,
    "sender": null,
    "meta": null,
    "created_at": 1748441234,
    "updated_at": 1748441234
  }
}
```

Field `message` mengikuti **MessageResource** schema yang sama dipakai dashboard agent. SDK boleh langsung render dari payload ini (single source of truth dengan event realtime).

---

### 4.6 `GET /widget-api/session/{sessionToken}/messages`

Restore conversation history. Dipanggil saat SDK boot up dan menemukan `session_token` tersimpan (mis. setelah refresh page).

**Response 200**

```json
{
  "messages": [
    {
      "id": 90,
      "sender_type": "incoming",
      "message_type": "text",
      "body": "Halo",
      "sent_at": 1748441000,
      "...": "..."
    },
    {
      "id": 91,
      "sender_type": "outgoing",
      "message_type": "text",
      "body": "Halo Budi, ada yang bisa dibantu?",
      "sent_at": 1748441010,
      "sender": { "source": "human", "user": { "id": 3, "name": "Agen Sari" } },
      "...": "..."
    }
  ]
}
```

| Field            | Catatan                                                                                                            |
| ---------------- | ------------------------------------------------------------------------------------------------------------------ |
| `sender_type`    | `"incoming"` (dari visitor) atau `"outgoing"` (dari agent/bot)                                                     |
| `sender.source`  | `"human"` (agent UI), `"ai_flow"` (AI bot), `"static_flow"` (flow rule), `"external"` (API). Hanya ada di outgoing |
| `attachment_url` | URL temporary (S3-style signed URL) untuk media. Bisa expire — jangan cache lama                                   |

Maksimum 200 pesan terakhir, urutan kronologis ASC (oldest first).

---

## 5. Realtime — Receive Agent Replies

### 5.1 Channel

|              |                                             |
| ------------ | ------------------------------------------- |
| Driver       | Laravel Reverb (Pusher-protocol kompatibel) |
| Channel name | `widget-session.{session_token}`            |
| Channel type | **Public** (no auth subscription)           |

Channel ini mem-broadcast **dua event** yang berbeda — listen keduanya secara terpisah.

### 5.2 Event: `widget-message-received`

Pesan baru / edit / delete dari agent atau bot.

|            |                                                    |
| ---------- | -------------------------------------------------- |
| Event name | `widget-message-received`                          |
| Payload    | MessageResource (sama persis dengan response REST) |

**Trigger conditions:**

- Agent mengirim pesan dari dashboard (text/image/audio/video/document)
- AI bot membalas via flow
- Agent edit pesan (cek field `edited_at`)
- Agent delete pesan (cek field `unsend_at`)

SDK harus handle ketiga state itu dengan logic upsert berdasarkan `message.id`:

```js
if (existing) {
  if (msg.unsend_at) removeMessage(existing.id);
  else updateMessage(existing.id, msg); // edit
} else {
  appendMessage(msg); // new
}
```

### 5.2b Event: `widget-conversation-status-changed`

Status conversation berubah (accept / resolve / dst).

|            |                                      |
| ---------- | ------------------------------------ |
| Event name | `widget-conversation-status-changed` |
| Payload    | objek di bawah                       |

```json
{
  "conversation_id": 123,
  "old_status": "pending",
  "new_status": "active",
  "agent": { "id": 3, "name": "Agen Sari" },
  "changed_at": "2026-05-28T10:30:00+00:00"
}
```

**Trigger conditions:**

- Agent klik **Accept** di dashboard → `pending` → `active`, `agent` ter-assign
- Agent klik **Resolve** → `active` → `resolved` (biasanya sudah ada `closing_message` ter-broadcast lewat `widget-message-received` sebelumnya)
- Status berubah lewat cara lain (API, console command, dst.)

SDK harus react sesuai transisi:

| `new_status` | UI action                                                                               |
| ------------ | --------------------------------------------------------------------------------------- |
| `active`     | Tampilkan "Agent {name} bergabung" — chat mode normal                                   |
| `resolved`   | Tampilkan banner "Conversation ditutup", disable input, tampilkan CTA "Mulai chat baru" |
| `pending`    | (jarang — fallback) tampilkan "Menunggu agent"                                          |

**Penting — sesi tidak otomatis di-reset saat `resolved`:**
`session_token` di `localStorage` tetap valid. Endpoint REST masih bisa dipanggil (kirim pesan, fetch status). Yang berubah hanya `conversation.status`. SDK yang memutuskan kapan reset session:

- Diamkan saja (visitor bisa lihat history) → user klik "Mulai chat baru" → SDK panggil `localStorage.clear()` + `POST /session/{appId}` lagi
- Atau auto-reset setelah N detik / saat user kirim pesan baru

### 5.3 Reverb connection config

SDK **tidak perlu hardcode** credential broadcasting — seluruh field tersedia di block `realtime` dari response `GET /widget-api/config/{appId}` (lihat §4.1).

```js
const { realtime } = await fetch(`${BASE}/widget-api/config/${appId}`).then(
  (r) => r.json(),
);
// realtime = { driver, key, host, port, scheme }
```

#### Catatan untuk backend ops

Nilai `realtime.host`/`port`/`scheme` yang dikirim ke SDK external **bukan** `REVERB_HOST` (yang biasanya `localhost` / nama service Docker — untuk publish internal dari Laravel). Backend pakai resolusi berikut:

1. `REVERB_PUBLIC_HOST` + `REVERB_PUBLIC_PORT` + `REVERB_PUBLIC_SCHEME` jika di-set → **direkomendasikan production**
2. Host dari `APP_URL` jika Reverb di-proxy lewat domain yang sama
3. Fallback ke `REVERB_HOST` (last resort, kemungkinan localhost)

Set env berikut di production agar widget bisa konek WebSocket dari domain klien:

```env
REVERB_PUBLIC_HOST=ws.nuvemchat.app
REVERB_PUBLIC_PORT=443
REVERB_PUBLIC_SCHEME=https
```

### 5.4 Contoh subscribe (laravel-echo + pusher-js)

```js
import Echo from "laravel-echo";
import Pusher from "pusher-js";
window.Pusher = Pusher;

const echo = new Echo({
  broadcaster: "reverb",
  key: realtime.key,
  wsHost: realtime.host,
  wsPort: realtime.port,
  wssPort: realtime.port,
  forceTLS: realtime.scheme === "https",
  enabledTransports: ["ws", "wss"],
});

const channel = echo.channel(`widget-session.${sessionToken}`);

channel.listen(".widget-message-received", (payload) => {
  // payload is MessageResource shape
  handleIncomingFromAgent(payload);
});

channel.listen(".widget-conversation-status-changed", (payload) => {
  // payload = { conversation_id, old_status, new_status, agent, changed_at }
  handleStatusChange(payload);
});

// Cleanup on widget close
channel.stopListening(".widget-message-received");
channel.stopListening(".widget-conversation-status-changed");
echo.leave(`widget-session.${sessionToken}`);
```

Catatan dot prefix `.widget-message-received`: Echo akan strip dot saat match `broadcastAs()`. Wajib pakai dot.

---

## 6. Recommended Storage Schema

SDK harus persist data ini di `localStorage` (atau cookie kalau iframe-restricted):

```js
{
  "nuvemchat:visitorId:{appId}": "<uuid>",          // generate sekali, kirim sebagai visitor_id
  "nuvemchat:session:{appId}": "<session_token>",    // dari /session response
  "nuvemchat:lastSeenMessageId:{appId}": 123         // optional: untuk badge "unread"
}
```

Scope per `appId` agar bisa coexist kalau klien embed beberapa widget berbeda di domain yang sama.

---

## 7. Typical SDK Flow

```
┌────────────────────────────────────────────────────────────────┐
│ 1. <script data-app-id="..."> loaded                            │
│    └─ GET /widget-api/config/{appId}                            │
│       └─ render bubble + UI sesuai template_type + color        │
└────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌────────────────────────────────────────────────────────────────┐
│ 2. User clicks chat bubble                                      │
│    ├─ Read localStorage["nuvemchat:session:{appId}"]            │
│    │                                                             │
│    ├─ EXISTS → GET /widget-api/session/{token}/messages         │
│    │           ↓ render history                                  │
│    │           ↓ subscribe widget-session.{token}                │
│    │                                                             │
│    └─ MISSING → show optional pre-chat form (name/email)        │
│                 → POST /widget-api/session/{appId}              │
│                 → store session_token                            │
│                 → subscribe widget-session.{token}              │
└────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌────────────────────────────────────────────────────────────────┐
│ 3. Visitor types & sends                                        │
│    └─ POST /widget-api/session/{token}/messages                 │
│       └─ render optimistic + replace with server message        │
└────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌────────────────────────────────────────────────────────────────┐
│ 4. Agent replies                                                │
│    └─ Echo event "widget-message-received" arrives              │
│       └─ upsert message in UI (handle new/edit/delete)          │
└────────────────────────────────────────────────────────────────┘
```

---

## 8. Optimistic UI Pattern

Untuk UX cepat, SDK boleh render pesan sebelum response server datang:

```js
async function sendMessage(text) {
  const tempId = `temp-${Date.now()}`;
  appendMessage({
    id: tempId,
    sender_type: "incoming",
    message_type: "text",
    body: text,
    sent_at: Date.now() / 1000,
    _pending: true,
  });

  try {
    const { message } = await api.post(`/session/${token}/messages`, {
      message: text,
    });
    replaceMessage(tempId, message);
  } catch (err) {
    markMessageFailed(tempId, err);
  }
}
```

---

## 9. Error Handling

| HTTP    | Meaning                                  | SDK action                                                         |
| ------- | ---------------------------------------- | ------------------------------------------------------------------ |
| `422`   | Validation error pada `app_id` atau body | Show generic "Chat tidak tersedia" — masalah konfigurasi           |
| `403`   | Connection inactive                      | Hide widget; jangan retry                                          |
| `404`   | Session token invalid (deleted/expired)  | Hapus `localStorage`, treat as new visitor → fresh `/session` call |
| `5xx`   | Server error                             | Exponential backoff retry (max 3x); show toast "Gagal kirim"       |
| Network | Offline                                  | Queue messages locally, flush saat online lagi                     |

WebSocket disconnect → Echo auto-reconnect. SDK tidak perlu polling fallback.

---

## 10. Embed Snippet (untuk klien akhir)

Inilah yang akan klien tempel ke website mereka. SDK harus support pattern ini:

```html
<script
  src="https://cdn.nuvemchat.app/widget.js"
  data-app-id="550e8400-e29b-41d4-a716-446655440000"
  async
></script>
```

Optional advanced attributes:

```html
<script
  src="https://cdn.nuvemchat.app/widget.js"
  data-app-id="..."
  data-visitor-name="Budi"           <!-- prefill -->
  data-visitor-email="budi@x.com"
  data-meta='{"plan":"pro"}'         <!-- JSON string -->
  data-position="bottom-right"        <!-- UI prefs -->
  async
></script>
```

SDK juga bisa expose programmatic API:

```js
window.Nuvemchat.init({ appId: '...' });
window.Nuvemchat.identify({ name: 'Budi', email: 'budi@x.com', meta: { ... } });
window.Nuvemchat.open();
window.Nuvemchat.close();
window.Nuvemchat.reset();   // clear localStorage, new session next time
window.Nuvemchat.on('message', (msg) => { ... });
```

---

## 11. Template Types

Field `template_type` dari `/config` menentukan tampilan widget:

| Value     | Catatan                                                                 |
| --------- | ----------------------------------------------------------------------- |
| `global`  | Template default — clean, modern. Cocok untuk audiens internasional     |
| `proxybr` | Varian untuk pasar Brazil (asumsi: localized copy, brand color berbeda) |

SDK harus ship kedua template dan switch berdasarkan response config — **tidak boleh** ditentukan dari `<script>` attribute (owner yang putuskan di dashboard).

---

## 12. Limits & Constraints

| Limit         | Value                                                              |
| ------------- | ------------------------------------------------------------------ |
| History fetch | Max 200 messages per call (no pagination yet)                      |
| Message body  | Tidak ada limit eksplisit, tapi default Laravel `max:65535` (TEXT) |
| Page URL      | Max 2048 chars                                                     |
| User agent    | Disimpan max 1024 chars (auto-truncate)                            |
| Rate limit    | Belum ada — silakan implement client-side throttle                 |

---

## 13. Belum Tersedia (Future Work)

Fitur ini akan ditambahkan saat dibutuhkan — SDK boleh mock UI-nya sekarang:

- Upload media (image/file) dari visitor
- Typing indicator (visitor ↔ agent)
- Read receipt dari visitor
- Endpoint close/end session
- Pagination untuk history > 200 messages
- Reaction emoji dari visitor

---

## 14. Quick Reference

| Action                        | Method | Path                                                                          |
| ----------------------------- | ------ | ----------------------------------------------------------------------------- |
| Get widget config             | `GET`  | `/widget-api/config/{appId}`                                                  |
| Init session                  | `POST` | `/widget-api/session/{appId}`                                                 |
| Get session status            | `GET`  | `/widget-api/session/{token}`                                                 |
| Mark as seen                  | `POST` | `/widget-api/session/{token}/seen`                                            |
| Send message                  | `POST` | `/widget-api/session/{token}/messages`                                        |
| Get history                   | `GET`  | `/widget-api/session/{token}/messages`                                        |
| Subscribe realtime — messages | WS     | channel `widget-session.{token}`, event `.widget-message-received`            |
| Subscribe realtime — status   | WS     | channel `widget-session.{token}`, event `.widget-conversation-status-changed` |

---

## 15. Changelog

| Version | Date       | Changes                                                                                                                                 |
| ------- | ---------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| 0.1     | 2026-05-28 | Initial release: text messaging, public broadcast channel, session-based auth                                                           |
| 0.2     | 2026-05-28 | `GET /config` sekarang mengembalikan block `realtime: { driver, key, host, port, scheme }` — SDK tidak perlu hardcode Reverb credential |
| 0.3     | 2026-05-28 | Tambah `GET /session/{token}` untuk status + agent + unread_count, dan `POST /session/{token}/seen` untuk mark as read                  |
