(() => {
  const button = document.getElementById('export-button');
  const status = document.getElementById('export-status');
  const downloads = document.getElementById('export-downloads');
  let downloadURL;

  // Only cover URLs are needed ahead of capture, to prefetch art through
  // ChartAssets (covers may be cross-origin and need CORS-safe copies).
  function coverURLs(poster) {
    const includeCovers = document.getElementById('export-art')?.value !== 'text';
    const images = includeCovers ? [...poster.querySelectorAll('.poster-cover img')].map(image => ({url: image.src})) : [];
    return {images};
  }

  async function snapdomExport(poster, longEdge, format, covers) {
    const snap = window.snapdom || window.snapDOM;
    if (typeof snap !== 'function') throw new Error('snapdom 未加载');
    const images = [...poster.querySelectorAll('img')];
    const original = images.map(image => ({image, src: image.getAttribute('src'), crossOrigin: image.getAttribute('crossorigin')}));
    const originalTransform = poster.style.transform;
    const originalTransformOrigin = poster.style.transformOrigin;
    try {
      for (const image of images) {
        const source = image.currentSrc || image.src;
        if (covers.has(source)) { image.crossOrigin = 'anonymous'; image.src = covers.get(source); }
      }
      await Promise.all(images.map(image => image.decode?.().catch(() => {}) || Promise.resolve()));
      await document.fonts.ready;
      const bounds = poster.getBoundingClientRect();
      if (!bounds.width || !bounds.height) throw new Error('海报尺寸无效');
      // Keep the CSS layout at its preview size. Passing explicit output
      // dimensions makes snapdom rasterize the complete SVG at the requested
      // resolution, so cqw and fixed-pixel styles retain the same proportions.
      const rasterScale = longEdge / Math.max(bounds.width, bounds.height);
      const targetWidth = Math.max(1, Math.round(bounds.width * rasterScale));
      const targetHeight = Math.max(1, Math.round(bounds.height * rasterScale));
      // Scale the rendered element as a whole while capturing. This keeps
      // cqw and fixed-pixel declarations in the same proportion and makes
      // Safari's intermediate SVG raster use the final resolution.
      poster.style.transformOrigin = 'top left';
      poster.style.transform = `scale(${rasterScale})`;
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      const captureOptions = {
        scale: 1,
        dpr: 1,
        backgroundColor: getComputedStyle(poster).backgroundColor,
        embedFonts: true,
        embedImages: true
      };
      const result = await snap(poster, captureOptions);
      const canvas = result instanceof HTMLCanvasElement
        ? result
        : await result.toCanvas?.({width: targetWidth, height: targetHeight, dpr: 1});
      if (!(canvas instanceof HTMLCanvasElement)) throw new Error('snapdom 未返回画布');
      const mime = format === 'jpeg' ? 'image/jpeg' : 'image/png';
      const actualLongEdge = Math.max(canvas.width, canvas.height);
      if (actualLongEdge < longEdge * .95) throw new Error(`导出分辨率不足（${actualLongEdge}px，目标 ${longEdge}px）`);
      return await new Promise((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error('snapdom 图片编码失败')), mime, .94));
    } finally {
      for (const item of original) {
        if (item.src == null) item.image.removeAttribute('src'); else item.image.setAttribute('src', item.src);
        if (item.crossOrigin == null) item.image.removeAttribute('crossorigin'); else item.image.setAttribute('crossorigin', item.crossOrigin);
      }
      poster.style.transform = originalTransform;
      poster.style.transformOrigin = originalTransformOrigin;
    }
  }
  // ZIP STORE: the PNG/JPG payload is already compressed. One download avoids
  // browser restrictions on automatically downloading several files.
  function crc32(bytes) {
    let crc = 0xffffffff;
    for (const byte of bytes) {
      crc ^= byte;
      for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
    return (crc ^ 0xffffffff) >>> 0;
  }
  async function zip(files) {
    const parts = [], directory = []; let offset = 0, directorySize = 0;
    for (const file of files) {
      const name = new TextEncoder().encode(file.name), data = new Uint8Array(await file.blob.arrayBuffer());
      const crc = crc32(data);
      const header = new Uint8Array(30 + name.length), h = new DataView(header.buffer);
      h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x800, true);
      h.setUint16(12, 33, true); h.setUint32(14, crc, true); h.setUint32(18, data.length, true); h.setUint32(22, data.length, true); h.setUint16(26, name.length, true); header.set(name, 30);
      const central = new Uint8Array(46 + name.length), c = new DataView(central.buffer);
      c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x800, true); c.setUint16(14, 33, true);
      c.setUint32(16, crc, true); c.setUint32(20, data.length, true); c.setUint32(24, data.length, true); c.setUint16(28, name.length, true); c.setUint32(42, offset, true); central.set(name, 46);
      parts.push(header, data); directory.push(central); offset += header.length + data.length; directorySize += central.length;
    }
    const end = new Uint8Array(22), e = new DataView(end.buffer);
    e.setUint32(0, 0x06054b50, true); e.setUint16(8, files.length, true); e.setUint16(10, files.length, true); e.setUint32(12, directorySize, true); e.setUint32(16, offset, true);
    return new Blob([...parts, ...directory, end], {type: 'application/zip'});
  }

  button.addEventListener('click', async () => {
    if (button.disabled) return;
    button.disabled = true; downloads.replaceChildren();
    status.textContent = '正在准备海报…';
    try {
      const format = document.getElementById('export-format').value;
      const longEdge = Number(document.getElementById('export-quality').value);
      const all = document.getElementById('export-scope').value === 'all';
      await document.fonts.ready;
      const {title, snapshots} = window.captureChartPages(all, coverURLs);
      const urls = [...new Set(snapshots.flatMap(page => page.images.map(image => image.url)))];
      const covers = new Map(); let completed = 0;
      // Limit concurrency and fail explicitly rather than silently exporting missing art.
      let next = 0;
      const coverResults = await Promise.allSettled(Array.from({length: Math.min(4, urls.length)}, async () => {
        while (next < urls.length) {
          const url = urls[next++];
          try { covers.set(url, await ChartAssets.cover(url)); }
          catch (_) { /* Keep a visible empty cover frame and report it after export. */ }
          status.textContent = `正在准备封面 ${++completed} / ${urls.length}…`;
        }
      }));
      const failed = coverResults.find(result => result.status === 'rejected');
      if (failed) throw failed.reason;
      const safeTitle = (title || '年度歌单').replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').slice(0, 70);
      const files = [];
      const originalPage = window.getPosterPage();
      for (const page of snapshots) {
        status.textContent = `正在生成第 ${page.page} 页…`;
        if (all) {
          window.setPosterPage(page.page - 1);
          await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        }
        const poster = document.querySelector('#poster-mount .poster');
        if (!poster) throw new Error('未找到可导出的海报');
        const blob = await snapdomExport(poster, longEdge, format, covers);
        files.push({name: `${safeTitle}-${String(page.page).padStart(2, '0')}.${format === 'jpeg' ? 'jpg' : 'png'}`, blob});
      }
      window.setPosterPage(originalPage);
      const blob = all ? await zip(files) : files[0].blob;
      if (downloadURL) URL.revokeObjectURL(downloadURL);
      downloadURL = URL.createObjectURL(blob);
      const link = document.createElement('a'); link.href = downloadURL;
      link.download = all ? `${safeTitle}.zip` : files[0].name; link.textContent = '再次下载'; downloads.append(link); link.click();
      status.textContent = `已生成 ${files.length} 张图片，长边 ${longEdge} px。${urls.length > covers.size ? ` ${urls.length - covers.size} 张封面未取得，已保留空位。` : ''}`;
    } catch (error) {
      status.textContent = `导出失败：${error.message || '请重试'}`;
    } finally { button.disabled = false; }
  });
})();
