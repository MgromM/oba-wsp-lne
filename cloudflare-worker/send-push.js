// Cloudflare Worker: tiny proxy that holds the OneSignal REST API Key server-side
// so it never ships to the browser. Deploy with `wrangler deploy` (free plan, no card).
//
// Setup:
//   1. npm install -g wrangler   (or use npx wrangler)
//   2. wrangler login
//   3. wrangler secret put ONESIGNAL_REST_API_KEY   (paste the key from the OneSignal dashboard)
//   4. wrangler deploy
//   5. Copy the resulting *.workers.dev URL into PUSH_ENDPOINT in app.html

const ONESIGNAL_APP_ID = '0e179f57-c4e6-4d10-998e-ce35527ffc0b';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS_HEADERS });
    }
    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405, headers: CORS_HEADERS });
    }

    let body;
    try {
      body = await request.json();
    } catch (e) {
      return new Response('Bad JSON', { status: 400, headers: CORS_HEADERS });
    }

    const { toExternalId, title, message } = body || {};
    if (!toExternalId || !title || !message) {
      return new Response('Missing fields', { status: 400, headers: CORS_HEADERS });
    }

    const res = await fetch('https://onesignal.com/api/v1/notifications', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${env.ONESIGNAL_REST_API_KEY}`,
      },
      body: JSON.stringify({
        app_id: ONESIGNAL_APP_ID,
        include_aliases: { external_id: [String(toExternalId)] },
        target_channel: 'push',
        headings: { en: String(title) },
        contents: { en: String(message) },
      }),
    });

    return new Response(await res.text(), { status: res.status, headers: CORS_HEADERS });
  },
};
