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

const request = async ({ baseUrl, path, method = 'GET', body, fetchImpl }) => {
  const f = fetchImpl || (typeof fetch !== 'undefined' ? fetch : null);
  if (!f) throw new Error('fetch is not available in this environment');

  const url = `${baseUrl.replace(/\/$/, '')}${path}`;
  const init = {
    method,
    headers: { Accept: 'application/json' },
  };
  if (body !== undefined) {
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

    // GET /widget-api/session/{sessionToken}/messages
    getHistory: (sessionToken) => request({
      baseUrl,
      path: `/widget-api/session/${encodeURIComponent(sessionToken)}/messages`,
      fetchImpl,
    }),

    // POST /widget-api/session/{sessionToken}/messages
    sendMessage: (sessionToken, message) => request({
      baseUrl,
      path: `/widget-api/session/${encodeURIComponent(sessionToken)}/messages`,
      method: 'POST',
      body: { message },
      fetchImpl,
    }),
  };
};

export default createRestClient;
