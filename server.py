#!/usr/bin/env python3
import json
import os
import re
import subprocess
import urllib.parse
import urllib.request
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

PORT = 8000

def fetch_cover(url):
    parsed = urllib.parse.urlsplit(url)
    # Only the known cover CDN is allowed; never follow redirects to other hosts.
    allowed_hosts = re.fullmatch(r"p[0-9]+\.music\.126\.net", parsed.hostname or "") or re.fullmatch(r"(?:lastfm\.freetls\.fastly\.net|userserve-ak\.last\.fm)", parsed.hostname or "")
    allowed_hosts = allowed_hosts or re.fullmatch(r"[a-zA-Z0-9-]+\.mzstatic\.com", parsed.hostname or "")
    if (parsed.scheme not in ("http", "https") or parsed.username or parsed.password
            or parsed.port not in (None, 80, 443)
            or not allowed_hosts):
        raise ValueError("不支持的封面地址")
    # A 1200px cover exceeds the largest cover slot in a 3200px poster and
    # avoids downloading oversized originals (some exceed 18 MB).
    query = urllib.parse.parse_qs(parsed.query)
    if (parsed.hostname or "").endswith(".music.126.net"):
        query["param"] = ["1200y1200"]
    secure_url = urllib.parse.urlunsplit(("https", parsed.hostname, parsed.path, urllib.parse.urlencode(query, doseq=True), ""))
    result = subprocess.run(["curl", "--fail", "--silent", "--show-error", "--max-time", "20",
                             "--max-filesize", "8388608", secure_url], capture_output=True, timeout=25)
    content = result.stdout
    if result.returncode or len(content) > 8388608:
        raise ValueError("封面下载失败")
    if content.startswith(b"\xff\xd8\xff"):
        mime = "image/jpeg"
    elif content.startswith(b"\x89PNG\r\n\x1a\n"):
        mime = "image/png"
    elif content[:4] == b"RIFF" and content[8:12] == b"WEBP":
        mime = "image/webp"
    else:
        raise ValueError("封面不是支持的图片格式")
    return content, mime

def get_json(url, body=None):
    # Use the system curl trust store; keep HTTPS certificate verification enabled.
    command = ["curl", "--fail", "--silent", "--show-error", "--max-time", "25", url]
    if body is not None:
        command.extend(["--header", "Content-Type: application/x-www-form-urlencoded", "--data-binary", "@-"])
    response = subprocess.run(command, input=body, capture_output=True, timeout=30)
    if response.returncode:
        raise ValueError("音乐平台请求失败，请稍后重试")
    return json.loads(response.stdout)

def playlist_id(value):
    match = re.search(r"(?:[?&]id=|playlist[/:])([0-9]+)", value.strip())
    if not match and value.strip().isdigit():
        return value.strip()
    if not match:
        raise ValueError("无法从链接中找到歌单 ID")
    return match.group(1)

def fetch_playlist(value):
    pid = playlist_id(value)
    detail = get_json(f"https://music.163.com/api/v6/playlist/detail?id={pid}&n=100000")
    if detail.get("code") != 200 or not detail.get("playlist"):
        raise ValueError(detail.get("message") or "网易云没有返回歌单")
    playlist = detail["playlist"]
    ids = [item.get("id") for item in playlist.get("trackIds", []) if item.get("id")]
    songs = []
    for start in range(0, len(ids), 300):
        payload = json.dumps([{"id": song_id} for song_id in ids[start:start + 300]], separators=(",", ":")).encode()
        result = get_json("https://music.163.com/api/v3/song/detail", b"c=" + urllib.parse.quote_from_bytes(payload).encode())
        if result.get("code") != 200:
            raise ValueError("歌曲详情请求失败，请稍后重试")
        songs.extend(result.get("songs", []))
    by_id = {str(song.get("id")): song for song in songs}
    items = []
    for position, song_id in enumerate(ids):
        song = by_id.get(str(song_id))
        if not song:
            items.append({"id": song_id, "position": position, "matched": False})
            continue
        album = song.get("al") or song.get("album") or {}
        artists = song.get("ar") or song.get("artists") or []
        items.append({
            "id": song.get("id"), "position": position, "matched": True,
            "name": song.get("name", ""),
            "artists": [{"id": a.get("id"), "name": a.get("name", "")} for a in artists],
            "album": {"id": album.get("id"), "name": album.get("name", ""), "cover": album.get("picUrl") or album.get("blurPicUrl") or ""},
            "duration": song.get("dt") or song.get("duration") or 0,
            "url": f"https://music.163.com/#/song?id={song.get('id')}"
        })
    return {"playlist": {"id": pid, "name": playlist.get("name", "未命名歌单"), "count": playlist.get("trackCount", len(ids))}, "items": items, "sourceCount": len(ids)}

class Handler(SimpleHTTPRequestHandler):
    def do_GET(self):
        parsed = urllib.parse.urlsplit(self.path)
        if parsed.path == "/api/search":
            try:
                params = urllib.parse.parse_qs(parsed.query)
                api_key = os.environ.get("LASTFM_API_KEY")
                if not api_key:
                    raise ValueError("Last.fm 搜索尚未配置 API key，可使用 Apple 搜索或自行填写")
                album_mode = params.get("type", ["albums"])[0] == "albums"
                kind = "album" if album_mode else "track"
                query = params.get("q", [""])[0][:200]
                response = get_json("https://ws.audioscrobbler.com/2.0/?" + urllib.parse.urlencode({"method":kind+".search",kind:query,"api_key":api_key,"format":"json","limit":18}))
                if response.get("error"):
                    raise ValueError("Last.fm 搜索暂不可用")
                matches = response.get("results", {}).get(kind+"matches", {}).get(kind, [])
                results = []
                for item in matches:
                    images = [image.get("#text") for image in item.get("image", []) if image.get("#text")]
                    results.append({"id":"lastfm:"+item.get("url", item.get("name", "")),"name":item.get("name", ""),"artist":item.get("artist", ""),"album":item.get("name", "") if album_mode else "","albumId":"lastfm:"+item.get("url", "") if album_mode else None,"cover":images[-1] if images else "","source":"Last.fm","url":item.get("url", "")})
                content = json.dumps({"results":results}, ensure_ascii=False).encode()
                self.send_response(200)
            except Exception as error:
                content = json.dumps({"error":str(error)}, ensure_ascii=False).encode()
                self.send_response(400)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.end_headers()
            self.wfile.write(content)
            return
        if parsed.path != "/api/cover":
            return super().do_GET()
        try:
            url = urllib.parse.parse_qs(parsed.query).get("url", [""])[0]
            content, mime = fetch_cover(url)
            self.send_response(200)
            self.send_header("Content-Type", mime)
            self.send_header("Cache-Control", "private, max-age=3600")
            self.send_header("Content-Length", str(len(content)))
            self.end_headers()
            self.wfile.write(content)
        except Exception:
            self.send_error(400, "Cover unavailable")

    def do_POST(self):
        if self.path != "/api/import":
            self.send_error(404)
            return
        try:
            length = int(self.headers.get("Content-Length", 0))
            body = json.loads(self.rfile.read(length) or b"{}")
            result = fetch_playlist(body.get("url", ""))
            raw = json.dumps(result, ensure_ascii=False).encode()
            self.send_response(200)
        except Exception as error:
            raw = json.dumps({"error": str(error)}, ensure_ascii=False).encode()
            self.send_response(400)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(raw)))
        self.end_headers()
        self.wfile.write(raw)

if __name__ == "__main__":
    print(f"年度歌单运行于 http://127.0.0.1:{PORT}")
    ThreadingHTTPServer(("127.0.0.1", PORT), Handler).serve_forever()
