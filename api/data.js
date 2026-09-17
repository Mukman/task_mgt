import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = supabaseUrl && supabaseServiceKey
  ? createClient(supabaseUrl, supabaseServiceKey)
  : null;

// All data lives under one row since this is a single-user personal app.
const ROW_ID = 'singleton';
const TABLE = 'ledgerline_data';

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

  if (!supabase) {
    return res.status(500).json({
      error: 'No Supabase database connected. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in your Vercel project settings.'
    });
  }

  if (!isAuthorized(req)) {
    return res.status(401).json({ error: 'Unauthorized. Check your passcode.' });
  }

  if (req.method === 'GET') {
    try {
      const { data, error } = await supabase
        .from(TABLE)
        .select('data')
        .eq('id', ROW_ID)
        .maybeSingle();
      if (error) throw error;
      return res.status(200).json({ data: data ? data.data : null });
    } catch (err) {
      return res.status(500).json({ error: 'Could not read data.', detail: String(err.message || err) });
    }
  }

  if (req.method === 'POST') {
    try {
      const body = req.body && typeof req.body === 'object' ? req.body : JSON.parse(req.body || '{}');
      const { error } = await supabase
        .from(TABLE)
        .upsert({ id: ROW_ID, data: body, updated_at: new Date().toISOString() });
      if (error) throw error;
      return res.status(200).json({ ok: true });
    } catch (err) {
      return res.status(500).json({ error: 'Could not save data.', detail: String(err.message || err) });
    }
  }

  res.setHeader('Allow', ['GET', 'POST']);
  return res.status(405).json({ error: 'Method not allowed' });
}
