// Only public playlist metadata is fetched. No cookies or credentials are accepted.
const allowedOrigins = new Set(['https://chlorophyllc.github.io', 'http://localhost:8000', 'http://127.0.0.1:8000']);
const allowedHosts = new Set(['163cn.tv', 'music.163.com', 'y.music.163.com']);
function idFrom(value) { const match = String(value || '').match(/(?:[?&]id=|playlist[/:])([0-9]{1,20})(?![0-9])/); return match?.[1] || (/^\d{1,20}$/.test(value) ? value : ''); }
async function resolveId(value) {
  if (typeof value !== 'string' || value.length > 2048) throw new Error('歌单链接过长或格式错误');
  if (/^\d{1,20}$/.test(value.trim())) return value.trim();
  const link = value.match(/https?:\/\/[^\s<>"\]）)]+/i)?.[0];
  if (!link) throw new Error('请输入网易云歌单链接或 ID');
  let url = new URL(link);
  for (let hop = 0; hop < 5; hop++) {
    if (!allowedHosts.has(url.hostname) || url.username || url.password || url.port || !['https:', 'http:'].includes(url.protocol)) throw new Error('不支持的分享地址');
    url.protocol = 'https:';
    const id = url.hostname !== '163cn.tv' && /playlist/i.test(url.href) ? idFrom(url.href) : '';
    if (id) return id;
    const response = await fetch(url.href, {redirect: 'manual', signal: AbortSignal.timeout(8000), cache: 'no-store'});
    await response.body?.cancel();
    const target = response.headers.get('location');
    if (response.status < 300 || response.status >= 400 || !target) break;
    url = new URL(target, url);
  }
  throw new Error('无法解析分享链接，请在浏览器打开后复制完整歌单地址');
}
async function api(url, init) {
  const response = await fetch(url, {...init, cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(12000), headers: {'User-Agent': 'annual-playlist-worker/1.0', ...(init?.headers || {})}});
  if (!response.ok) throw new Error(`网易云请求失败 (${response.status})`);
  return response.json();
}
// Best-effort fallback per isolate; the Cloudflare binding is needed for edge enforcement.
const requests = new Map();
function limited(ip) {
  const now = Date.now();
  for (const [key, item] of requests) if (now > item.until) requests.delete(key);
  if (!requests.has(ip)) { if (requests.size >= 2000) return true; requests.set(ip, {count: 0, until: now + 60000}); }
  return ++requests.get(ip).count > 5;
}
async function importPlaylist(value) {
  const id = await resolveId(value); if (!id) throw new Error('无法识别网易云歌单 ID');
  const detail = await api(`https://music.163.com/api/v6/playlist/detail?id=${id}&n=100`);
  if (detail.code !== 200 || !detail.playlist) throw new Error('歌单不可访问或已下架');
  const playlist = detail.playlist; const ids = (playlist.trackIds || []).map(item => item.id).filter(Boolean); const sourceCount = ids.length; ids.splice(100); const songs = [];
  for (let start = 0; start < ids.length; start += 300) {
    const response = await api('https://music.163.com/api/v3/song/detail', {method: 'POST', headers: {'Content-Type': 'application/x-www-form-urlencoded'}, body: `c=${encodeURIComponent(JSON.stringify(ids.slice(start, start + 300).map(id => ({id}))))}`});
    if (response.code !== 200) throw new Error('歌曲详情请求失败');
    songs.push(...(response.songs || []));
  }
  const byId = new Map(songs.map(song => [String(song.id), song]));
  const items = ids.map((id, position) => { const song = byId.get(String(id)); if (!song) return {id, position, matched: false}; const album = song.al || {}; return {id: song.id, position, matched: true, name: song.name || '', artists: (song.ar || []).map(artist => ({id: artist.id, name: artist.name})), album: {id: album.id, name: album.name || '', cover: album.picUrl || ''}, duration: song.dt || 0, url: `https://music.163.com/#/song?id=${song.id}`}; });
  return {playlist: {id, name: playlist.name || '未命名歌单', count: playlist.trackCount || ids.length}, items, sourceCount, truncated: sourceCount > 100};
}
export default {async fetch(request, env = {}) {
  const origin = request.headers.get('Origin');
  const headers = {'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Vary': 'Origin', 'Access-Control-Allow-Methods': 'POST,OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type'};
  if (allowedOrigins.has(origin)) headers['Access-Control-Allow-Origin'] = origin;
  const json = (value, status = 200) => new Response(JSON.stringify(value), {status, headers});
  if (origin && !allowedOrigins.has(origin)) return json({error: '不允许的来源'}, 403);
  if (new URL(request.url).pathname !== '/api/import') return json({error: 'Not found'}, 404);
  if (request.method === 'OPTIONS') return new Response(null, {status: 204, headers});
  if (request.method !== 'POST') return json({error: '仅支持 POST'}, 405);
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  if (limited(ip) || (env.IMPORT_LIMITER && !(await env.IMPORT_LIMITER.limit({key: ip})).success)) {
    headers['Retry-After'] = '60'; return json({error: '操作过于频繁，请一分钟后再试'}, 429);
  }
  if (!request.headers.get('Content-Type')?.includes('application/json')) return json({error: '需要 JSON 请求'}, 415);
  if (Number(request.headers.get('Content-Length')) > 4096) return json({error: '请求过大'}, 413);
  try {
    const reader = request.body?.getReader(); if (!reader) return json({error: '缺少请求内容'}, 400);
    const chunks = []; let size = 0;
    while (true) { const {done, value} = await reader.read(); if (done) break; size += value.byteLength; if (size > 4096) { await reader.cancel(); return json({error: '请求过大'}, 413); } chunks.push(value); }
    const body = JSON.parse(await new Blob(chunks).text());
    return json(await importPlaylist(body.url));
  } catch (error) { return json({error: error.name === 'TimeoutError' ? '请求超时，请稍后重试' : error.message || '导入失败'}, 400); }
}};
