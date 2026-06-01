// Thin wrapper around fetch for the Nuvemchat widget HTTP API. Endpoints are
// described in API.md §4. All requests are JSON and CORS-friendly — the
// backend explicitly opts out of cookies, so we never send credentials.
//
// Errors:
//   - HTTP non-2xx is thrown as `ApiError` with the parsed Laravel error body
//     attached so callers can distinguish 403 (connection inactive), 404
//     (session expired → clear localStorage), and 422 (validation).
//   - Network failures bubble up as the underlying TypeError from fetch.

export class ApiError extends Error {
  constructor(status, body, message) {
    super(message || (body && body.message) || `Request failed: ${status}`);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
  }
}

const parseJson = async (response) => {
  // 204 / empty body shouldn't crash JSON.parse — return null.
  const text = await response.text();
  if (!text) return null;
  try { return JSON.parse(text); } catch (_e) { return { raw: text }; }
};

const request = async ({ baseUrl, path, method = 'GET', body, formData, fetchImpl }) => {
  const f = fetchImpl || (typeof fetch !== 'undefined' ? fetch : null);
  if (!f) throw new Error('fetch is not available in this environment');

  const url = `${baseUrl.replace(/\/$/, '')}${path}`;
  const init = {
    method,
    headers: { Accept: 'application/json' },
  };
  if (formData) {
    // Don't set Content-Type — the browser injects the multipart boundary
    // automatically. Setting it manually breaks the upload.
    init.body = formData;
  } else if (body !== undefined) {
    init.headers['Content-Type'] = 'application/json';
    init.body = JSON.stringify(body);
  }

  const response = await f(url, init);
  const parsed = await parseJson(response);
  if (!response.ok) throw new ApiError(response.status, parsed);
  return parsed;
};

export const createRestClient = ({ baseUrl, fetchImpl } = {}) => {
  if (!baseUrl) throw new Error('createRestClient: baseUrl is required');

  return {
    // GET /widget-api/config/{appId}
    getConfig: (appId) => request({
      baseUrl,
      path: `/widget-api/config/${encodeURIComponent(appId)}`,
      fetchImpl,
    }),

    // POST /widget-api/session/{appId}
    createSession: (appId, payload = {}) => request({
      baseUrl,
      path: `/widget-api/session/${encodeURIComponent(appId)}`,
      method: 'POST',
      body: payload,
      fetchImpl,
    }),

    // GET /widget-api/session/{sessionToken}
    // Lightweight status check — returns conversation status, agent,
    // last_seen_at, and unread_count. Used at boot and as a polling
    // fallback if the WebSocket disconnects.
    getSession: (sessionToken) => request({
      baseUrl,
      path: `/widget-api/session/${encodeURIComponent(sessionToken)}`,
      fetchImpl,
    }),

    // POST /widget-api/session/{sessionToken}/seen
    // Updates `last_seen_at`; subsequent /session responses will have
    // unread_count: 0 until a new outgoing message arrives.
    markSeen: (sessionToken) => request({
      baseUrl,
      path: `/widget-api/session/${encodeURIComponent(sessionToken)}/seen`,
      method: 'POST',
      body: {},
      fetchImpl,
    }),

    // GET /widget-api/session/{sessionToken}/messages
    getHistory: (sessionToken) => request({
      baseUrl,
      path: `/widget-api/session/${encodeURIComponent(sessionToken)}/messages`,
      fetchImpl,
    }),

    // POST /widget-api/session/{sessionToken}/uploads
    // Multipart upload of a single file. Backend returns a signed URL
    // valid for ~6 hours that is then passed as `attachment_url` to
    // sendMessage (API.md §4.5).
    uploadAttachment: (sessionToken, file) => {
      const fd = new FormData();
      fd.append('file', file);
      return request({
        baseUrl,
        path: `/widget-api/session/${encodeURIComponent(sessionToken)}/uploads`,
        method: 'POST',
        formData: fd,
        fetchImpl,
      });
    },

    // POST /widget-api/session/{sessionToken}/messages
    // `message` (caption / text) and `attachmentUrl` are both optional
    // individually but at least one is required by the backend (422 if
    // both empty).
    sendMessage: (sessionToken, { message, attachmentUrl } = {}) => {
      const body = {};
      if (message != null && message !== '') body.message = message;
      if (attachmentUrl) body.attachment_url = attachmentUrl;
      return request({
        baseUrl,
        path: `/widget-api/session/${encodeURIComponent(sessionToken)}/messages`,
        method: 'POST',
        body,
        fetchImpl,
      });
    },
  };
};

export default createRestClient;
