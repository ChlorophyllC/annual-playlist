(() => {
  const key = 'annual-playlist:design:v1';
  const themes = window.PLAYLIST_THEMES;
  const formats = {portrait: {columns: 3, rows: 4}, square: {columns: 4, rows: 3}, wide: {columns: 6, rows: 2}};
  let state = {theme: 'gallery', chartType: 'songs', ratio: 'portrait', coverMode: 'square', title: 'SOTY 2026', signature: 'MY YEAR IN MUSIC', labels: true, editorialPalette: 'acid', editorialBg: '#ddf23b', editorialAccent: '#da2578', art: 'covers', ratingEnabled: false, ratingMode: 'stars', ratingLevels: '💣, C, B, A, A+', ratings: {}, filters: []};
  try { Object.assign(state, JSON.parse(localStorage.getItem(key)) || {}); } catch (_) {}
  if (!Array.isArray(state.filters)) state.filters = [];
  if (state.theme === 'spring' || state.theme === 'summer' || state.theme === 'autumn' || state.theme === 'winter') { state.season = state.theme; state.theme = 'seasonal'; }
  if (!themes.some(t => t.id === state.theme)) state.theme = themes[0].id;
  if (!['spring', 'summer', 'autumn', 'winter'].includes(state.season)) state.season = 'spring';
  if (!formats[state.ratio]) state.ratio = 'portrait';
  if (!['square', 'fill'].includes(state.coverMode)) state.coverMode = 'square';
  if (!['songs', 'albums'].includes(state.chartType)) state.chartType = 'songs';
  if (!state.textEdits || typeof state.textEdits !== 'object') state.textEdits = {};
  let sorting = false, selected = new Set(), currentItems = [];
  if (!state.orders) state.orders = {};
  if (!state.ratings || typeof state.ratings !== 'object') state.ratings = {};
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
  function ratingKey(item, albumMode) { return `${albumMode ? 'albums' : 'songs'}:${chartItemKey(item, albumMode ? 'albums' : 'songs')}`; }
  function rating(item, albumMode) { return state.ratings[ratingKey(item, albumMode)]; }
  function levels() { return state.ratingLevels.split(',').map(value => value.trim()).filter(Boolean).slice(0, 20); }
  function setRating(item, albumMode, value) { const key = ratingKey(item, albumMode); if (value === '' || value == null) delete state.ratings[key]; else state.ratings[key] = value; save(); render(); }
  function paintStars(container, value) {
    container.replaceChildren();
    const score = Number(value || 0);
    for (let index = 1; index <= 5; index++) {
      const star = text('span', 'rating-star', '');
      const shape = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      shape.setAttribute('viewBox', '0 0 24 24'); shape.setAttribute('aria-hidden', 'true');
      const base = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      base.setAttribute('d', 'm12 2 3.1 6.3 7 .0-5.1 4.9 1.2 7-6.2-3.3-6.2 3.3 1.2-7L2 8.3l7-.0z');
      const fill = base.cloneNode(); fill.classList.add('rating-star-fill');
      // Set the crop inline, not just via .is-full/.is-half class rules: SnapDOM
      // does not reliably capture a class-selector clip-path on an SVG child.
      const fraction = score >= index ? 1 : score >= index - .5 ? .5 : 0;
      fill.style.clipPath = `inset(0 ${(1 - fraction) * 100}% 0 0)`;
      shape.append(base, fill); star.append(shape);
      if (fraction === 1) star.classList.add('is-full');
      else if (fraction === .5) star.classList.add('is-half');
      container.append(star);
    }
  }
  function scaleRatingBadges(poster) {
    const width = poster.getBoundingClientRect().width;
    if (width) poster.style.setProperty('--rating-unit', `${width * 0.0135}px`);
  }
  const ratingResizeObserver = new ResizeObserver(() => {
    const poster = $('poster-mount').firstElementChild;
    if (poster) scaleRatingBadges(poster);
  });
  ratingResizeObserver.observe($('poster-mount'));
  function ratingNode(item, albumMode, compact = false) {
    const value = rating(item, albumMode);
    if (!state.ratingEnabled || value == null || value === '') return null;
    const node = text('span', `poster-rating${compact ? ' poster-rating--text' : ''}`, '');
    if (state.ratingMode === 'stars') {
      const numeric = Number(value);
      paintStars(node, numeric);
      node.setAttribute('aria-label', `${numeric} 分`);
    } else node.textContent = String(value);
    return node;
  }
  function ratingControl(item, albumMode) {
    const wrap = text('div', 'rating-control', '');
    const current = rating(item, albumMode);
    if (state.ratingMode === 'stars') {
      const stars = text('div', 'star-slider', ''); stars.setAttribute('role', 'slider'); stars.setAttribute('aria-label', `${item.name} 评分`); stars.setAttribute('aria-valuemin', '0'); stars.setAttribute('aria-valuemax', '5'); stars.setAttribute('aria-valuenow', current || 0); stars.tabIndex = 0; paintStars(stars, current);
      const scoreAt = event => { const rect = stars.getBoundingClientRect(); const ratio = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)); return ratio === 0 ? '' : Math.round(ratio * 10) / 2; };
      const preview = event => paintStars(stars, scoreAt(event));
      stars.addEventListener('pointerdown', event => { event.preventDefault(); stars.setPointerCapture(event.pointerId); preview(event); });
      stars.addEventListener('pointermove', event => { if (event.buttons || event.pressure > 0) preview(event); });
      stars.addEventListener('pointerup', event => setRating(item, albumMode, scoreAt(event)));
      stars.addEventListener('keydown', event => { if (event.key === 'ArrowRight' || event.key === 'ArrowUp') { event.preventDefault(); setRating(item, albumMode, Math.min(5, Number(current || 0) + .5)); } if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') { event.preventDefault(); setRating(item, albumMode, Math.max(.5, Number(current || 0) - .5)); } });
      wrap.append(stars, text('span', 'rating-value', current ? `${current}/5` : '未评分'));
    } else {
      const select = document.createElement('select'); select.className = 'level-select'; select.setAttribute('aria-label', `${item.name} 等级`);
      const empty = document.createElement('option'); empty.value = ''; empty.textContent = '未评分'; select.append(empty);
      levels().forEach((level, index) => { const option = document.createElement('option'); option.value = level; option.textContent = level; option.selected = current === level; select.append(option); });
      select.addEventListener('change', () => setRating(item, albumMode, select.value)); wrap.append(select);
    }
    return wrap;
  }
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
      return cover ? {...item, album: {...item.album, cover: cover.data || cover.source || '', sourceCover: cover.source || ''}} : item;
    });
    return chart;
  }
  function render() {
    if (!data) return;
    const selectedTheme = state.theme === 'seasonal' ? (state.season || 'spring') : state.theme;
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
    const theme = selectedTheme === 'spring' ? {id:'spring', name:'春日新芽', kicker:'SOUNDS IN BLOOM'} : selectedTheme === 'summer' ? {id:'summer', name:'盛夏唱片', kicker:'A BRIGHTER SIDE OF THE YEAR'} : selectedTheme === 'autumn' ? {id:'autumn', name:'秋日唱片', kicker:'THE SEASON OF SLOW LISTENING'} : selectedTheme === 'winter' ? {id:'winter', name:'冬夜蓝调', kicker:'A QUIET ARCHIVE OF SOUND'} : (window.THEMES && window.THEMES[selectedTheme]) ? {...themes.find(t => t.id === selectedTheme), kicker: window.THEMES[selectedTheme].kicker} : themes.find(t => t.id === selectedTheme) || themes[0];
    const format = state.art === 'text' ? {columns: state.ratio === 'wide' ? 3 : 2, rows: 12} : formats[state.ratio], count = format.columns * format.rows;
    const pages = Math.max(1, Math.ceil(items.length / count));
    page = Math.max(0, Math.min(page, pages - 1));
    document.querySelectorAll('.theme-choice').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.theme === state.theme)));
    const poster = text('article', `poster poster--${theme.id} ratio--${state.ratio} covers--${state.coverMode}${state.labels || state.art === 'text' ? '' : ' hide-labels'}${state.art === 'text' ? ' poster-text-only' : ''}`, '');
    const custom = state.themeOptions?.[theme.id] || {};
    if (custom.font) poster.classList.add(`font-${custom.font}`);
    if (custom.ink) poster.style.setProperty('--ink', custom.ink);
    if (custom.accent) poster.style.setProperty('--accent', custom.accent);
    if (state.theme === 'editorial') { poster.style.setProperty('--paper', state.editorialBg); poster.style.setProperty('--accent', state.editorialAccent); }
    if (custom.accent) poster.style.setProperty('--custom-accent', custom.accent);
    if (custom.ink) poster.style.setProperty('--ink', custom.ink);
    // Keep seasonal artwork as regular image nodes. CSS background images are
    // rendered in the live preview but are not embedded reliably by SnapDOM
    // in Safari, mobile browsers, and Edge exports.
    if (theme.id === 'spring') {
      const background = new Image();
      background.className = 'spring-poster-background';
      background.alt = '';
      background.decoding = 'sync';
      background.src = 'materials/spring-bg.png';
      background.draggable = false;
      poster.append(background);
    }
    $('editorial-colors').hidden = selectedTheme !== 'editorial';
    renderCustomControls();
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
      if (theme.id === 'spring') {
        card.style.setProperty('--spring-tilt', '0deg');
        card.style.setProperty('--spring-frame', `url("materials/frame-${[3, 7, 9][(rank - 1) % 3]}.png")`);
      }
      const slot = text('div', 'poster-cover-slot', '');
      const frame = text('div', 'poster-cover', '');
      frame.append(text('span', 'cover-placeholder', '♪'));
      if (theme.id === 'spring' && state.art !== 'text') {
        const frameImage = new Image();
        frameImage.className = 'spring-card-frame';
        frameImage.alt = '';
        frameImage.decoding = 'sync';
        frameImage.src = `materials/frame-${[3, 7, 9][(rank - 1) % 3]}.png`;
        frameImage.draggable = false;
        frame.append(frameImage);
      }
      const url = item.album?.cover;
      if (state.art !== 'text' && url && (/^https?:\/\//.test(url) || /^data:image\//.test(url))) {
        const image = new Image(); image.alt = item.album?.name || item.name || '专辑封面'; image.referrerPolicy = 'no-referrer';
        image.addEventListener('error', () => { image.style.visibility = 'hidden'; }); image.src = url; frame.append(image);
      }
      const itemKey = albumMode ? `album:${item.id}` : `item:${item.id}:${item.position ?? rank}`;
      const rankNode = editable('span', 'poster-rank', String(rank).padStart(2, '0'), `${itemKey}:rank`, '排名文案');
      if (theme.id === 'spring' && state.art !== 'text') {
        const flower = new Image();
        flower.className = 'spring-card-flower';
        flower.alt = '';
        flower.src = `materials/flower-${((rank - 1) % 15) + 1}.png`;
        flower.draggable = false;
        frame.append(flower);
      }
      if (theme.id !== 'spring' && state.art !== 'text') frame.append(rankNode);
      const badge = ratingNode(item, albumMode, state.art === 'text'); if (badge) frame.append(badge);
      const caption = text('figcaption', 'poster-caption', '');
      if (theme.id === 'spring' || state.art === 'text') caption.append(rankNode);
      const name = item.name || `未匹配歌曲 ${item.id}`;
      caption.append(editable('div', 'poster-song', name, `${itemKey}:name`, albumMode ? '专辑名' : '歌名'), editable('div', 'poster-artist', (item.artists || []).map(a => a.name).join(' / ') || '待补全', `${itemKey}:artist`, '音乐人'));
      slot.append(frame);
      card.title = `${rank}. ${name}${albumMode ? ` · 歌单内 ${item.tracks.length} 首：${item.tracks.map(track => track.name).join(' / ')}` : ''}`; card.append(slot, caption); decorateSortCard(card, item, rank); grid.append(card);
    });
    const footer = text('div', 'poster-footer', '');
    footer.append(editable('span', '', 'SELECTED WITH LOVE', 'footer', '页脚'), editable('span', '', `${String(page + 1).padStart(2, '0')} / ${String(pages).padStart(2, '0')}`, `page:${page}`, '当前页码文案'));
    poster.append(head, grid, footer); $('poster-mount').replaceChildren(poster);

    // Apply theme decorations using new theme system
    if (window.applyTheme && window.THEMES && window.THEMES[theme.id]) {
      const activeFilters = state.filters || [];
      window.applyTheme(poster, theme.id, activeFilters);
    }

    scaleRatingBadges(poster);
    (state.customElements || []).forEach(element => {
      if (element.scope === 'page' && Number(element.page) !== page + 1) return;
      const node = element.kind === 'text' ? text('div', 'custom-poster-element custom-poster-text', element.text || '') : new Image();
      if (element.kind !== 'text' && !element.data) return;
      if (element.selected) node.classList.add('is-selected');
      node.dataset.customId = element.id;
      if (element.kind !== 'text') { node.src = element.data; node.alt = element.name || '自定义装饰'; node.draggable = false; }
      node.style.left = `${element.x ?? 8}%`; node.style.top = `${element.y ?? 28}%`; node.style.width = `${element.width ?? 24}%`; node.style.height = element.height ? `${element.height}%` : (element.kind === 'text' ? 'auto' : 'auto'); node.style.minHeight = element.kind === 'text' ? '2.5cqw' : '4cqw'; node.style.zIndex = String(Math.max(10, element.z ?? 5)); node.style.transform = `rotate(${element.rotation || 0}deg)`;
      if (element.kind === 'text') { node.style.color = element.color || 'var(--ink)'; node.style.fontFamily = element.font || ''; }
      poster.append(node); installCustomElement(node, element, poster);
    });
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
        try { await setCover(await ChartAssets.normalize(selectedFile), ''); }
        catch (error) { showStatus(error.message, true); }
      });
      applyUrl.addEventListener('click', async () => {
        const value = urlInput.value.trim(); applyUrl.disabled = true;
        try {
          if (value && !/^https?:\/\//i.test(value)) throw new Error('请输入图片链接');
          await setCover('', value);
          showStatus(value ? '已保存封面链接；图片会从来源地址加载。' : '已恢复原始封面');
        }
        catch (error) { showStatus(error.message + '；原封面保持不变。', true); }
        finally { applyUrl.disabled = false; }
      });
      coverTools.append(file, upload, urlInput, applyUrl);
      const remove = text('button', 'cover-action delete-action', '删除');
      remove.type = 'button'; remove.setAttribute('aria-label', `删除${albumMode ? '专辑' : '歌曲'}：${item.name || item.id}`);
      remove.addEventListener('click', async () => {
        remove.disabled = true;
        try {
          await window.deleteChartItem(item, albumMode);
          showStatus(`已删除${albumMode ? '专辑' : '歌曲'}「${item.name || item.id}」`);
        } catch (error) { remove.disabled = false; showStatus(error.message || '删除失败', true); }
      });
      card.append(image, info, remove, coverTools);
      if (state.ratingEnabled) card.append(ratingControl(item, albumMode));
      decorateSortCard(card, item, index + 1); return card;
    });
    $('songs').replaceChildren(...cards);
    // Preserve access to tracks that cannot be assigned to an album.
    if (albumMode) {
      const missing = buildAlbumChart(data.items).unresolved;
      if (missing.length) $('songs').append(text('p', 'hint', `未纳入：${missing.map(item => item.name || item.id).join('、')}`));
    }
  }
  for (const id of ['sort-toggle', 'list-sort-toggle']) $(id).addEventListener('click', () => { sorting = !sorting; selected.clear(); render(); });
  $('rating-enabled').checked = state.ratingEnabled;
  $('rating-mode').value = state.ratingMode;
  $('rating-levels').value = state.ratingLevels;
  $('rating-settings').hidden = !state.ratingEnabled;
  $('rating-enabled').addEventListener('change', () => { state.ratingEnabled = $('rating-enabled').checked; $('rating-settings').hidden = !state.ratingEnabled; save(); render(); });
  $('rating-mode').addEventListener('change', () => { state.ratingMode = $('rating-mode').value; save(); render(); });
  $('rating-levels').addEventListener('input', () => { state.ratingLevels = $('rating-levels').value; save(); render(); });
  function applySort() {
    if (!data) return;
    const method = $('sort-method').value; const albumMode = state.chartType === 'albums';
    if (method === 'manual') { delete state.orders[editKey()]; save(); render(); return; }
    const ordered = [...currentItems];
    const original = new Map(ordered.map((item, index) => [chartItemKey(item, state.chartType), index]));
    if (method === 'rating-desc' || method === 'rating-asc') {
      ordered.sort((a, b) => {
        const av = rating(a, albumMode), bv = rating(b, albumMode), missingA = av == null || av === '', missingB = bv == null || bv === '';
        if (missingA !== missingB) return missingA ? 1 : -1;
        if (missingA) return original.get(chartItemKey(a, state.chartType)) - original.get(chartItemKey(b, state.chartType));
        const score = state.ratingMode === 'stars' ? Number(av) : levels().indexOf(String(av));
        const other = state.ratingMode === 'stars' ? Number(bv) : levels().indexOf(String(bv));
        return (method === 'rating-desc' ? other - score : score - other) || original.get(chartItemKey(a, state.chartType)) - original.get(chartItemKey(b, state.chartType));
      });
    } else {
      const collator = new Intl.Collator(['zh-CN', 'en'], {numeric: true, sensitivity: 'base'});
      ordered.sort((a, b) => {
        const av = method === 'artist' ? (a.artists || []).map(x => x.name).join(' ') : a.name || '';
        const bv = method === 'artist' ? (b.artists || []).map(x => x.name).join(' ') : b.name || '';
        return collator.compare(av, bv) || original.get(chartItemKey(a, state.chartType)) - original.get(chartItemKey(b, state.chartType));
      });
    }
    state.orders[editKey()] = ordered.map(item => chartItemKey(item, state.chartType)); selected.clear(); page = 0; save(); render(); $('sort-info').textContent = '排序已应用，可继续手动拖拽调整。';
  }
  $('sort-method').addEventListener('change', applySort);
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
  function seasonControl() {
    const holder = $('season-choices'); holder.replaceChildren();
    const seasons = window.PLAYLIST_SEASONS || [
      {id: 'spring', name: '春日新芽'}, {id: 'summer', name: '盛夏唱片'},
      {id: 'autumn', name: '秋日唱片'}, {id: 'winter', name: '冬夜蓝调'}
    ];
    seasons.forEach(season => {
      const button = text('button', `season-choice season-choice--${season.id}`, season.name);
      button.type = 'button'; button.dataset.season = season.id; button.setAttribute('aria-pressed', String(state.season === season.id));
      button.addEventListener('click', event => { event.preventDefault(); state.theme = 'seasonal'; state.season = season.id; save(); render(); }); holder.append(button);
    });
  }
  themes.forEach(theme => {
    const button = text('button', `theme-choice theme-choice--${theme.id}`, '');
    button.type = 'button'; button.dataset.theme = theme.id;
    button.append(text('span', 'theme-swatch', theme.badge), text('strong', '', theme.name), text('small', '', theme.caption));
    button.addEventListener('click', () => { state.theme = theme.id; save(); render(); });
    $('theme-options').append(button);
  });

  // Initialize filter choices
  if (window.FILTER_EFFECTS) {
    const filterContainer = $('filter-choices');
    Object.entries(window.FILTER_EFFECTS).forEach(([key, filter]) => {
      const button = text('button', 'filter-choice', filter.name);
      button.type = 'button';
      button.dataset.filter = key;
      button.setAttribute('aria-pressed', state.filters.includes(key) ? 'true' : 'false');
      button.title = filter.description || '';
      button.addEventListener('click', () => {
        const index = state.filters.indexOf(key);
        if (index >= 0) {
          state.filters.splice(index, 1);
        } else {
          state.filters.push(key);
        }
        button.setAttribute('aria-pressed', state.filters.includes(key) ? 'true' : 'false');
        save();
        render();
      });
      filterContainer.append(button);
    });
  }

  $('theme-options').addEventListener('click', event => {
    const button = event.target.closest('.theme-choice');
    if (button?.dataset.theme === 'seasonal') $('season-options').hidden = false;
  });
  function activeTheme() { return state.theme === 'seasonal' ? (state.season || 'spring') : state.theme; }
  function addElement(element) { state.customElements ||= []; state.customElements.push({id: crypto.randomUUID?.() || `${Date.now()}-${Math.random()}`, x: 8, y: 28, width: 24, rotation: 0, layer: 'top', z: 20, scope: $('custom-scope').value, page: page + 1, ...element}); save(); render(); }
  $('custom-text-add').addEventListener('click', () => { const value = $('custom-text').value.trim(); if (!value) return; addElement({kind: 'text', name: value.slice(0, 20), text: value, width: 28, color: $('custom-ink').value}); $('custom-text').value = ''; });
  $('custom-text').addEventListener('keydown', event => { if (event.key === 'Enter') { event.preventDefault(); $('custom-text-add').click(); } });
  $('custom-font').addEventListener('input', () => { const id = activeTheme(); state.themeOptions ||= {}; state.themeOptions[id] ||= {}; state.themeOptions[id].font = $('custom-font').value; save(); render(); });
  ['custom-ink', 'custom-accent'].forEach(id => $(id).addEventListener('input', () => { const key = id === 'custom-ink' ? 'ink' : 'accent', themeId = activeTheme(); state.themeOptions ||= {}; state.themeOptions[themeId] ||= {}; state.themeOptions[themeId][key] = $(id).value; save(); render(); }));
  $('custom-image').addEventListener('change', async () => { const file = $('custom-image').files?.[0]; if (!file) return; try { const data = await ChartAssets.normalize(file); addElement({kind:'image', name:file.name, data}); } catch (error) { showStatus(error.message, true); } finally { $('custom-image').value = ''; } });
  function renderCustomControls() { const id = activeTheme(), options = state.themeOptions?.[id] || {}; $('season-options').hidden = state.theme !== 'seasonal'; seasonControl(); $('custom-font').value = options.font || ''; $('custom-ink').value = options.ink || '#302d26'; $('custom-accent').value = options.accent || '#b34f36'; const list = $('custom-elements'); list.replaceChildren(...(state.customElements || []).map((item, index) => { const row = text('div','custom-element-row',''); const label = text('span','custom-element-name',`${item.kind === 'image' ? '图片' : '文字'} · ${item.name || '未命名'}`); const controls = text('div', 'custom-element-actions', '');
      const size = document.createElement('input'); size.type='range'; size.min='5'; size.max='70'; size.step='1'; size.value=String(item.width || 24); size.title='大小'; size.setAttribute('aria-label','调整大小'); size.addEventListener('input',()=>{item.width=Number(size.value); const node=document.querySelector(`[data-custom-id="${CSS.escape(item.id)}"]`); if(node) node.style.width=`${item.width}%`;}); size.addEventListener('change',save);
      const rotate = document.createElement('input'); rotate.type='range'; rotate.min='-180'; rotate.max='180'; rotate.step='1'; rotate.value=String(item.rotation || 0); rotate.title='旋转'; rotate.setAttribute('aria-label','调整旋转角度'); rotate.addEventListener('input',()=>{item.rotation=Number(rotate.value); const node=document.querySelector(`[data-custom-id="${CSS.escape(item.id)}"]`); if(node) node.style.transform=`rotate(${item.rotation}deg)`;}); rotate.addEventListener('change',save);
      const layer = document.createElement('select'); layer.title='图层'; layer.setAttribute('aria-label','图层位置'); layer.innerHTML='<option value="top">最上层</option><option value="bottom">最底层</option>'; layer.value=item.layer || ((item.z || 5) <= 1 ? 'bottom' : 'top'); layer.addEventListener('change',()=>{item.layer=layer.value; item.z=layer.value==='top'?20:0; save(); render();});
      controls.append(size, rotate, layer);
      if (item.kind === 'text') { const color=document.createElement('input'); color.type='color'; color.value=item.color || '#302d26'; color.title='文字颜色'; color.setAttribute('aria-label','文字颜色'); color.addEventListener('input',()=>{item.color=color.value; const node=document.querySelector(`[data-custom-id="${CSS.escape(item.id)}"]`); if(node) node.style.color=item.color; save();}); controls.append(color); }
      const remove = text('button','','删除'); remove.type='button'; remove.addEventListener('click',()=>{state.customElements.splice(index,1);save();render();}); controls.append(remove); row.append(label, controls); return row; })); }
  function installCustomElement(node, element, poster) {
    node.addEventListener('pointerdown', event => { if (event.button !== 0) return; event.preventDefault(); state.customElements.forEach(item => { item.selected = item.id === element.id; }); const start = {x: event.clientX, y: event.clientY, left: element.x ?? 72, top: element.y ?? 8}; node.setPointerCapture(event.pointerId); const move = e => { const rect = poster.getBoundingClientRect(); element.x = Math.max(0, Math.min(100 - (element.width || 18), start.left + (e.clientX - start.x) / rect.width * 100)); element.y = Math.max(0, Math.min(100 - 8, start.top + (e.clientY - start.y) / rect.height * 100)); node.style.left = `${element.x}%`; node.style.top = `${element.y}%`; }; const end = () => { node.releasePointerCapture?.(event.pointerId); node.removeEventListener('pointermove', move); node.removeEventListener('pointerup', end); save(); render(); }; node.addEventListener('pointermove', move); node.addEventListener('pointerup', end); });
    node.addEventListener('dblclick', () => { const value = element.kind === 'text' ? window.prompt('修改装饰文字', element.text || '') : null; if (value != null) { element.text = value; element.name = value.slice(0,20); save(); render(); } });
  }
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
  // Export needs to switch the live poster to each page in turn so SnapDOM
  // captures the right DOM, then restore whatever the user was viewing.
  window.getPosterPage = () => page;
  window.setPosterPage = value => { page = value; render(); };
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
    renderCustomControls();
    $('rating-enabled').checked = Boolean(state.ratingEnabled); $('rating-settings').hidden = !state.ratingEnabled;
    $('rating-mode').value = state.ratingMode === 'levels' ? 'levels' : 'stars'; $('rating-levels').value = state.ratingLevels || '💣, C, B, A, A+';
    save(); await window.updateImportedData(project.playlist, true);
  };
  window.addChartItem = async entry => {
    data.items.push({...entry, position: data.items.length}); data.sourceCount = data.items.length; data.playlist.count = data.items.length;
    await window.updateImportedData(data);
  };
  window.deleteChartItem = async (item, albumMode = false) => {
    if (!data?.items) return;
    const before = {playlist: structuredClone(data), design: structuredClone(state)};
    const removedKeys = new Set();
    if (albumMode) {
      const albumId = String(item.album?.id ?? item.id);
      data.items = data.items.filter(track => {
        const keep = String(track.album?.id ?? '') !== albumId;
        if (!keep) removedKeys.add(chartItemKey(track, 'songs'));
        return keep;
      });
      removedKeys.add(chartItemKey(item, 'albums'));
    } else {
      const index = data.items.findIndex(track => String(track.id) === String(item.id) && Number(track.position) === Number(item.position));
      if (index < 0) return;
      data.items.splice(index, 1);
      removedKeys.add(chartItemKey(item, 'songs'));
    }
    data.sourceCount = data.items.length;
    data.playlist.count = data.items.length;
    if (data.coverOverrides) for (const key of removedKeys) {
      delete data.coverOverrides[key];
      delete data.coverOverrides[key.replace(/^song:/, 'album:')];
    }
    for (const key of removedKeys) { delete state.ratings[`songs:${key}`]; delete state.ratings[`albums:${key}`]; }
    for (const chartType of ['songs', 'albums']) {
      const id = `${data.playlist.id}${chartType === 'albums' ? ':albums' : ''}`;
      state.orders[id] = (state.orders[id] || []).filter(key => !removedKeys.has(key));
    }
    await window.updateImportedData(data);
    window.dispatchEvent(new CustomEvent('chart-deleted', {detail: {name: item.name || item.id, before}}));
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
