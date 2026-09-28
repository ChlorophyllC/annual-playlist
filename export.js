(() => {
  const button = document.getElementById('export-button');
  const status = document.getElementById('export-status');
  const downloads = document.getElementById('export-downloads');
  let downloadURL;

  // Freeze browser-measured geometry, not HTML. Safari does not reliably
  // rasterize foreignObject (positioned covers disappear and scaling is lost).
  function snapshot(poster) {
    const bounds = poster.getBoundingClientRect();
    const relative = element => {
      const r = element.getBoundingClientRect();
      return {x: r.left - bounds.left, y: r.top - bounds.top, width: r.width, height: r.height};
    };
    const rootStyle = getComputedStyle(poster);
    const boxes = [], images = [], texts = [];
    function box(element) {
      const style = getComputedStyle(element), rect = relative(element);
      boxes.push({...rect, color: style.backgroundColor, border: parseFloat(style.borderTopWidth) || 0, borderColor: style.borderTopColor});
    }
    const includeCovers = document.getElementById('export-art')?.value !== 'text';
    for (const frame of includeCovers ? poster.querySelectorAll('.poster-cover') : []) {
      box(frame);
      const image = frame.querySelector('img');
      if (image) images.push({...relative(frame), url: image.src, fit: getComputedStyle(image).objectFit});
    }
    const selectors = '.poster-kicker,.poster-title,.poster-subtitle span,.poster-song,.poster-artist,.poster-rank,.poster-footer span';
    for (const element of poster.querySelectorAll(selectors)) {
      if (!element.getClientRects().length) continue;
      const style = getComputedStyle(element);
      const matrix = new DOMMatrix(style.transform === 'none' ? undefined : style.transform);
      const angle = Math.atan2(matrix.b, matrix.a);
      const savedTransform = element.style.transform;
      // Measure line boxes without rotation, then apply the same rotation to
      // the whole text block on Canvas, including its border/background.
      element.style.transform = 'none';
      try {
        const rect = relative(element);
        const lines = [];
        const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
        while (walker.nextNode()) {
          const node = walker.currentNode;
          let offset = 0;
          for (const character of node.textContent) {
            const range = document.createRange();
            range.setStart(node, offset); offset += character.length; range.setEnd(node, offset);
            const r = range.getBoundingClientRect();
            if (!r.height || !r.width) continue;
            const previous = lines.at(-1);
            const x = r.left - bounds.left, y = r.top - bounds.top;
            if (previous && Math.abs(previous.y - y) < 1) previous.text += character;
            else lines.push({x, y, height: r.height, text: character});
          }
        }
        texts.push({...rect, angle, lines, font: `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`,
          fontSize: parseFloat(style.fontSize), spacing: style.letterSpacing === 'normal' ? '0px' : style.letterSpacing,
          color: style.color, background: style.backgroundColor, opacity: Number(style.opacity),
          border: parseFloat(style.borderTopWidth) || 0, borderColor: style.borderTopColor,
          ellipsis: style.textOverflow === 'ellipsis', uppercase: style.textTransform === 'uppercase'});
      } finally { element.style.transform = savedTransform; }
    }
    box(poster.querySelector('.poster-footer'));
    return {width: bounds.width, height: bounds.height, background: rootStyle.backgroundColor,
      texture: poster.classList.contains('poster--editorial'), boxes, images, texts};
  }

  function asDataURL(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsDataURL(blob);
    });
  }
  async function loadImage(src) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      const timer = setTimeout(() => { image.src = ''; reject(new Error('图片渲染超时，请重试')); }, 30000);
      image.onload = () => { clearTimeout(timer); resolve(image); };
      image.onerror = () => { clearTimeout(timer); reject(new Error('图片解码失败，请重试')); };
      image.src = src;
    });
  }
  async function rasterize(snapshot, longEdge, format, covers) {
    const {width, height} = snapshot;
    const scale = longEdge / Math.max(width, height);
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(width * scale); canvas.height = Math.round(height * scale);
    const context = canvas.getContext('2d');
    if (!context) throw new Error('浏览器无法创建图片画布');
    context.scale(canvas.width / width, canvas.height / height);
    context.fillStyle = snapshot.background; context.fillRect(0, 0, width, height);
    function drawBox(box, color = box.color) {
      context.fillStyle = color; context.fillRect(box.x, box.y, box.width, box.height);
      if (box.border) { context.fillStyle = box.borderColor; context.fillRect(box.x, box.y, box.width, box.border); }
    }
    for (const box of snapshot.boxes) drawBox(box);
    for (const cover of snapshot.images) {
      if (!covers.has(cover.url)) continue;
      const image = await loadImage(covers.get(cover.url));
      const factor = (cover.fit === 'contain' ? Math.min : Math.max)(cover.width / image.naturalWidth, cover.height / image.naturalHeight);
      const w = image.naturalWidth * factor, h = image.naturalHeight * factor;
      context.save(); context.beginPath(); context.rect(cover.x, cover.y, cover.width, cover.height); context.clip();
      context.drawImage(image, cover.x + (cover.width - w) / 2, cover.y + (cover.height - h) / 2, w, h); context.restore();
    }
    for (const text of snapshot.texts) {
      context.save(); context.globalAlpha = text.opacity;
      if (text.angle) {
        const cx = text.x + text.width / 2, cy = text.y + text.height / 2;
        context.translate(cx, cy); context.rotate(text.angle); context.translate(-cx, -cy);
      }
      drawBox(text, text.background);
      context.font = text.font; context.fillStyle = text.color;
      context.textBaseline = 'alphabetic'; context.letterSpacing = text.spacing;
      for (const line of text.lines) {
        let value = text.uppercase ? line.text.toUpperCase() : line.text;
        if (text.ellipsis && context.measureText(value).width > text.width) {
          const chars = Array.from(value);
          while (chars.length && context.measureText(chars.join('') + '…').width > text.width) chars.pop();
          value = chars.join('') + '…';
        }
        const metrics = context.measureText(value);
        const ascent = metrics.fontBoundingBoxAscent ?? text.fontSize * .8;
        const descent = metrics.fontBoundingBoxDescent ?? text.fontSize * .2;
        const baseline = line.y + (line.height - ascent - descent) / 2 + ascent;
        context.fillText(value, line.x, baseline);
      }
      context.restore();
    }
    if (snapshot.texture) {
      // Deterministic paper grain; Canvas-native so WebKit need not render an SVG filter.
      const grain = document.createElement('canvas'); grain.width = grain.height = 160;
      const g = grain.getContext('2d'), pixels = g.createImageData(160, 160);
      let seed = 73;
      for (let i = 0; i < pixels.data.length; i += 4) {
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
        pixels.data[i] = pixels.data[i + 1] = pixels.data[i + 2] = seed & 255; pixels.data[i + 3] = 10;
      }
      g.putImageData(pixels, 0, 0); context.fillStyle = context.createPattern(grain, 'repeat'); context.fillRect(0, 0, width, height);
    }
    return new Promise((resolve, reject) => canvas.toBlob(blob => {
      canvas.width = canvas.height = 1;
      if (blob) resolve(blob); else reject(new Error('图片编码失败，请降低分辨率重试'));
    }, `image/${format}`, 0.94));
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
      const {title, snapshots} = window.captureChartPages(all, snapshot);
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
      for (const page of snapshots) {
        status.textContent = `正在生成第 ${page.page} 页…`;
        const blob = await rasterize(page, longEdge, format, covers);
        files.push({name: `${safeTitle}-${String(page.page).padStart(2, '0')}.${format === 'jpeg' ? 'jpg' : 'png'}`, blob});
      }
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
