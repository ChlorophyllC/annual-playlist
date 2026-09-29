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
    allowed_hosts = re.fullmatch(r"p[0-9]+\.music\.126\.net", parsed.hostname or "")
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
    if not isinstance(value, str) or len(value) > 2048:
        raise ValueError("歌单链接过长或格式错误")
    value = value.strip()
    if re.fullmatch(r"[0-9]{1,20}", value):
        return value
    match = re.search(r'https?://[^\s<>"\]）)]+', value)
    if not match:
        raise ValueError("请输入网易云歌单链接或 ID")
    url = match.group(0)
    for _ in range(5):
        parsed = urllib.parse.urlsplit(url)
        if (parsed.hostname not in ("163cn.tv", "music.163.com", "y.music.163.com")
                or parsed.username or parsed.password or parsed.port
                or parsed.scheme not in ("http", "https")):
            raise ValueError("不支持的分享地址")
        url = urllib.parse.urlunsplit(("https", parsed.netloc, parsed.path, parsed.query, parsed.fragment))
        match = re.search(r"(?:[?&]id=|playlist[/:])([0-9]{1,20})(?![0-9])", url)
        if parsed.hostname != "163cn.tv" and "playlist" in url and match:
            return match.group(1)
        # curl does not follow redirects: validate every destination before requesting it.
        response = subprocess.run(["curl", "--silent", "--show-error", "--max-time", "8",
                                   "--output", os.devnull, "--write-out", "%{redirect_url}", url],
                                  capture_output=True, timeout=10)
        if response.returncode or not response.stdout:
            break
        url = response.stdout.decode().strip()
    raise ValueError("无法解析分享链接，请在浏览器打开后复制完整歌单地址")

def fetch_playlist(value, requested_start=1, requested_end=100):
    try:
        start = int(requested_start or 1)
        end = int(requested_end or min(100, start + 99))
    except (TypeError, ValueError):
        raise ValueError("起止位置必须是整数")
    if start < 1 or end < start or end - start + 1 > 100:
        raise ValueError("每次最多导入 100 首，请调整起止位置")
    pid = playlist_id(value)
    detail = get_json(f"https://music.163.com/api/v6/playlist/detail?id={pid}&n=100")
    if detail.get("code") != 200 or not detail.get("playlist"):
        raise ValueError(detail.get("message") or "网易云没有返回歌单")
    playlist = detail["playlist"]
    ids = [item.get("id") for item in playlist.get("trackIds", []) if item.get("id")]
    source_count = len(ids)
    ids = ids[start - 1:end]
    songs = []
    for start in range(0, len(ids), 300):
        payload = json.dumps([{"id": song_id} for song_id in ids[start:start + 300]], separators=(",", ":")).encode()
        result = get_json("https://music.163.com/api/v3/song/detail", b"c=" + urllib.parse.quote_from_bytes(payload).encode())
        if result.get("code") != 200:
            raise ValueError("歌曲详情请求失败，请稍后重试")
        songs.extend(result.get("songs", []))
    by_id = {str(song.get("id")): song for song in songs}
    items = []
    for index, song_id in enumerate(ids):
        position = start - 1 + index
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
    return {"playlist": {"id": pid, "name": playlist.get("name", "未命名歌单"), "count": playlist.get("trackCount", source_count)}, "items": items, "sourceCount": source_count, "rangeStart": start, "rangeEnd": min(end, source_count), "hasMore": end < source_count}

def search_netease(query, chart_type):
    if not isinstance(query, str) or not query.strip() or len(query) > 120:
        raise ValueError("请输入 1 至 120 个字符的搜索词")
    if chart_type not in ("songs", "albums"):
        raise ValueError("不支持的搜索类型")
    album_mode = chart_type == "albums"
    params = urllib.parse.urlencode({"s": query.strip(), "type": 10 if album_mode else 1, "limit": 18, "offset": 0})
    data = get_json("https://music.163.com/api/search/get?" + params)
    if data.get("code") != 200:
        raise ValueError("网易云搜索暂时不可用")
    found = data.get("result", {}).get("albums" if album_mode else "songs", [])
    details = {}
    if not album_mode and found:
        payload = json.dumps([{"id": item.get("id")} for item in found if item.get("id")], separators=(",", ":")).encode()
        detail_data = get_json("https://music.163.com/api/v3/song/detail", b"c=" + urllib.parse.quote_from_bytes(payload).encode())
        details = {str(item.get("id")): item for item in detail_data.get("songs", [])}
    results = []
    for item in found:
        detail = details.get(str(item.get("id")), item)
        artists = detail.get("ar") or item.get("artists") or ([item["artist"]] if item.get("artist") else [])
        album = item if album_mode else (detail.get("al") or item.get("album", {}))
        cover = album.get("picUrl") or album.get("blurPicUrl") or ""
        item_id = item.get("id")
        results.append({
            "id": f"netease:{chart_type}:{item_id}", "name": detail.get("name") or item.get("name", ""),
            "artist": " / ".join(artist.get("name", "") for artist in artists if artist.get("name")),
            "album": album.get("name", ""),
            "albumId": f"netease:album:{album['id']}" if album.get("id") else None,
            "cover": cover.replace("http:", "https:", 1), "source": "网易云音乐",
            "url": f"https://music.163.com/#/{'album' if album_mode else 'song'}?id={item_id}"
        })
    return {"results": results}

class Handler(SimpleHTTPRequestHandler):
    def do_GET(self):
        parsed = urllib.parse.urlsplit(self.path)
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
        path = urllib.parse.urlsplit(self.path).path
        if path not in ("/api/import", "/api/search"):
            self.send_error(404)
            return
        try:
            length = int(self.headers.get("Content-Length", 0))
            if not 0 < length <= 4096:
                raise ValueError("请求大小须在 1–4096 字节之间")
            body = json.loads(self.rfile.read(length) or b"{}")
            result = search_netease(body.get("query", ""), body.get("type")) if path == "/api/search" else fetch_playlist(body.get("url", ""), body.get("start", 1), body.get("end", 100))
            raw = json.dumps(result, ensure_ascii=False).encode()
            self.send_response(200)
        except Exception as error:
            raw = json.dumps({"error": str(error)}, ensure_ascii=False).encode()
            self.send_response(400)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(raw)))
        self.end_headers()
        self.wfile.write(raw)

if __name__ == "__main__":
    print(f"年度歌单运行于 http://127.0.0.1:{PORT}")
    ThreadingHTTPServer(("127.0.0.1", PORT), Handler).serve_forever()
