// Cloudflare Pages Function: saves a client's fact-find PDF and documents into their Dropbox folder.
// Settings (Cloudflare Pages > Settings > Variables and secrets):
//   DROPBOX_REFRESH_TOKEN  (secret, from /setup/dropbox/)
//   DROPBOX_APP_KEY        optional, defaults to the UK Expat Fact-find app
//   DROPBOX_ROOT_NS        optional, team root namespace id
//   DROPBOX_BASE           optional, folder that holds the client folders

const APP_KEY = '5ju3aifj0qfxi11';
const ROOT_NS = '229468454';
const BASE = '/02 Mortgages and Property/MORTGAGES/APPLICANTS MORTGAGE APPLICANTS/APPLICANTS';
const MAX_FILE = 25 * 1024 * 1024, MAX_TOTAL = 80 * 1024 * 1024, MAX_FILES = 20;
const OK_EXT = /\.(pdf|jpe?g|png|heic|heif|webp|gif|tiff?|docx?|xlsx?|txt)$/i;

const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
const ascii = s => s.replace(/[\u007f-￿]/g, c => '\\u' + ('0000' + c.charCodeAt(0).toString(16)).slice(-4));
const cleanName = s => String(s || '').replace(/[\\/:*?"<>|\x00-\x1f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 120);

function cfg(env) {
  return {
    token: env.DROPBOX_REFRESH_TOKEN || '',
    key: env.DROPBOX_APP_KEY || APP_KEY,
    secret: env.DROPBOX_APP_SECRET || '',
    root: env.DROPBOX_ROOT_NS || ROOT_NS,
    base: (env.DROPBOX_BASE || BASE).replace(/\/+$/, '')
  };
}

async function accessToken(c) {
  const body = new URLSearchParams({ grant_type: 'refresh_token', refresh_token: c.token, client_id: c.key });
  if (c.secret) body.set('client_secret', c.secret);
  const r = await fetch('https://api.dropboxapi.com/oauth2/token', { method: 'POST', body });
  if (!r.ok) throw new Error('token ' + r.status + ' ' + (await r.text()).slice(0, 200));
  return (await r.json()).access_token;
}

function hdrs(c, tok, extra) {
  return Object.assign({ Authorization: 'Bearer ' + tok, 'Dropbox-API-Path-Root': JSON.stringify({ '.tag': 'root', root: c.root }) }, extra || {});
}

async function folderExists(c, tok, path) {
  const r = await fetch('https://api.dropboxapi.com/2/files/get_metadata', {
    method: 'POST', headers: hdrs(c, tok, { 'Content-Type': 'application/json' }), body: JSON.stringify({ path })
  });
  if (r.ok) return (await r.json())['.tag'] === 'folder';
  if (r.status === 409) return false;
  throw new Error('meta ' + r.status + ' ' + (await r.text()).slice(0, 200));
}

async function upload(c, tok, path, data) {
  const r = await fetch('https://content.dropboxapi.com/2/files/upload', {
    method: 'POST',
    headers: hdrs(c, tok, { 'Content-Type': 'application/octet-stream', 'Dropbox-API-Arg': ascii(JSON.stringify({ path, mode: 'add', autorename: true, mute: false })) }),
    body: data
  });
  if (!r.ok) throw new Error('upload ' + r.status + ' ' + (await r.text()).slice(0, 200));
  return (await r.json()).name;
}

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
    const saved = [];
    if (ff) {
      const buf = await ff.arrayBuffer();
      if (new TextDecoder().decode(new Uint8Array(buf.slice(0, 5))) !== '%PDF-') return json({ ok: false, error: 'bad_pdf' }, 400);
      saved.push(await upload(c, tok, folder + '/01 Fact-find/Fact-find ' + who + ' ' + stamp + '.pdf', buf));
    }
    for (const f of docs) {
      saved.push(await upload(c, tok, folder + '/00 Client Uploads/' + who + ' - ' + (cleanName(f.name) || 'document'), await f.arrayBuffer()));
    }
    return json({ ok: true, saved: saved.length });
  } catch (e) {
    console.log('submit error', e && e.message);
    return json({ ok: false, error: 'dropbox' }, 502);
  }
}
