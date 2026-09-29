// Only public playlist metadata is fetched. No cookies or credentials are accepted.
const allowedOrigins = new Set(['https://chlorophyllc.github.io', 'https://www.chlorophyllc.github.io', 'https://annual-playlist.pages.dev', 'http://localhost:8000', 'http://127.0.0.1:8000']);
function originAllowed(origin, env) {
  if (!origin) return true;
  if (allowedOrigins.has(origin) || origin === env?.SITE_ORIGIN) return true;
  try {
    const url = new URL(origin);
    return (url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname)) ||
      (url.protocol === 'https:' && url.hostname.endsWith('.pages.dev') && url.hostname.startsWith('annual-playlist'));
  } catch (_) { return false; }
}
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
  // Cloudflare Workers supports only follow/manual for redirect handling.
  const response = await fetch(url, {...init, cache: 'no-store', redirect: 'manual', signal: AbortSignal.timeout(12000), headers: {'User-Agent': 'annual-playlist-worker/1.0', ...(init?.headers || {})}});
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
async function searchMusic(query, type) {
  if (typeof query !== 'string' || !query.trim() || query.length > 120) throw new Error('请输入 1 至 120 个字符的搜索词');
  if (!['songs', 'albums'].includes(type)) throw new Error('不支持的搜索类型');
  const kind = type === 'albums' ? 'albums' : 'songs';
  const params = `s=${encodeURIComponent(query.trim())}&type=${type === 'albums' ? '10' : '1'}&limit=18&offset=0`;
  const data = await api(`https://music.163.com/api/search/get?${params}`);
  if (data.code !== 200) throw new Error('网易云搜索暂时不可用');
  const list = data.result?.[kind] || [];
  let details = new Map();
  if (type === 'songs' && list.length) {
    const ids = list.map(item => item.id).filter(Boolean);
    const response = await api('https://music.163.com/api/v3/song/detail', {method: 'POST', headers: {'Content-Type': 'application/x-www-form-urlencoded'}, body: `c=${encodeURIComponent(JSON.stringify(ids.map(id => ({id}))))}`});
    details = new Map((response.songs || []).map(item => [String(item.id), item]));
  }
  return {results: list.map(item => {
    const detail = details.get(String(item.id)) || item;
    const artists = detail.ar || item.artists || (item.artist ? [item.artist] : []);
    const artist = artists.map(entry => entry.name).filter(Boolean).join(' / ');
    const album = type === 'albums' ? item : (detail.al || item.album || {});
    const cover = album.picUrl || album.blurPicUrl || '';
    return {id: `netease:${type}:${item.id}`, name: detail.name || item.name || '', artist, album: album.name || '', albumId: album.id ? `netease:album:${album.id}` : null, cover: cover.replace(/^http:/, 'https:'), source: '网易云音乐', url: `https://music.163.com/#/${type === 'albums' ? 'album' : 'song'}?id=${item.id}`};
  })};
}
export default {async fetch(request, env = {}) {
  const origin = request.headers.get('Origin');
  const headers = {'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Vary': 'Origin', 'Access-Control-Allow-Methods': 'POST,OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type'};
  if (origin && originAllowed(origin, env)) headers['Access-Control-Allow-Origin'] = origin;
  const json = (value, status = 200) => new Response(JSON.stringify(value), {status, headers});
  if (!originAllowed(origin, env)) return json({error: '不允许的来源'}, 403);
  const pathname = new URL(request.url).pathname;
  if (!['/api/import', '/api/search'].includes(pathname)) return json({error: 'Not found'}, 404);
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
    if (pathname === '/api/search') return json(await searchMusic(body.query, body.type));
    return json(await importPlaylist(body.url));
  } catch (error) {
    const message = error?.name === 'TimeoutError' ? '请求超时，请稍后重试' : (error?.message || '请求失败');
    return json({error: message === 'The string did not match the expected pattern.' ? '网易云搜索服务暂时不可用，请稍后重试（请确认 Worker 已重新部署）' : message}, 400);
  }
}};
