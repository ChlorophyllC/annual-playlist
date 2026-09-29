(() => {
  const $=id=>document.getElementById(id), status=$('manual-status');
  function jsonp(url) {
    return new Promise((resolve,reject)=>{
      const name='musicSearch'+crypto.randomUUID().replaceAll('-','');const script=document.createElement('script');
      const cleanup=()=>{clearTimeout(timer);delete window[name];script.remove();};
      const timer=setTimeout(()=>{cleanup();reject(new Error('搜索超时，请重试或自行填写'));},15000);
      window[name]=value=>{cleanup();resolve(value);};script.onerror=()=>{cleanup();reject(new Error('搜索服务暂时不可用，可自行填写'));};
      script.src=url+'&callback='+name;document.head.append(script);
    });
  }
  $('new-chart').addEventListener('click',async()=>{
    const existing=window.getProjectState();
    if(existing.playlist?.items.length&&!confirm('新建会替换当前草稿。已下载工程文件备份，继续新建？'))return;
    const title=$('new-title').value.trim()||'我的音乐榜单';
    await window.loadProjectState({playlist:{playlist:{id:'manual:'+crypto.randomUUID(),name:title,count:0},items:[],sourceCount:0},design:{...existing.design,chartType:$('new-type').value,title}});
    status.textContent='空白榜单已创建，搜索或自行填写作品即可开始。';
  });
  async function add(entry, image) {
    if(!window.getProjectState().playlist)throw new Error('请先新建榜单');
    if(image){entry.album.cover=image;entry.album.sourceCover=image;}
    await window.addChartItem(entry);
    status.textContent=image?'作品已加入并保存；在线封面使用来源链接加载。':'作品已加入并保存。';
  }
  $('search-form').addEventListener('submit',async event=>{
    event.preventDefault();const query=$('search-query').value.trim();if(!query)return;
    const type=$('chart-type').value, provider=$('search-provider').value;
    const searchButton=event.target.querySelector('button');searchButton.disabled=true;status.textContent='正在搜索…';$('search-results').replaceChildren();
    try{
      let entries;
      if(provider==='netease'){
        const r=await fetch(ChartAssets.api('api/search'),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({query,type})});
        let body;try{body=await r.json();}catch(_){throw new Error('网易云搜索服务返回了无效响应，请确认本地 Python 服务已重启，或线上 Worker 已重新部署。');}
        if(!r.ok)throw new Error(body.error||'网易云搜索失败');entries=Array.isArray(body.results)?body.results:[];
      }else{
        const response=await jsonp('https://itunes.apple.com/search?'+new URLSearchParams({term:query,entity:type==='albums'?'album':'song',limit:'18',country:'US'}));
        entries=response.results.map(item=>({id:'apple:'+(type==='albums'?item.collectionId:item.trackId),name:type==='albums'?item.collectionName:item.trackName,artist:item.artistName,album:item.collectionName,albumId:'apple:'+item.collectionId,cover:(item.artworkUrl100||'').replace('100x100','600x600'),url:item.collectionViewUrl||item.trackViewUrl,source:'Apple / iTunes'}));
      }
      status.textContent=entries.length?'选择正确版本，点击加入榜单。':'没有找到，可以换个关键词或自行填写。';
      entries.forEach(item=>{
        const card=document.createElement('article');card.className='search-item';const image=new Image();image.alt=item.name;image.referrerPolicy='no-referrer';if(item.cover)image.src=item.cover;
        const title=document.createElement('strong');title.textContent=item.name;const artist=document.createElement('span');artist.textContent=item.artist;
        const album=document.createElement('small');album.textContent=item.album||'';const button=document.createElement('button');button.textContent='加入榜单';
        button.addEventListener('click',async()=>{button.disabled=true;try{const uid=item.id||'manual:'+crypto.randomUUID();await add({id:uid,kind:type==='albums'?'album':'song',matched:true,name:item.name,artists:[{name:item.artist}],album:{id:item.albumId||uid,name:item.album||item.name,cover:'',artists:type==='albums'?[{name:item.artist}]:[]},source:item.source,url:item.url},item.cover);button.textContent='已加入';}catch(error){status.textContent=error.message;button.disabled=false;}});
        card.append(image,title,artist,album,button);$('search-results').append(card);
      });
    }catch(error){status.textContent=error.message;}finally{searchButton.disabled=false;}
  });
  $('manual-form').addEventListener('submit',async event=>{
    event.preventDefault();const name=$('manual-name').value.trim();if(!name)return;
    const type=$('chart-type').value,artist=$('manual-artist').value.trim(),album=$('manual-album').value.trim();
    const id='manual:'+crypto.randomUUID();const file=$('manual-cover').files?.[0];
    const button=event.target.querySelector('button');button.disabled=true;
    try{
      const cover=file?await ChartAssets.normalize(file):'';
      await window.addChartItem({id,kind:type==='albums'?'album':'song',matched:true,name,artists:artist?[{name:artist}]:[],album:{id:type==='albums'||album?id:null,name:type==='albums'?name:album,cover,artists:type==='albums'&&artist?[{name:artist}]:[]},source:'用户填写'});
      event.target.reset();status.textContent='已加入当前榜单并保存。';
    }catch(error){status.textContent=error.message;}finally{button.disabled=false;}
  });
  $('batch-import-button').addEventListener('click', async () => {
    const lines = $('batch-text').value.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
    if (!lines.length) { status.textContent = '请先粘贴歌单文本。'; return; }
    const button = $('batch-import-button'); button.disabled = true; const type = $('chart-type').value; let added = 0; const missing = [];
    for (const [index, line] of lines.entries()) {
      status.textContent = `正在匹配第 ${index + 1} / ${lines.length} 行…`;
      const parts = line.split(/\s+[-—|｜]\s+/);
      const query = parts.join(' ');
      try {
        const response = await jsonp('https://itunes.apple.com/search?' + new URLSearchParams({term: query, entity: type === 'albums' ? 'album' : 'song', limit: '1', country: 'US'}));
        const item = response.results?.[0];
        if (!item) { missing.push(line); continue; }
        const album = type === 'albums' ? item : {collectionId: item.collectionId, collectionName: item.collectionName, artworkUrl100: item.artworkUrl100};
        await add({id: `apple:${type}:${type === 'albums' ? item.collectionId : item.trackId}`, kind: type === 'albums' ? 'album' : 'song', matched: true, name: type === 'albums' ? item.collectionName : item.trackName, artists: item.artistName ? [{name: item.artistName}] : [], album: {id: album.collectionId ? `apple:${album.collectionId}` : null, name: album.collectionName || (type === 'albums' ? item.collectionName : ''), cover: '', artists: type === 'albums' && item.artistName ? [{name: item.artistName}] : []}, source: 'Apple / iTunes', url: item.collectionViewUrl || item.trackViewUrl}, (album.artworkUrl100 || '').replace('100x100', '600x600'));
        added++;
      } catch (_) { missing.push(line); }
    }
    status.textContent = `已加入 ${added} 行。${missing.length ? `未匹配 ${missing.length} 行，可单独搜索或手动填写。` : ''}`; button.disabled = false;
  });
})();
