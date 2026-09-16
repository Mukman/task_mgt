import { Redis } from '@upstash/redis';

// Vercel's native "KV" product was sunset — storage now comes through the
// Marketplace via the Upstash integration. Depending on how it was installed,
// the env vars show up as either UPSTASH_REDIS_REST_URL/TOKEN or the older
// KV_REST_API_URL/KV_REST_API_TOKEN naming, so we check both.
const redisUrl = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;

const redis = redisUrl && redisToken ? new Redis({ url: redisUrl, token: redisToken }) : null;

const DATA_KEY = 'ledgerline:data';

function isAuthorized(req) {
  const expected = process.env.APP_PASSCODE;
  if (!expected) return false;
  const provided = req.headers['x-app-passcode'];
  return provided === expected;
}

export default async function handler(req, res) {
  if (!process.env.APP_PASSCODE) {
    return res.status(500).json({
      error: 'Server is not configured. Set the APP_PASSCODE environment variable in your Vercel project settings.'
    });
  }

  if (!redis) {
    return res.status(500).json({
      error: 'No Redis database connected. Install the Upstash integration from the Vercel Marketplace and connect it to this project.'
    });
  }

  if (!isAuthorized(req)) {
    return res.status(401).json({ error: 'Unauthorized. Check your passcode.' });
  }

  if (req.method === 'GET') {
    try {
      const data = await redis.get(DATA_KEY);
      return res.status(200).json({ data: data || null });
    } catch (err) {
      return res.status(500).json({ error: 'Could not read data.', detail: String(err) });
    }
  }

  if (req.method === 'POST') {
    try {
      const body = req.body && typeof req.body === 'object' ? req.body : JSON.parse(req.body || '{}');
      await redis.set(DATA_KEY, body);
      return res.status(200).json({ ok: true });
    } catch (err) {
      return res.status(500).json({ error: 'Could not save data.', detail: String(err) });
    }
  }

  res.setHeader('Allow', ['GET', 'POST']);
  return res.status(405).json({ error: 'Method not allowed' });
}