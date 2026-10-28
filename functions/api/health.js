// Reports whether the short-link store answers.
//
// An uptime monitor can call this page. The share panel hides store failures
// from visitors, so without this check a broken store goes unnoticed.
//
// The check only reads. It never writes, so it costs nothing from the small
// daily write allowance. The answer says only "ok" or "error". Details stay in
// the logs, never in the response.

import { json } from '../_shared.js';

// Real short codes use only lowercase letters and digits. The underscores
// mean this key can never be a real code. It usually does not exist, and a
// missing key is still a good answer.
const PROBE_KEY = '__health__';

export async function onRequestGet({ env }) {
  if (!env.LINKS) return json({ status: 'error' }, 503);

  try {
    await env.LINKS.get(PROBE_KEY);
  } catch (err) {
    console.error('health check: store read failed', err);
    return json({ status: 'error' }, 503);
  }

  return json({ status: 'ok' });
}
