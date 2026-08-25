// Sends a short code back to the full page.
//
// The destination is built here from this request's own origin plus the stored
// query. Nothing about the target comes from the stored value, so a stored
// entry cannot redirect a visitor off this site.

import { canonicalQuery } from '../_shared.js';

export async function onRequestGet({ params, env, request }) {
  const code = String(params.code || '');
  if (!/^[a-z0-9]{4,12}$/.test(code)) return notFound();
  if (!env.LINKS) return notFound();

  const stored = await env.LINKS.get(code);
  if (!stored) return notFound();

  // Checked again on the way out. An entry written by an older, looser version
  // of the rules must not be trusted just because it is already in the store.
  const query = canonicalQuery(stored);
  if (!query) return notFound();

  const target = new URL(request.url);
  target.pathname = '/';
  target.search = query;

  return new Response(null, {
    status: 302,
    headers: {
      location: target.toString(),
      'cache-control': 'public, max-age=300'
    }
  });
}

function notFound() {
  return new Response('這個短網址不存在或已經過期。\nThis short link does not exist or has expired.\n', {
    status: 404,
    headers: { 'content-type': 'text/plain; charset=utf-8' }
  });
}
