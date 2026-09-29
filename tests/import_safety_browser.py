"""Regression checks for Worker validation, fresh imports and mobile controls."""
import json
from pathlib import Path
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
 b=p.chromium.launch(); page=b.new_page(viewport={'width':390,'height':844})
 page.goto('http://127.0.0.1:8000');page.wait_for_selector('.poster-item')
 assert page.locator('.control-card[open]').count()==0
 assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
 source=Path('workers/netease-importer.js').read_text().replace('export default ', 'const worker = ')
 result=page.evaluate('''async source => {
 const run = new Function('return (async()=>{' + source + `
 const realFetch = fetch; let calls = []; let nextIP = 0;
 globalThis.fetch = async (url, init) => {
   calls.push(String(url));
   if (String(url).includes('163cn.tv')) return new Response(null, {status:302, headers:{Location:'https://music.163.com/playlist?id=123'}});
   if (String(url).includes('/playlist/detail')) return Response.json({code:200,playlist:{name:'fresh',trackCount:150,trackIds:Array.from({length:150},(_,i)=>({id:i+1}))}});
   const ids=JSON.parse(new URLSearchParams(init.body).get('c'));
   if(ids.length!==100) throw Error('uncapped details request');
   return Response.json({code:200,songs:ids.map(({id})=>({id,name:'song'+id,al:{},ar:[]}))});
 };
 const req = (url, extra={}) => new Request('https://worker.test/api/import', {method:'POST',headers:{'Content-Type':'application/json','CF-Connecting-IP':String(++nextIP), ...extra},body:JSON.stringify({url})});
 try {
   let r=await worker.fetch(req('分享歌单: SOTY https://163cn.tv/bhr2Tkbq (@网易云音乐)')); let d=await r.json();
   if(r.status!==200 || d.items.length!==100 || !d.truncated) throw Error(JSON.stringify(d));
   let count=calls.length; r=await worker.fetch(req('http://127.0.0.1/playlist?id=123')); if(r.status!==400 || calls.length!==count) throw Error('SSRF guard');
   r=await worker.fetch({headers:new Headers({Origin:'https://evil.test'})});if(r.status!==403)throw Error('origin guard');
   r=await worker.fetch(req('x'.repeat(5000)));if(r.status!==413)throw Error('size guard');
   r=await worker.fetch(req('123'),{IMPORT_LIMITER:{limit:async()=>({success:false})}});if(r.status!==429)throw Error('rate guard');
   globalThis.fetch=async()=>new Response(null,{status:302,headers:{Location:'http://127.0.0.1/private'}});
   r=await worker.fetch(req('https://163cn.tv/evil'));if(r.status!==400)throw Error('redirect guard');
   return 'Worker safety checks passed';
 } finally {globalThis.fetch=realFetch;}
 })()`); return run();
 }''',source)
 print(result)
 data={'playlist':{'id':'refresh-test','name':'Updated','count':1},'items':[{'id':1,'position':0,'matched':True,'name':'New song','artists':[],'album':{}}],'sourceCount':1}
 page.route('**/api/import',lambda route:route.fulfill(json=data))
 page.evaluate("""localStorage.setItem('annual-playlist:design:v1', JSON.stringify({textEdits:{'refresh-test':{title:'Stale'}},orders:{'refresh-test':['stale']}}))""")
 page.reload();page.wait_for_selector('.poster-item');page.locator('#import').click()
 page.wait_for_function("document.querySelector('.poster-title').textContent === 'Updated'")
 page.evaluate("localStorage.setItem('annual-playlist:test-cache','stale')")
 page.locator('#clear').click();page.wait_for_load_state('load')
 page.wait_for_function("localStorage.getItem('annual-playlist:test-cache')===null")
 assert page.evaluate('ChartAssets.restore()') is None
 print('Mobile layout, fresh import and cache clear passed');b.close()
