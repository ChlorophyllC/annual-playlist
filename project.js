(() => {
  const status=document.getElementById('project-status'), button=document.getElementById('project-export'), input=document.getElementById('project-import');
  let url;
  function validate(payload) {
    if(payload.format!=='annual-playlist-project'||payload.version!==1||!payload.playlist?.playlist||!Array.isArray(payload.playlist.items)||payload.playlist.items.length>5000) throw new Error('不是支持的工程文件（版本 1）');
    const clean=structuredClone(payload);
    for(const [index,item] of clean.playlist.items.entries()) {
      if(!item||typeof item!=='object'||!['string','number'].includes(typeof item.id))throw new Error('作品记录不完整');
      item.position ??= index;
      if(item.album?.cover&&!/^(https?:\/\/|data:image\/(png|jpeg|webp);base64,)/i.test(item.album.cover))throw new Error('不支持的封面格式');
    }
    const d=clean.design||{};
    if(!['gallery','editorial'].includes(d.theme)||!['songs','albums'].includes(d.chartType)||!['portrait','square','wide'].includes(d.ratio))throw new Error('工程主题或比例无效');
    d.coverMode=['square','fill'].includes(d.coverMode)?d.coverMode:'square'; d.art=d.art==='text'?'text':'covers';
    d.editorialBg=/^#[0-9a-f]{6}$/i.test(d.editorialBg)?d.editorialBg:'#ddf23b';
    d.editorialAccent=/^#[0-9a-f]{6}$/i.test(d.editorialAccent)?d.editorialAccent:'#da2578';
    d.textEdits=d.textEdits&&typeof d.textEdits==='object'?d.textEdits:{};
    d.orders=d.orders&&typeof d.orders==='object'?d.orders:{};
    for(const order of Object.values(d.orders))if(!Array.isArray(order))throw new Error('排序记录无效');
    return clean;
  }
  button.addEventListener('click',async()=>{
    if(button.disabled)return; button.disabled=true;
    try {
      const state=window.getProjectState(); if(!state.playlist)throw new Error('请先新建或导入榜单');
      const payload={format:'annual-playlist-project',version:1,exportedAt:new Date().toISOString(),...state};
      const refs=[];
      for(const item of payload.playlist.items)if(item.album?.cover)refs.push({object:item.album,field:'cover',sourceField:'sourceCover'});
      for(const cover of Object.values(payload.playlist.coverOverrides||{}))if(cover.data)refs.push({object:cover,field:'data',sourceField:'source'});
      const urls=[...new Set(refs.map(r=>r.object[r.field]))];const images=new Map();const failed=[];let next=0,done=0;
      await Promise.all(Array.from({length:Math.min(4,urls.length)},async()=>{
        while(next<urls.length){const source=urls[next++];try{images.set(source,await ChartAssets.cover(source));}catch(_){images.set(source,'');failed.push(source);}status.textContent=`正在打包封面 ${++done}/${urls.length}…`;}
      }));
      for(const ref of refs){const source=ref.object[ref.field];if(source.startsWith('http'))ref.object[ref.sourceField]=source;ref.object[ref.field]=images.get(source)||'';}
      payload.missingCovers=failed;
      if(url)URL.revokeObjectURL(url);url=URL.createObjectURL(new Blob([JSON.stringify(payload)],{type:'application/json'}));
      const link=document.createElement('a');link.href=url;link.download=`${(payload.playlist.playlist.name||'年度歌单').replace(/[<>:"/\\|?*]/g,'_')}.annual.json`;link.click();
      status.textContent=failed.length?`工程已保存。${failed.length} 张封面暂未取得，保留空位和来源记录；其他封面已内嵌。`:'工程已保存，封面图片已内嵌，离线打开也保持一致。';
    }catch(error){status.textContent=`保存失败：${error.message}`;}finally{button.disabled=false;}
  });
  input.addEventListener('change',async()=>{
    const file=input.files?.[0];if(!file)return;
    try{if(file.size>200*1024*1024)throw new Error('工程文件不能超过 200MB');const payload=validate(JSON.parse(await file.text()));await window.loadProjectState(payload);status.textContent='工程已恢复，内嵌封面无需联网。';}
    catch(error){status.textContent=`导入失败：${error.message}`;}finally{input.value='';}
  });
})();
