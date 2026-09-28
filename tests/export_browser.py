"""Optional regression check: pip install playwright; playwright install chromium webkit.
Run with the local server running: python tests/export_browser.py
"""
import base64
import io
import struct
import zipfile
import zlib
from playwright.sync_api import sync_playwright


def chunk(kind, body):
    return struct.pack('>I', len(body)) + kind + body + struct.pack('>I', zlib.crc32(kind + body))


# Distinct flat image makes missing-image and wrong-scale regressions measurable.
COVER = b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', 8, 8, 8, 2, 0, 0, 0)) + chunk(b'IDAT', zlib.compress((b'\0' + bytes([220, 30, 50]) * 8) * 8)) + chunk(b'IEND', b'')


def inspect(page, raw, positions, dimensions):
    result = page.evaluate('''async ({encoded, positions}) => {
      const image = new Image(); image.src = 'data:image/png;base64,' + encoded; await image.decode();
      const canvas = document.createElement('canvas'); canvas.width = image.naturalWidth; canvas.height = image.naturalHeight;
      const ctx = canvas.getContext('2d'); ctx.drawImage(image, 0, 0);
      return {size:[canvas.width,canvas.height], pixels:positions.map(p=>Array.from(ctx.getImageData(Math.round(p.x*canvas.width),Math.round(p.y*canvas.height),1,1).data))};
    }''', {'encoded': base64.b64encode(raw).decode(), 'positions': positions})
    assert result['size'] == dimensions, result['size']
    assert all(pixel[0] > 180 and pixel[1] < 70 and pixel[2] < 90 for pixel in result['pixels']), result


with sync_playwright() as p:
    for engine in [p.chromium, p.webkit]:
        browser = engine.launch()
        page = browser.new_page(viewport={'width': 1400, 'height': 1100}, accept_downloads=True)
        page.route('**/api/cover?*', lambda route: route.fulfill(content_type='image/png', body=COVER))
        page.route('https://*.music.126.net/**', lambda route: route.fulfill(content_type='image/png', body=COVER))
        page.goto('http://127.0.0.1:8000'); page.wait_for_selector('.poster-item')
        for theme, ratio, chart, fmt, dimensions in [
            ('gallery', 'portrait', 'songs', 'png', [1200, 1600]),
            ('editorial', 'wide', 'songs', 'jpeg', [1600, 900]),
            ('editorial', 'square', 'albums', 'png', [1600, 1600]),
        ]:
            page.locator(f'[data-theme="{theme}"]').click()
            page.select_option('#poster-ratio', ratio); page.select_option('#chart-type', chart); page.select_option('#export-format', fmt)
            positions = page.evaluate('''() => {
              const p=document.querySelector('.poster').getBoundingClientRect();
              return [...document.querySelectorAll('.poster-cover')].map(e=>{const r=e.getBoundingClientRect();return {x:(r.left+r.width/2-p.left)/p.width,y:(r.top+r.height/2-p.top)/p.height}});
            }''')
            with page.expect_download(timeout=30000) as download: page.locator('#export-button').click()
            inspect(page, open(download.value.path(), 'rb').read(), positions, dimensions)
        page.select_option('#export-scope', 'all'); page.locator('#page-next').click(); page.locator('#sort-toggle').click()
        with page.expect_download(timeout=30000) as download: page.locator('#export-button').click()
        with zipfile.ZipFile(download.value.path()) as archive:
            assert len(archive.namelist()) == 4 and archive.testzip() is None
            for index, name in enumerate(archive.namelist()):
                inspect(page, archive.read(name), positions[:3] if index == 3 else positions, [1600, 1600])
        assert '2 / 4' in page.locator('#page-info').inner_text()
        assert page.locator('#sort-toggle').get_attribute('aria-pressed') == 'true'
        print(f'PASS {engine.name}: all 12 cover pixels and scale, both themes, three ratios, PNG/JPG, songs/albums, four-page ZIP, preserved page and sort mode', flush=True)
        browser.close()
