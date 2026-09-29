(() => {
  const status = document.getElementById('project-status'), button = document.getElementById('project-export'), input = document.getElementById('project-import');
  let downloadUrl;
  const encoder = new TextEncoder(), decoder = new TextDecoder();
  const mimeExt = {'image/png':'png','image/jpeg':'jpg','image/webp':'webp'};
  function crc32(bytes) {
    let crc = -1;
    for (const byte of bytes) { crc ^= byte; for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1)); }
    return (crc ^ -1) >>> 0;
  }
  function u16(view, offset, value) { view.setUint16(offset, value, true); }
  function u32(view, offset, value) { view.setUint32(offset, value, true); }
  function zipStore(files) {
    const locals = [], central = []; let offset = 0;
    for (const [name, data] of files) {
      const nameBytes = encoder.encode(name), bytes = typeof data === 'string' ? encoder.encode(data) : data, checksum = crc32(bytes);
      const local = new Uint8Array(30 + nameBytes.length + bytes.length), lv = new DataView(local.buffer);
      u32(lv,0,0x04034b50);u16(lv,4,20);u16(lv,6,0x0800);u16(lv,8,0);u32(lv,14,checksum);u32(lv,18,bytes.length);u32(lv,22,bytes.length);u16(lv,26,nameBytes.length);local.set(nameBytes,30);local.set(bytes,30+nameBytes.length);locals.push(local);
      const dir = new Uint8Array(46 + nameBytes.length), dv = new DataView(dir.buffer);
      u32(dv,0,0x02014b50);u16(dv,4,20);u16(dv,6,20);u16(dv,8,0x0800);u16(dv,10,0);u32(dv,16,checksum);u32(dv,20,bytes.length);u32(dv,24,bytes.length);u16(dv,28,nameBytes.length);u32(dv,42,offset);dir.set(nameBytes,46);central.push(dir);offset += local.length;
    }
    const centralSize = central.reduce((total, part) => total + part.length, 0), end = new Uint8Array(22), ev = new DataView(end.buffer);
    u32(ev,0,0x06054b50);u16(ev,8,files.length);u16(ev,10,files.length);u32(ev,12,centralSize);u32(ev,16,offset);
    return new Blob([...locals,...central,end],{type:'application/zip'});
  }
  async function unzipStore(file) {
    if (file.size > 100 * 1024 * 1024) throw new Error('工程 ZIP 不能超过 100MB');
    const bytes = new Uint8Array(await file.arrayBuffer()), view = new DataView(bytes.buffer), files = new Map(); let offset = 0, total = 0;
    while (offset + 4 <= bytes.length && view.getUint32(offset,true) === 0x04034b50) {
      if (offset + 30 > bytes.length) throw new Error('ZIP 文件结构不完整');
      const flags=view.getUint16(offset+6,true), method=view.getUint16(offset+8,true), size=view.getUint32(offset+18,true), nameLength=view.getUint16(offset+26,true), extraLength=view.getUint16(offset+28,true);
      if (flags & 8 || method !== 0) throw new Error('工程 ZIP 压缩格式无效');
      const name=decoder.decode(bytes.subarray(offset+30,offset+30+nameLength));
      if (!name || name.startsWith('/') || name.includes('..') || name.includes('\\')) throw new Error('ZIP 内包含非法文件名');
      const start=offset+30+nameLength+extraLength, end=start+size;
      if (end > bytes.length) throw new Error('ZIP 文件内容不完整');
      total += size; if (total > 120*1024*1024 || files.size > 5000) throw new Error('工程资源总量超出限制');
      const content=bytes.slice(start,end);if(crc32(content)!==view.getUint32(offset+14,true))throw new Error(`文件校验失败：${name}`);
      files.set(name,content);offset=end;
    }
    if (!files.size) throw new Error('ZIP 中没有可读取的工程文件');
    return files;
  }
  function dataBytes(dataUrl) {
    const match=dataUrl.match(/^data:(image\/(?:png|jpeg|webp));base64,([\s\S]+)$/i);if(!match)throw new Error('只支持 PNG、JPG 或 WebP 上传图片');
    const binary=atob(match[2]),bytes=new Uint8Array(binary.length);for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);
    return {bytes,extension:mimeExt[match[1].toLowerCase()],mime:match[1].toLowerCase()};
  }
  function validate(payload) {
    if(payload.format!=='annual-playlist-project'||payload.version!==2||!payload.playlist?.playlist||!Array.isArray(payload.playlist.items)||payload.playlist.items.length>5000) throw new Error('不是当前版本的工程文件');
    const clean=structuredClone(payload);
    for(const [index,item] of clean.playlist.items.entries()) { if(!item||typeof item!=='object'||!['string','number'].includes(typeof item.id))throw new Error('作品记录不完整');item.position??=index;if(item.album?.cover&&!/^(https?:\/\/|data:image\/(png|jpeg|webp);base64,|assets\/)/i.test(item.album.cover))throw new Error('不支持的封面格式'); }
    const d=clean.design||{};if(!['gallery','editorial','spring','summer','autumn','winter'].includes(d.theme)||!['songs','albums'].includes(d.chartType)||!['portrait','square','wide'].includes(d.ratio))throw new Error('工程主题或比例无效');
    d.coverMode=['square','fill'].includes(d.coverMode)?d.coverMode:'square';d.art=d.art==='text'?'text':'covers';d.editorialBg=/^#[0-9a-f]{6}$/i.test(d.editorialBg)?d.editorialBg:'#ddf23b';d.editorialAccent=/^#[0-9a-f]{6}$/i.test(d.editorialAccent)?d.editorialAccent:'#da2578';d.textEdits=d.textEdits&&typeof d.textEdits==='object'?d.textEdits:{};d.orders=d.orders&&typeof d.orders==='object'?d.orders:{};for(const order of Object.values(d.orders))if(!Array.isArray(order))throw new Error('排序记录无效');
    return clean;
  }
  button.addEventListener('click',async()=>{
    if(button.disabled)return;button.disabled=true;
    try {
      const state=window.getProjectState();if(!state.playlist)throw new Error('请先新建或导入榜单');
      const payload={format:'annual-playlist-project',version:2,exportedAt:new Date().toISOString(),...state},files=[];let assetCount=0;
      const saveImage=(object,field,sourceField)=>{
        const value=object?.[field];if(typeof value!=='string')return;
        // Legacy browser caches for a URL are omitted: the stable original URL is enough.
        if(value.startsWith('data:image/')&&object[sourceField]?.startsWith('http')){object[field]=object[sourceField];return;}
        if(!value.startsWith('data:image/'))return;
        const {bytes,extension}=dataBytes(value),name=`assets/image-${String(++assetCount).padStart(4,'0')}.${extension}`;files.push([name,bytes]);object[field]=name;
      };
      for(const item of payload.playlist.items)saveImage(item.album,'cover','sourceCover');
      for(const cover of Object.values(payload.playlist.coverOverrides||{}))saveImage(cover,'data','source');
      payload.assetCount=assetCount;
      files.unshift(['project.json',JSON.stringify(payload)]);
      const blob=zipStore(files);if(downloadUrl)URL.revokeObjectURL(downloadUrl);downloadUrl=URL.createObjectURL(blob);
      const link=document.createElement('a');link.href=downloadUrl;link.download=`${(payload.playlist.playlist.name||'年度歌单').replace(/[<>:"/\\|?*]/g,'_')}.annual.zip`;link.click();
      status.textContent=assetCount?`工程 ZIP 已保存：歌单和设置在 project.json，${assetCount} 张自定义图片单独放在 assets/。在线封面保留链接，不重复打包。`:'工程 ZIP 已保存。在线封面只保留来源链接，没有重复打包图片。';
    }catch(error){status.textContent=`保存失败：${error.message}`;}finally{button.disabled=false;}
  });
  input.addEventListener('change',async()=>{
    const file=input.files?.[0];if(!file)return;
    try {
      if(file.name.toLowerCase().endsWith('.zip')) {
        const entries=await unzipStore(file),json=entries.get('project.json');if(!json)throw new Error('ZIP 缺少 project.json');
        const payload=JSON.parse(decoder.decode(json));
        const restoreImage=value=>{
          if(typeof value!=='string'||!value.startsWith('assets/'))return value;
          const bytes=entries.get(value);if(!bytes)throw new Error(`ZIP 缺少资源：${value}`);
          const ext=value.split('.').pop().toLowerCase(),mime=ext==='jpg'||ext==='jpeg'?'image/jpeg':ext==='webp'?'image/webp':ext==='png'?'image/png':'';if(!mime)throw new Error('资源图片格式无效');
          let binary='';for(let i=0;i<bytes.length;i+=0x8000)binary+=String.fromCharCode(...bytes.subarray(i,i+0x8000));return `data:${mime};base64,${btoa(binary)}`;
        };
        for(const item of payload.playlist?.items||[])if(item.album)item.album.cover=restoreImage(item.album.cover);
        for(const cover of Object.values(payload.playlist?.coverOverrides||{}))cover.data=restoreImage(cover.data);
        await window.loadProjectState(validate(payload));status.textContent=`工程已恢复，${payload.assetCount||0} 张自定义图片已载入；在线封面按原链接加载。`;
      } else throw new Error('请导入当前版本的工程 ZIP 文件');
    }catch(error){status.textContent=`导入失败：${error.message}`;}finally{input.value='';}
  });
})();
