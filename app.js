const input = document.querySelector('#playlist-url');
const importButton = document.querySelector('#import');
const startInput = document.querySelector('#playlist-start');
const endInput = document.querySelector('#playlist-end');
const nextButton = document.querySelector('#import-next');
const status = document.querySelector('#status');
const result = document.querySelector('#result');
const savedKey = 'annual-playlist:last-import';
const welcome = document.querySelector('#welcome');
// Keep the settings rail compact: opening one panel closes its siblings.
document.querySelectorAll('.control-card').forEach(card => {
  card.addEventListener('toggle', () => {
    if (!card.open) return;
    document.querySelectorAll('.control-card[open]').forEach(other => {
      if (other !== card) other.open = false;
    });
    if (matchMedia('(max-width: 850px)').matches) {
      requestAnimationFrame(() => card.scrollIntoView({behavior: 'smooth', block: 'nearest'}));
    }
  });
});
function closeWelcome() { welcome.hidden = true; }
function showWelcome(hasDraft) {
  welcome.hidden = false;
  document.querySelector('#welcome-first').hidden = hasDraft;
  document.querySelector('#welcome-existing').hidden = !hasDraft;
  document.querySelector('#welcome-title').textContent = hasDraft ? '发现上次的榜单' : '把这一年的音乐，整理成你的榜单。';
  document.querySelector('#welcome-copy').textContent = hasDraft ? '本设备保存了上次的编辑内容，要继续使用吗？' : '选择已有歌单，或从零开始添加歌曲和专辑。';
}
document.querySelector('#welcome-import').addEventListener('click', () => { closeWelcome(); document.querySelector('#playlist-url').focus(); document.querySelector('#playlist-url').scrollIntoView({behavior:'smooth', block:'center'}); });
document.querySelector('#welcome-new').addEventListener('click', () => { closeWelcome(); window.skipNewChartConfirm = true; document.querySelector('#new-chart').click(); });
document.querySelector('#welcome-enter').addEventListener('click', closeWelcome);
document.querySelector('#welcome-clear').addEventListener('click', async () => { await ChartAssets.clear(); localStorage.removeItem(savedKey); location.reload(); });
document.querySelector('#mobile-save').addEventListener('click', () => document.querySelector('#project-export').click());
document.querySelector('#mobile-export').addEventListener('click', () => document.querySelector('#export-button').click());
const undoBar = document.querySelector('#undo-bar');
let undoSnapshot = null;
window.addEventListener('chart-deleted', event => {
  undoSnapshot = event.detail;
  document.querySelector('#undo-message').textContent = `已删除「${event.detail.name}」`;
  undoBar.hidden = false;
  clearTimeout(window.undoTimer);
  window.undoTimer = setTimeout(() => { undoSnapshot = null; undoBar.hidden = true; }, 8000);
});
document.querySelector('#undo-delete').addEventListener('click', async () => {
  if (!undoSnapshot) return;
  const snapshot = undoSnapshot; undoSnapshot = null; undoBar.hidden = true;
  await window.loadProjectState(snapshot.before);
  showStatus('已撤销删除，条目和相关设置已恢复。');
});
window.addEventListener('beforeunload', event => {
  if (document.querySelector('#workspace-save')?.textContent === '正在保存…') { event.preventDefault(); event.returnValue = ''; }
});
function showStatus(message, error = false) { status.hidden = false; status.textContent = message; status.className = `status${error ? ' error' : ''}`; }
function setSaveState(text, error = false) { const node = document.querySelector('#workspace-save'); node.textContent = text; node.style.color = error ? '#983b27' : ''; }
function updateWorkspaceStatus(data) { const name = document.querySelector('#workspace-name'), meta = document.querySelector('#workspace-meta'); if (!data?.playlist) { name.textContent = '准备开始'; meta.textContent = '选择导入歌单或从零开始'; return; } const count = data.items?.length || 0; const type = data.preferredType === 'albums' ? '专辑榜' : '歌曲榜'; name.textContent = data.playlist.name || '未命名歌单'; meta.textContent = `${type} · ${count} 项 · 可继续编辑`; }
window.updateImportedData = async (data, replace = false) => {
  // Keep the draft usable even when device storage is full; report the failure.
  window.dispatchEvent(new CustomEvent(replace ? 'playlist-loaded' : 'playlist-updated', {detail: data}));
  try { setSaveState('正在保存…'); await ChartAssets.store(data); setSaveState('已保存'); }
  catch (_) { setSaveState('保存失败', true); showStatus('设备空间不足或浏览器禁止保存，请下载工程文件备份。', true); throw new Error('自动保存失败，请下载工程文件'); }
};
async function importPlaylist(append = false) {
  const start = Math.max(1, Number(startInput.value) || 1), end = Math.max(start, Number(endInput.value) || start + 99);
  if (end - start + 1 > 100) { showStatus('每次最多导入 100 首，请调整起止位置。', true); return; }
  importButton.disabled = true; nextButton.disabled = true; showStatus(`正在读取第 ${start}–${end} 首，并匹配歌曲详情…`);
  try {
    const response = await fetch(ChartAssets.api('api/import'), {cache:'no-store',method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({url:input.value,start,end})});
    const data = await response.json(); if (!response.ok) throw new Error(data.error || '导入失败');
    let result = data;
    const previous = window.getProjectState().playlist;
    if (append && previous?.playlist?.id === data.playlist.id) {
      const existing = new Map(previous.items.map(item => [Number(item.position), item]));
      data.items.forEach(item => existing.set(Number(item.position), item));
      result = {...data, items: [...existing.values()].sort((a,b) => a.position - b.position)};
    } else window.dispatchEvent(new CustomEvent('playlist-refresh', {detail: data.playlist.id}));
    await window.updateImportedData(result, true); updateWorkspaceStatus(result);
    startInput.value = data.rangeEnd + 1; endInput.value = Math.min(data.rangeEnd + 100, data.sourceCount);
    nextButton.disabled = !data.hasMore;
    showStatus(`已读取第 ${data.rangeStart}–${data.rangeEnd} 首，匹配 ${data.items.filter(x=>x.matched).length} 首；当前已保存 ${result.items.length} 首。${data.hasMore ? '可以继续导入下一页。' : '已到歌单末尾。'}`);
  } catch (error) { showStatus(error.message, true); nextButton.disabled = false; } finally { importButton.disabled = !ChartAssets.localServer(); }
}
importButton.addEventListener('click',() => importPlaylist(false));
nextButton.addEventListener('click',() => importPlaylist(true));
input.addEventListener('keydown',event=>{if(event.key==='Enter'&&!importButton.disabled)importPlaylist(false);});
if (!ChartAssets.localServer()) {
  importButton.disabled = true; input.disabled = true;
  nextButton.disabled = true;
  input.closest('section').querySelector('.hint').textContent = '此静态版本支持手动添加与工程文件。网易云链接导入需运行本地服务，详见使用说明。';
}
document.querySelector('#clear').addEventListener('click',async()=>{
  await ChartAssets.clear(); localStorage.removeItem(savedKey);
  location.reload();
});
window.draftReady = (async()=>{
  try {
    let data = await ChartAssets.restore();
    if (!data) { data = JSON.parse(localStorage.getItem(savedKey)||'null'); if(data) { await ChartAssets.store(data); localStorage.removeItem(savedKey); } }
    if(data) { updateWorkspaceStatus(data); window.dispatchEvent(new CustomEvent('playlist-loaded',{detail:data})); showStatus('已恢复上次草稿（保存在此设备）。'); setSaveState('已保存'); showWelcome(true); }
    else showWelcome(false);
  } catch (_) { showStatus('浏览器未能读取本地草稿，仍可导入工程文件。',true); }
})();
