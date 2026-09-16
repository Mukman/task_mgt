import { kv } from '@vercel/kv';

// All data lives under one key since this is a single-user personal app.
// If you ever want multiple separate users, namespace this key per user.
const DATA_KEY = 'ledgerline:data';

function isAuthorized(req) {
  const expected = process.env.APP_PASSCODE;
  if (!expected) {
    // No passcode configured. Refuse rather than silently running open.
    return false;
  }
  const provided = req.headers['x-app-passcode'];
  return provided === expected;
}

export default async function handler(req, res) {
  if (!process.env.APP_PASSCODE) {
    return res.status(500).json({
      error: 'Server is not configured. Set the APP_PASSCODE environment variable in your Vercel project settings.'
    });
  }

  if (!isAuthorized(req)) {
    return res.status(401).json({ error: 'Unauthorized. Check your passcode.' });
  }

  if (req.method === 'GET') {
    try {
      const data = await kv.get(DATA_KEY);
      return res.status(200).json({ data: data || null });
    } catch (err) {
      return res.status(500).json({ error: 'Could not read data.', detail: String(err) });
    }
  }

  if (req.method === 'POST') {
    try {
      const body = req.body && typeof req.body === 'object' ? req.body : JSON.parse(req.body || '{}');
      await kv.set(DATA_KEY, body);
      return res.status(200).json({ ok: true });
    } catch (err) {
      return res.status(500).json({ error: 'Could not save data.', detail: String(err) });
    }
  }

  res.setHeader('Allow', ['GET', 'POST']);
  return res.status(405).json({ error: 'Method not allowed' });
}
