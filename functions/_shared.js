// Rules shared by the two short-link endpoints.
//
// The store never holds a URL. It holds a query string that this file has
// already checked, field by field. The redirect is then built from this site's
// own origin plus that query. That is what stops the endpoint from being turned
// into an open redirect: there is no way to make it point anywhere else.

export const UNITS = ['week', 'month', 'day'];
export const MAX_ROWS = 12;
export const MAX_NAME = 40;

// Two years. A printed QR code should still work a long time after it was made.
export const TTL_SECONDS = 60 * 60 * 24 * 730;

const YMD = /^\d{4}-\d{2}-\d{2}$/;

// Rejects 2026-02-30 and friends. The Date constructor rolls those over into
// the next month instead of failing.
function realDate(value) {
  if (!YMD.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

/**
 * Checks a query string and returns a canonical version of it.
 *
 * Returns null when anything is wrong. Unknown parameters are a rejection, not
 * something to ignore. Canonical order matters because the code is derived from
 * this string, so two identical states must produce identical bytes.
 */
export function canonicalQuery(raw) {
  let params;
  try {
    params = new URLSearchParams(raw);
  } catch {
    return null;
  }

  for (const key of params.keys()) {
    if (!['from', 'unit', 'name', 'to', 'inclusive'].includes(key)) return null;
  }

  const froms = params.getAll('from');
  if (froms.length < 1 || froms.length > MAX_ROWS) return null;
  if (!froms.every(realDate)) return null;

  const units = params.getAll('unit');
  if (units.length && units.length !== froms.length) return null;
  if (!units.every((u) => UNITS.includes(u))) return null;

  const names = params.getAll('name');
  if (names.length && names.length !== froms.length) return null;
  if (!names.every((n) => [...n].length <= MAX_NAME)) return null;

  const to = params.get('to');
  if (!to || !realDate(to)) return null;

  const inclusive = params.get('inclusive');
  if (inclusive !== null && inclusive !== '1' && inclusive !== '0') return null;

  const out = new URLSearchParams();
  froms.forEach((v) => out.append('from', v));
  units.forEach((v) => out.append('unit', v));
  if (names.some((n) => n)) names.forEach((v) => out.append('name', v));
  out.set('to', to);
  if (inclusive === '1') out.set('inclusive', '1');
  return out.toString();
}

const ALPHABET = '23456789abcdefghijkmnpqrstuvwxyz';

/**
 * Turns a canonical query into a short code.
 *
 * The code is derived from the query, so the same state always yields the same
 * code. Sharing the same page twice costs one write, not two, which matters
 * because the daily write allowance is far smaller than the read allowance.
 *
 * The alphabet leaves out characters that are easy to misread aloud or in a
 * scanned code: 0, 1, l and o.
 */
export async function codeFor(query) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(query));
  const bytes = new Uint8Array(digest);
  let code = '';
  for (let i = 0; i < 7; i++) code += ALPHABET[bytes[i] % ALPHABET.length];
  return code;
}

export const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store'
    }
  });
