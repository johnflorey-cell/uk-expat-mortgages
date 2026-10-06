// Saves a client's fact-find PDF and documents into their Dropbox folder.
// Needs the Cloudflare secret DROPBOX_REFRESH_TOKEN (from /setup/dropbox/).
import { cfg, json, cleanName, accessToken, folderExists, upload, verify } from '../_lib/dbx.js';

const MAX_FILE = 25 * 1024 * 1024, MAX_TOTAL = 80 * 1024 * 1024, MAX_FILES = 20;
const OK_EXT = /\.(pdf|jpe?g|png|heic|heif|webp|gif|tiff?|docx?|xlsx?|txt)$/i;

export async function onRequestGet({ env }) {
  return json({ ready: !!cfg(env).token });
}

export async function onRequestPost({ request, env }) {
  const c = cfg(env);
  if (!c.token) return json({ ok: false, error: 'not_configured' }, 503);
  let form;
  try { form = await request.formData(); } catch (e) { return json({ ok: false, error: 'bad_request' }, 400); }

  const client = cleanName(form.get('c'));
  if (!client || /\.\./.test(client)) return json({ ok: false, error: 'bad_client' }, 400);
  if (!(await verify(env, client, String(form.get('s') || '')))) return json({ ok: false, error: 'bad_link' }, 403);
  const who = cleanName(form.get('who')) || 'Client';

  const ff = form.get('factfind');
  const docs = form.getAll('docs').filter(f => f && typeof f === 'object' && f.size > 0);
  if (!ff && !docs.length) return json({ ok: false, error: 'no_files' }, 400);
  if (docs.length > MAX_FILES) return json({ ok: false, error: 'too_many_files' }, 413);
  let total = ff ? ff.size : 0;
  for (const f of docs) {
    if (f.size > MAX_FILE) return json({ ok: false, error: 'file_too_big', name: f.name }, 413);
    if (!OK_EXT.test(f.name || '')) return json({ ok: false, error: 'file_type', name: f.name }, 415);
    total += f.size;
  }
  if (total > MAX_TOTAL) return json({ ok: false, error: 'too_big' }, 413);

  try {
    const tok = await accessToken(c);
    const folder = c.base + '/' + client;
    if (!(await folderExists(c, tok, folder))) return json({ ok: false, error: 'unknown_client' }, 404);
    const stamp = new Date().toISOString().slice(0, 10);
    let saved = 0;
    if (ff) {
      const buf = await ff.arrayBuffer();
      if (new TextDecoder().decode(new Uint8Array(buf.slice(0, 5))) !== '%PDF-') return json({ ok: false, error: 'bad_pdf' }, 400);
      await upload(c, tok, folder + '/01 Fact-find/Fact-find ' + who + ' ' + stamp + '.pdf', buf); saved++;
    }
    for (const f of docs) {
      await upload(c, tok, folder + '/00 Client Uploads/' + who + ' - ' + (cleanName(f.name) || 'document'), await f.arrayBuffer()); saved++;
    }
    return json({ ok: true, saved });
  } catch (e) {
    console.log('submit error', e && e.message);
    return json({ ok: false, error: 'dropbox' }, 502);
  }
}
