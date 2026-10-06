// Adviser only: creates a client's Dropbox folder and returns their fact-find link.
// Needs Cloudflare secrets ADVISER_PASSWORD and DROPBOX_REFRESH_TOKEN.
import { cfg, json, cleanName, accessToken, ensureFolder, sign, encodeToken, SUBFOLDERS } from '../_lib/dbx.js';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function same(a, b) {
  a = String(a || ''); b = String(b || '');
  if (!a || !b || a.length !== b.length) return false;
  let d = 0; for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}
const tidy = s => cleanName(s).replace(/[^\p{L}\p{N} '\-.]/gu, '').trim().slice(0, 40);
const title = s => s.replace(/(^|[\s'-])(\p{L})/gu, (m, p, ch) => p + ch.toUpperCase());

export async function onRequestPost({ request, env }) {
  const c = cfg(env);
  if (!env.ADVISER_PASSWORD) return json({ ok: false, error: 'no_password_set' }, 503);
  if (!c.token) return json({ ok: false, error: 'not_configured' }, 503);
  let b;
  try { b = await request.json(); } catch (e) { return json({ ok: false, error: 'bad_request' }, 400); }
  if (!same(b.password, env.ADVISER_PASSWORD)) {
    await new Promise(r => setTimeout(r, 1200));
    return json({ ok: false, error: 'wrong_password' }, 401);
  }
  const first = title(tidy(b.first)), last = tidy(b.last).toUpperCase();
  if (!first || !last) return json({ ok: false, error: 'name_needed' }, 400);

  const now = new Date(Date.now() + 3 * 3600 * 1000); // Bahrain time
  const folder = last + ' ' + first + ' - ' + MONTHS[now.getUTCMonth()] + ' ' + now.getUTCFullYear();
  try {
    const tok = await accessToken(c);
    const path = c.base + '/' + folder;
    const created = await ensureFolder(c, tok, path);
    for (const s of SUBFOLDERS) await ensureFolder(c, tok, path + '/' + s);
    const firstName = first.split(' ')[0];
    const link = new URL('/c/' + encodeToken(firstName, folder) + '.' + (await sign(env, folder)), request.url).toString();
    return json({ ok: true, folder, created, first: firstName, link });
  } catch (e) {
    console.log('new-client error', e && e.message);
    return json({ ok: false, error: 'dropbox' }, 502);
  }
}
