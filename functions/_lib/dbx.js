// Shared helpers for the Dropbox functions. No route handlers here.
export const APP_KEY = '5ju3aifj0qfxi11';
export const ROOT_NS = '229468454';
export const BASE = '/02 Mortgages and Property/MORTGAGES/APPLICANTS MORTGAGE APPLICANTS/APPLICANTS';
export const SUBFOLDERS = ['00 Client Uploads', '01 Fact-find', '02 ID and Visa', '03 Income and Bank', '04 Property', '05 Lender and Offer'];

export const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
export const cleanName = s => String(s || '').replace(/[\\/:*?"<>|\x00-\x1f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 120);
const ascii = s => s.replace(/[\u007f-￿]/g, c => '\\u' + ('0000' + c.charCodeAt(0).toString(16)).slice(-4));

export function cfg(env) {
  return {
    token: env.DROPBOX_REFRESH_TOKEN || '',
    key: env.DROPBOX_APP_KEY || APP_KEY,
    secret: env.DROPBOX_APP_SECRET || '',
    root: env.DROPBOX_ROOT_NS || ROOT_NS,
    base: (env.DROPBOX_BASE || BASE).replace(/\/+$/, '')
  };
}

export async function accessToken(c) {
  const body = new URLSearchParams({ grant_type: 'refresh_token', refresh_token: c.token, client_id: c.key });
  if (c.secret) body.set('client_secret', c.secret);
  const r = await fetch('https://api.dropboxapi.com/oauth2/token', { method: 'POST', body });
  if (!r.ok) throw new Error('token ' + r.status + ' ' + (await r.text()).slice(0, 200));
  return (await r.json()).access_token;
}

function hdrs(c, tok, extra) {
  return Object.assign({ Authorization: 'Bearer ' + tok, 'Dropbox-API-Path-Root': JSON.stringify({ '.tag': 'root', root: c.root }) }, extra || {});
}

export async function rpc(c, tok, endpoint, args) {
  return fetch('https://api.dropboxapi.com/2/' + endpoint, {
    method: 'POST', headers: hdrs(c, tok, { 'Content-Type': 'application/json' }), body: JSON.stringify(args)
  });
}

export async function folderExists(c, tok, path) {
  const r = await rpc(c, tok, 'files/get_metadata', { path });
  if (r.ok) return (await r.json())['.tag'] === 'folder';
  if (r.status === 409) return false;
  throw new Error('meta ' + r.status + ' ' + (await r.text()).slice(0, 200));
}

// Creates a folder; an existing folder is fine
export async function ensureFolder(c, tok, path) {
  const r = await rpc(c, tok, 'files/create_folder_v2', { path, autorename: false });
  if (r.ok) return true;
  const t = await r.text();
  if (r.status === 409 && /conflict/.test(t)) return false;
  throw new Error('mkdir ' + r.status + ' ' + t.slice(0, 200));
}

export async function upload(c, tok, path, data) {
  const r = await fetch('https://content.dropboxapi.com/2/files/upload', {
    method: 'POST',
    headers: hdrs(c, tok, { 'Content-Type': 'application/octet-stream', 'Dropbox-API-Arg': ascii(JSON.stringify({ path, mode: 'add', autorename: true, mute: false })) }),
    body: data
  });
  if (!r.ok) throw new Error('upload ' + r.status + ' ' + (await r.text()).slice(0, 200));
  return (await r.json()).name;
}

// Client links are signed so nobody can make up a link into another folder
const b64url = buf => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
export async function sign(env, folder) {
  const k = await crypto.subtle.importKey('raw', new TextEncoder().encode('client-link:' + (env.DROPBOX_REFRESH_TOKEN || '')), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return b64url(await crypto.subtle.sign('HMAC', k, new TextEncoder().encode(folder))).slice(0, 16);
}
export async function verify(env, folder, sig) {
  if (!sig || !env.DROPBOX_REFRESH_TOKEN) return false;
  const good = await sign(env, folder);
  if (good.length !== sig.length) return false;
  let d = 0; for (let i = 0; i < good.length; i++) d |= good.charCodeAt(i) ^ sig.charCodeAt(i);
  return d === 0;
}
export const encodeToken = (first, folder) => b64url(new TextEncoder().encode(first + '|' + folder));
export function decodeToken(t) {
  const s = t.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(s + '==='.slice((s.length + 3) % 4));
  const txt = new TextDecoder().decode(Uint8Array.from(bin, ch => ch.charCodeAt(0)));
  const i = txt.indexOf('|');
  return i < 0 ? null : { first: txt.slice(0, i), folder: txt.slice(i + 1) };
}
