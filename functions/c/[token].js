// Short client link: /c/<token>.<signature> opens that client's fact-find.
import { decodeToken, verify } from '../_lib/dbx.js';

export async function onRequestGet({ params, env, request }) {
  const raw = String(params.token || '');
  const dot = raw.lastIndexOf('.');
  let d = null;
  try { d = dot > 0 ? decodeToken(raw.slice(0, dot)) : null; } catch (e) { d = null; }
  const sig = dot > 0 ? raw.slice(dot + 1) : '';
  const to = new URL('/fact-find/', request.url);
  if (d && (await verify(env, d.folder, sig))) {
    to.searchParams.set('ref', d.first);
    to.searchParams.set('c', d.folder);
    to.searchParams.set('s', sig);
  }
  return Response.redirect(to.toString(), 302);
}
