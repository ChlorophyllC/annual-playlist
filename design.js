(() => {
  const key = 'annual-playlist:design:v1';
  const themes = window.PLAYLIST_THEMES;
  const formats = {portrait: {columns: 3, rows: 4}, square: {columns: 4, rows: 3}, wide: {columns: 6, rows: 2}};
  let state = {theme: 'gallery', chartType: 'songs', ratio: 'portrait', coverMode: 'square', title: 'SOTY 2026', signature: 'MY YEAR IN MUSIC', labels: true, editorialPalette: 'acid', editorialBg: '#ddf23b', editorialAccent: '#da2578', art: 'covers'};
  try { Object.assign(state, JSON.parse(localStorage.getItem(key)) || {}); } catch (_) {}
  if (!themes.some(t => t.id === state.theme)) state.theme = themes[0].id;
  if (!formats[state.ratio]) state.ratio = 'portrait';
  if (!['square', 'fill'].includes(state.coverMode)) state.coverMode = 'square';
  if (!['songs', 'albums'].includes(state.chartType)) state.chartType = 'songs';
  if (!state.textEdits || typeof state.textEdits !== 'object') state.textEdits = {};
  let sorting = false, selected = new Set(), currentItems = [];
  if (!state.orders) state.orders = {};
  let data = null, sample = null, page = 0, imported = false;
  const $ = id => document.getElementById(id);
  const text = (tag, className, content) => { const node = document.createElement(tag); node.className = className; node.textContent = content; return node; };
  function save() { try { localStorage.setItem(key, JSON.stringify(state)); } catch (_) { document.getElementById('project-status').textContent = '本地保存失败，请下载工程文件备份'; } }
  function editKey() { return String(data.playlist.id) + (state.chartType === 'albums' ? ':albums' : ''); }
  function edits() {
    const id = editKey();
    return state.textEdits[id] || (state.textEdits[id] = {});
  }
  function defaultTitle() { return state.chartType === 'albums' ? `${data.playlist.name} · 专辑榜` : data.playlist.name; }
  function editable(tag, className, fallback, field, label, onChange) {
    const node = text(tag, className, edits()[field] ?? fallback);
    node.contentEditable = sorting ? 'false' : 'plaintext-only';
    node.setAttribute('role', 'textbox');
    node.setAttribute('aria-label', `编辑${label}`);
    node.setAttribute('aria-multiline', 'false');
    node.dataset.placeholder = label;
    node.spellcheck = false;
    let original;
    const commit = () => {
      const value = node.textContent.replace(/[\r\n]+/g, ' ');
      edits()[field] = value;
      if (onChange) onChange(value);
      save();
    };
    node.addEventListener('focus', () => { original = node.textContent; });
    node.addEventListener('input', commit);
    node.addEventListener('blur', () => { node.textContent = node.textContent.replace(/[\r\n]+/g, ' '); commit(); });
    node.addEventListener('keydown', event => {
      if (event.isComposing) return;
      if (event.key === 'Enter') { event.preventDefault(); node.blur(); }
      if (event.key === 'Escape') { event.preventDefault(); node.textContent = original; node.blur(); }
    });
    return node;
  }
  function chartData() {
    const chart = state.chartType === 'albums' ? buildAlbumChart(data.items) : {items: data.items.filter(item => item.kind !== 'album'), unresolved: []};
    const overrides = data.coverOverrides || {};
    chart.items = chart.items.map(item => {
      const cover = overrides[chartItemKey(item, state.chartType)];
      return cover ? {...item, album: {...item.album, cover: cover.data || '', sourceCover: cover.source || ''}} : item;
    });
    return chart;
  }
  function render() {
    if (!data) return;
    const albumMode = state.chartType === 'albums';
    const chart = chartData();
    const items = applyChartOrder(chart.items, state.orders[editKey()] || [], state.chartType);
    currentItems = items;
    document.body.classList.toggle('sorting-mode', sorting);
    $('sort-toggle').textContent = sorting ? '完成排序' : '开始排序';
    $('sort-toggle').setAttribute('aria-pressed', String(sorting));
    $('list-sort-toggle').textContent = sorting ? '完成排序' : '开始排序';
    $('list-sort-toggle').setAttribute('aria-pressed', String(sorting));
    $('sort-info').textContent = sorting ? '勾选可多选；拖动卡片或把手，按标线放下。修改即时保存。' : '普通模式 · 可编辑和复制文字';
    $('album-summary').hidden = !albumMode;
    $('album-summary').textContent = `从 ${data.items.length} 首歌曲提取 ${items.length} 张专辑，按首次出现排序。${chart.unresolved.length ? `${chart.unresolved.length} 首缺少专辑信息，未纳入专辑榜；可在下方导入列表查看。` : ''}${items.some(item => item.artistSource === 'tracks') ? '部分音乐人来自已导入歌曲，可能不是完整专辑署名，可点击修改。' : ''}`;
    $('poster-title').value = edits().title ?? defaultTitle();
    $('poster-signature').value = edits().signature ?? 'MY YEAR IN MUSIC';
    const theme = themes.find(t => t.id === state.theme);
    const format = state.art === 'text' ? {columns: state.ratio === 'wide' ? 3 : 2, rows: 12} : formats[state.ratio], count = format.columns * format.rows;
    const pages = Math.max(1, Math.ceil(items.length / count));
    page = Math.max(0, Math.min(page, pages - 1));
    document.querySelectorAll('.theme-choice').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.theme === state.theme)));
    const poster = text('article', `poster poster--${theme.id} ratio--${state.ratio} covers--${state.coverMode}${state.labels || state.art === 'text' ? '' : ' hide-labels'}${state.art === 'text' ? ' poster-text-only' : ''}`, '');
    if (state.theme === 'editorial') { poster.style.setProperty('--paper', state.editorialBg); poster.style.setProperty('--accent', state.editorialAccent); }
    $('editorial-colors').hidden = state.theme !== 'editorial';
    poster.style.setProperty('--columns', format.columns);
    poster.style.setProperty('--rows', format.rows);
    const head = text('div', 'poster-head', '');
    const title = editable('h2', 'poster-title', defaultTitle(), 'title', '榜单标题', value => {
      state.title = value; $('poster-title').value = value;
      title.style.fontSize = value.length > 22 ? (state.ratio === 'wide' ? '3cqw' : '4.5cqw') : '';
    });
    if (title.textContent.length > 22) title.style.fontSize = state.ratio === 'wide' ? '3cqw' : '4.5cqw';
    const subtitle = text('div', 'poster-subtitle', '');
    subtitle.append(editable('span', '', `${items.length} ${albumMode ? 'ALBUMS' : 'TRACKS'}`, 'count', '作品数量文案'), editable('span', 'poster-separator', ' / ', 'separator', '分隔文字'), editable('span', '', 'MY YEAR IN MUSIC', 'signature', '署名', value => { state.signature = value; $('poster-signature').value = value; }));
    head.append(editable('div', 'poster-kicker', theme.kicker, 'kicker', '页眉'), title, subtitle);
    const grid = text('div', 'poster-grid', '');
    items.slice(page * count, (page + 1) * count).forEach((item, index) => {
      const rank = page * count + index + 1;
      const card = text('figure', 'poster-item', '');
      const slot = text('div', 'poster-cover-slot', '');
      const frame = text('div', 'poster-cover', '');
      frame.append(text('span', 'cover-placeholder', '♪'));
      const url = item.album?.cover;
      if (state.art !== 'text' && url && (/^https?:\/\//.test(url) || /^data:image\//.test(url))) {
        const image = new Image(); image.alt = item.album?.name || item.name || '专辑封面'; image.referrerPolicy = 'no-referrer';
        image.addEventListener('error', () => { image.style.visibility = 'hidden'; }); image.src = url; frame.append(image);
      }
      const itemKey = albumMode ? `album:${item.id}` : `item:${item.id}:${item.position ?? rank}`;
      frame.append(editable('span', 'poster-rank', String(rank).padStart(2, '0'), `${itemKey}:rank`, '排名文案'));
      const caption = text('figcaption', 'poster-caption', '');
      const name = item.name || `未匹配歌曲 ${item.id}`;
      caption.append(editable('div', 'poster-song', name, `${itemKey}:name`, albumMode ? '专辑名' : '歌名'), editable('div', 'poster-artist', (item.artists || []).map(a => a.name).join(' / ') || '待补全', `${itemKey}:artist`, '音乐人'));
      slot.append(frame);
      card.title = `${rank}. ${name}${albumMode ? ` · 歌单内 ${item.tracks.length} 首：${item.tracks.map(track => track.name).join(' / ')}` : ''}`; card.append(slot, caption); decorateSortCard(card, item, rank); grid.append(card);
    });
    const footer = text('div', 'poster-footer', '');
    footer.append(editable('span', '', 'SELECTED WITH LOVE', 'footer', '页脚'), editable('span', '', `${String(page + 1).padStart(2, '0')} / ${String(pages).padStart(2, '0')}`, `page:${page}`, '当前页码文案'));
    poster.append(head, grid, footer); $('poster-mount').replaceChildren(poster);
    $('page-info').textContent = items.length ? `第 ${page + 1} / ${pages} 页 · 每页最多 ${count} ${albumMode ? '张' : '首'}` : '暂无可展示的作品';
    $('page-prev').disabled = page === 0; $('page-next').disabled = page === pages - 1;
    renderList(items, albumMode);
    $('preview-source').textContent = `${imported ? '你的歌单' : '示例歌单'} / ${data.playlist.name}`;
  }
  function updateSelection(value) {
    selected = value;
    document.querySelectorAll('[data-sort-key]').forEach(card => {
      const checked = selected.has(card.dataset.sortKey);
      card.classList.toggle('sort-selected', checked);
      const checkbox = card.querySelector('.sort-check');
      if (checkbox) checkbox.checked = checked;
    });
  }
  function decorateSortCard(card, item, rank) {
    if (!sorting) return;
    const itemKey = chartItemKey(item, state.chartType);
    card.dataset.sortKey = itemKey;
    card.classList.toggle('sort-selected', selected.has(itemKey));
    const tools = text('div', 'card-sort-tools', '');
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox'; checkbox.className = 'sort-check'; checkbox.checked = selected.has(itemKey);
    checkbox.setAttribute('aria-label', `选择第 ${rank} 项 ${item.name || item.id}`);
    checkbox.addEventListener('change', () => {
      const next = new Set(selected);
      if (checkbox.checked) next.add(itemKey); else next.delete(itemKey);
      updateSelection(next);
    });
    const handle = text('span', 'drag-handle', '⠿'); handle.title = '拖动排序';
    tools.append(checkbox, handle); card.append(tools);
  }
  function renderList(items, albumMode) {
    $('result').hidden = false;
    $('playlist-name').textContent = `${data.playlist.name} · ${albumMode ? '专辑榜' : '歌曲榜'}`;
    $('summary').textContent = `原始歌单 ${data.playlist.count} 首 · 当前 ${items.length} ${albumMode ? '张专辑' : '首歌曲'} · 与预览同步`;
    const cards = items.map((item, index) => {
      const card = text('article', 'song', '');
      card.append(text('span', 'index', String(index + 1).padStart(2, '0')));
      const image = new Image(); image.className = 'cover'; image.alt = '专辑封面'; image.referrerPolicy = 'no-referrer'; image.draggable = false;
      if (item.album?.cover) image.src = item.album.cover;
      image.addEventListener('error', () => { image.removeAttribute('src'); }, {once: true});
      const info = text('div', 'song-info', '');
      const field = albumMode ? `album:${item.id}` : `item:${item.id}:${item.position ?? index + 1}`;
      info.append(text('div', 'song-name', edits()[`${field}:name`] ?? item.name ?? `未匹配歌曲 ${item.id}`), text('div', 'artist', edits()[`${field}:artist`] ?? (item.artists || []).map(a => a.name).join(' / ')));
      info.append(text('div', 'album', albumMode ? `歌单内 ${item.tracks.length} 首歌曲` : item.album?.name || '专辑信息待补全'));
      const coverTools = text('div', 'cover-tools', '');
      const file = document.createElement('input'); file.type = 'file'; file.accept = 'image/*'; file.className = 'cover-file'; file.id = `cover-file-${index}`;
      const upload = text('label', 'cover-action', '上传封面'); upload.htmlFor = file.id;
      const urlInput = document.createElement('input'); urlInput.className = 'cover-url'; urlInput.placeholder = 'Last.fm / 图片 URL'; urlInput.value = item.album?.sourceCover || (item.album?.cover?.startsWith('http') ? item.album.cover : '');
      const applyUrl = text('button', 'cover-action', '使用 URL'); applyUrl.type = 'button';
      const setCover = async (cover, source = '') => {
        data.coverOverrides ||= {};
        data.coverOverrides[chartItemKey(item, state.chartType)] = {data: cover, source};
        await window.updateImportedData(data);
      };
      file.addEventListener('change', async () => {
        const selectedFile = file.files?.[0]; if (!selectedFile) return;
        try { await setCover(await ChartAssets.normalize(selectedFile)); }
        catch (error) { showStatus(error.message, true); }
      });
      applyUrl.addEventListener('click', async () => {
        const value = urlInput.value.trim(); applyUrl.disabled = true;
        try { await setCover(value ? await ChartAssets.cover(value) : '', value); showStatus('封面已保存到此设备'); }
        catch (error) { showStatus(error.message + '；原封面保持不变。', true); }
        finally { applyUrl.disabled = false; }
      });
      coverTools.append(file, upload, urlInput, applyUrl);
      card.append(image, info, coverTools); decorateSortCard(card, item, index + 1); return card;
    });
    $('songs').replaceChildren(...cards);
    // Preserve access to tracks that cannot be assigned to an album.
    if (albumMode) {
      const missing = buildAlbumChart(data.items).unresolved;
      if (missing.length) $('songs').append(text('p', 'hint', `未纳入：${missing.map(item => item.name || item.id).join('、')}`));
    }
  }
  for (const id of ['sort-toggle', 'list-sort-toggle']) $(id).addEventListener('click', () => { sorting = !sorting; selected.clear(); render(); });
  installChartDrag({
    active: () => sorting,
    selection: () => selected,
    select: updateSelection,
    move: (target, after) => {
      const order = currentItems.map(item => chartItemKey(item, state.chartType));
      state.orders[editKey()] = moveChartSelection(order, selected, target, after);
      save(); render();
    }
  });
  themes.forEach(theme => {
    const button = text('button', `theme-choice theme-choice--${theme.id}`, '');
    button.type = 'button'; button.dataset.theme = theme.id;
    button.append(text('span', 'theme-swatch', theme.badge), text('strong', '', theme.name), text('small', '', theme.caption));
    button.addEventListener('click', () => { state.theme = theme.id; save(); render(); });
    $('theme-options').append(button);
  });
  [['chart-type', 'chartType'], ['poster-title', 'title'], ['poster-signature', 'signature'], ['poster-ratio', 'ratio'], ['poster-cover-mode', 'coverMode'], ['poster-labels', 'labels'], ['export-art', 'art'], ['editorial-palette', 'editorialPalette'], ['editorial-bg', 'editorialBg'], ['editorial-accent', 'editorialAccent']].forEach(([id, property]) => {
    const control = $(id), checkbox = control.type === 'checkbox';
    control[checkbox ? 'checked' : 'value'] = state[property];
    control.addEventListener('input', () => { state[property] = control[checkbox ? 'checked' : 'value']; const palettes = {acid:['#ddf23b','#da2578'],coral:['#ff604d','#7ee5ff'],violet:['#7e4be8','#f4ea3a'],mint:['#9be7c4','#a62662']};
      if (property === 'editorialPalette' && palettes[state.editorialPalette]) { [state.editorialBg, state.editorialAccent] = palettes[state.editorialPalette]; $('editorial-bg').value = state.editorialBg; $('editorial-accent').value = state.editorialAccent; }
      if (['editorialBg','editorialAccent'].includes(property)) { state.editorialPalette = 'custom'; $('editorial-palette').value = 'custom'; }
      if (property === 'chartType' || property === 'art') { page = 0; selected.clear(); } if (data && ['title', 'signature'].includes(property)) edits()[property] = state[property]; save(); render(); });
  });
  $('page-prev').addEventListener('click', () => { page--; render(); });
  $('page-next').addEventListener('click', () => { page++; render(); });
  window.captureChartPages = (all, capture) => {
    if (!data || !currentItems.length) throw new Error('请先导入可展示的作品');
    document.activeElement?.blur();
    const originalPage = page;
    const format = state.art === 'text' ? {columns: state.ratio === 'wide' ? 3 : 2, rows: 12} : formats[state.ratio];
    const pageCount = Math.ceil(currentItems.length / (format.columns * format.rows));
    const snapshots = [];
    const title = edits().title ?? defaultTitle();
    try {
      for (const number of all ? Array.from({length: pageCount}, (_, i) => i) : [page]) {
        page = number; render();
        snapshots.push({page: number + 1, ...capture($('poster-mount').firstElementChild)});
      }
    } finally { page = originalPage; render(); }
    return {title, snapshots};
  };
  $('reset-poster-text').addEventListener('click', () => {
    if (!data) return;
    delete state.textEdits[editKey()];
    state.title = data.playlist.name; state.signature = 'MY YEAR IN MUSIC';
    $('poster-title').value = state.title; $('poster-signature').value = state.signature;
    save(); render();
  });
  window.addEventListener('playlist-refresh', event => {
    for (const id of [String(event.detail), `${event.detail}:albums`]) { delete state.orders[id]; delete state.textEdits[id]; }
    save();
  });
  window.addEventListener('playlist-loaded', event => { data = event.detail; if (data.preferredType) { state.chartType = data.preferredType; $('chart-type').value = state.chartType; } imported = true; page = 0; selected.clear(); if (state.playlistId !== data.playlist.id) { state.title = data.playlist.name; state.playlistId = data.playlist.id; $('poster-title').value = state.title; save(); } render(); });
  window.addEventListener('playlist-updated', event => { if (data?.playlist.id === event.detail.playlist.id) { data = event.detail; render(); } });
  window.addEventListener('playlist-cleared', () => { imported = false; data = sample; page = 0; selected.clear(); render(); });
  fetch('sample-playlist.json').then(response => { if (!response.ok) throw new Error('sample'); return response.json(); }).then(value => { sample = value; if (!imported) { data = sample; render(); } }).catch(() => { if (!imported) $('preview-source').textContent = '请导入歌单以开始预览'; });
  window.getProjectState = () => { document.activeElement?.blur(); return {playlist: structuredClone(data), design: structuredClone(state)}; };
  window.loadProjectState = async project => {
    state = {...state, ...project.design};
    for (const [id, property] of [['chart-type','chartType'],['poster-title','title'],['poster-signature','signature'],['poster-ratio','ratio'],['poster-cover-mode','coverMode'],['poster-labels','labels'],['export-art','art'],['editorial-palette','editorialPalette'],['editorial-bg','editorialBg'],['editorial-accent','editorialAccent']]) {
      const control = $(id); control[control.type === 'checkbox' ? 'checked' : 'value'] = state[property];
    }
    save(); await window.updateImportedData(project.playlist, true);
  };
  window.addChartItem = async entry => {
    data.items.push({...entry, position: data.items.length}); data.sourceCount = data.items.length; data.playlist.count = data.items.length;
    await window.updateImportedData(data);
  };
  if (window.EyeDropper) {
    $('pick-color').hidden = false;
    $('pick-color').addEventListener('click', async () => { try { const result = await new EyeDropper().open(); $('editorial-accent').value = result.sRGBHex; $('editorial-accent').dispatchEvent(new Event('input')); } catch (_) {} });
  }
  window.getCurrentChartSnapshot = () => {
    if (!data) return null;
    const albumMode = state.chartType === 'albums';
    const chart = chartData();
    const items = applyChartOrder(chart.items, state.orders[editKey()] || [], state.chartType);
    return {title: edits().title ?? defaultTitle(), type: state.chartType, items: items.map((item, index) => {
      const itemKey = albumMode ? `album:${item.id}` : `item:${item.id}:${item.position ?? index + 1}`;
      return {rank: index + 1, name: edits()[`${itemKey}:name`] ?? item.name ?? `未匹配歌曲 ${item.id}`, artists: edits()[`${itemKey}:artist`] ?? (item.artists || []).map(a => a.name).join(' / '), album: item.album?.name || '', sourceId: item.id};
    }), unresolved: chart.unresolved};
  };
})();
