"""Run with local server and Playwright Chromium/WebKit installed."""
import base64,json,struct,zlib,zipfile
from playwright.sync_api import sync_playwright

def chunk(t,d):return struct.pack('>I',len(d))+t+d+struct.pack('>I',zlib.crc32(t+d))
cover=b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR',struct.pack('>IIBBBBB',8,8,8,2,0,0,0))+chunk(b'IDAT',zlib.compress((b'\0'+bytes([210,20,80])*8)*8))+chunk(b'IEND',b'')
with sync_playwright() as p:
 for engine in [p.chromium,p.webkit]:
  b=engine.launch();page=b.new_page(viewport={'width':1400,'height':1100},accept_downloads=True)
  errors=[];page.on('pageerror',lambda e:errors.append(str(e)));page.on('dialog',lambda d:d.accept())
  page.route('**/api/cover?*',lambda r:r.fulfill(content_type='image/png',body=cover))
  page.route('https://*.music.126.net/**',lambda r:r.fulfill(content_type='image/png',body=cover))
  page.goto('http://127.0.0.1:8000');page.wait_for_selector('.poster-item')
  page.evaluate("document.querySelectorAll('.control-card').forEach(el => el.open = true)")
  page.locator('#export-art').select_option('text');assert page.locator('.poster-item').count()==24
  assert page.locator('.poster img').count()==0
  with page.expect_download() as d:page.locator('#export-button').click()
  raw=open(d.value.path(),'rb').read();assert struct.unpack('>II',raw[16:24])== (1200,1600)
  if engine.name=='chromium':open('/tmp/text-poster.png','wb').write(raw)
  page.locator('#new-title').fill('离线专辑');page.locator('#new-type').select_option('albums');page.locator('#new-chart').click();page.wait_for_function("document.querySelectorAll('.poster-item').length===0")
  page.locator('summary').filter(has_text='找不到？自己填写').click();page.locator('#manual-name').fill('独立专辑');page.locator('#manual-artist').fill('艺术家');page.locator('#manual-cover').set_input_files({'name':'cover.png','mimeType':'image/png','buffer':cover});page.locator('#manual-form button').click();page.wait_for_selector('.poster-item')
  assert page.locator('.poster-song').first.inner_text()=='独立专辑'
  page.locator('[data-theme="editorial"]').click();page.locator('#editorial-palette').select_option('coral')
  assert page.evaluate("getComputedStyle(document.querySelector('.poster')).backgroundColor")=='rgb(255, 96, 77)'
  page.locator('#export-art').select_option('covers')
  page.locator('.cover-file').first.set_input_files({'name':'replacement.png','mimeType':'image/png','buffer':cover})
  page.wait_for_function("Object.keys(window.getProjectState().playlist.coverOverrides||{}).length===1")
  with page.expect_download() as d:page.locator('#project-export').click()
  project=json.load(open(d.value.path()));assert project['playlist']['coverOverrides'];assert list(project['playlist']['coverOverrides'].values())[0]['data'].startswith('data:image/')
  page.reload();page.wait_for_selector('.poster-item');assert page.locator('.poster-song').first.inner_text()=='独立专辑'
  page.evaluate("document.querySelectorAll('.control-card').forEach(el => el.open = true)")
  # Reopen the saved project in a fresh tab after blocking all image/API access.
  fresh=b.new_page(accept_downloads=True);fresh.route('**/api/**',lambda r:r.abort());fresh.route('https://**',lambda r:r.abort());fresh.goto('http://127.0.0.1:8000');fresh.wait_for_selector('.poster-item')
  fresh.evaluate("document.querySelectorAll('.control-card').forEach(el => el.open = true)")
  fresh.locator('#project-import').set_input_files({'name':'test.annual.json','mimeType':'application/json','buffer':json.dumps(project).encode()});fresh.wait_for_function("document.querySelector('.poster-song').textContent==='独立专辑'")
  assert fresh.locator('.poster-cover img').get_attribute('src').startswith('data:image/')
  with fresh.expect_download() as out:fresh.locator('#export-button').click()
  assert len(open(out.value.path(),'rb').read())>1000
  with fresh.expect_download() as out:fresh.locator('#text-export-button').click()
  assert '独立专辑' in open(out.value.path(),encoding='utf8').read()
  # Missing cover is permitted in project and image exports.
  fresh.evaluate("window.addChartItem({id:'missing',kind:'album',matched:true,name:'无封面',artists:[],album:{id:'missing',name:'无封面',cover:'https://p1.music.126.net/missing.jpg'}})")
  fresh.wait_for_function("document.querySelectorAll('.poster-item').length===2")
  with fresh.expect_download() as out:fresh.locator('#export-button').click()
  assert '未取得' in fresh.locator('#export-status').inner_text()
  with fresh.expect_download() as out:fresh.locator('#project-export').click()
  missing=json.load(open(out.value.path()));assert len(missing['missingCovers'])==1
  assert not errors,errors
  print('PASS',engine.name,'compact image, manual album, upload override, palette, IndexedDB reload, offline project, TXT, incomplete cover export',flush=True)
  b.close()
