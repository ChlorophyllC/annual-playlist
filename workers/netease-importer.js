// Cloudflare Worker: JavaScript replacement for the local Python importer.
// Deploy with `wrangler deploy workers/netease-importer.js` and set the URL
// in the static site: localStorage.setItem('annual-playlist:backend', WORKER_URL)
const cors = {"Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET,POST,OPTIONS", "Access-Control-Allow-Headers": "Content-Type"};
const json = (value, status = 200) => new Response(JSON.stringify(value), {status, headers: {...cors, "Content-Type": "application/json; charset=utf-8"}});
function idFrom(value) { const match = String(value || '').match(/(?:[?&]id=|playlist[/:])([0-9]+)/); return match?.[1] || (String(value).match(/^\d+$/) ? String(value) : ''); }
async function api(url, init) { const response = await fetch(url, {...init, headers: {"User-Agent": "annual-playlist-worker/1.0", ...(init?.headers || {})}}); if (!response.ok) throw new Error(`网易云请求失败 (${response.status})`); return response.json(); }
async function importPlaylist(value) {
  const id = idFrom(value); if (!id) throw new Error('无法识别网易云歌单 ID');
  const detail = await api(`https://music.163.com/api/v6/playlist/detail?id=${id}&n=100000`);
  if (detail.code !== 200 || !detail.playlist) throw new Error('歌单不可访问或已下架');
  const playlist = detail.playlist; const ids = (playlist.trackIds || []).map(item => item.id).filter(Boolean); const songs = [];
  for (let start = 0; start < ids.length; start += 300) {
    const response = await api('https://music.163.com/api/v3/song/detail', {method: 'POST', headers: {'Content-Type': 'application/x-www-form-urlencoded'}, body: `c=${encodeURIComponent(JSON.stringify(ids.slice(start, start + 300).map(id => ({id}))))}`});
    songs.push(...(response.songs || []));
  }
  const byId = new Map(songs.map(song => [String(song.id), song]));
  const items = ids.map((id, position) => { const song = byId.get(String(id)); if (!song) return {id, position, matched: false}; const album = song.al || {}; return {id: song.id, position, matched: true, name: song.name || '', artists: (song.ar || []).map(artist => ({id: artist.id, name: artist.name})), album: {id: album.id, name: album.name || '', cover: album.picUrl || ''}, duration: song.dt || 0, url: `https://music.163.com/#/song?id=${song.id}`}; });
  return {playlist: {id, name: playlist.name || '未命名歌单', count: playlist.trackCount || ids.length}, items, sourceCount: ids.length};
}
export default {async fetch(request) { if (request.method === 'OPTIONS') return new Response('', {headers: cors}); const url = new URL(request.url); if (url.pathname !== '/api/import') return json({error: 'Not found'}, 404); try { const body = request.method === 'POST' ? await request.json() : {url: url.searchParams.get('url')}; return json(await importPlaylist(body.url)); } catch (error) { return json({error: error.message || '导入失败'}, 400); } }};
