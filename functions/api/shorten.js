// Creates a short code for one page state.
//
// The request body carries a query string, never a URL. Anything that is not
// this page's own set of parameters is rejected, so the store can only ever
// hold states this site itself can render.

import { canonicalQuery, codeFor, TTL_SECONDS, json } from '../_shared.js';

export async function onRequestPost({ request, env }) {
  if (!env.LINKS) return json({ error: 'store unavailable' }, 503);

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'bad body' }, 400);
  }

  const raw = typeof body?.q === 'string' ? body.q : '';
  // A page state cannot be this long. A long body is either a mistake or an
  // attempt to use the store for something else.
  if (raw.length > 2000) return json({ error: 'too long' }, 400);

  const query = canonicalQuery(raw);
  if (!query) return json({ error: 'unsupported parameters' }, 400);

  const code = await codeFor(query);

  // The code comes from the query, so an existing entry already holds exactly
  // this value. Skipping the write keeps repeat shares off the daily quota.
  const existing = await env.LINKS.get(code);
  if (existing === query) return json({ code, reused: true });

  await env.LINKS.put(code, query, { expirationTtl: TTL_SECONDS });
  return json({ code, reused: false });
}

// Anything other than POST gets a plain refusal rather than the page shell.
export const onRequest = ({ request }) =>
  request.method === 'POST' ? undefined : json({ error: 'method not allowed' }, 405);
