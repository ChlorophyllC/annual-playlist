const input = document.querySelector('#playlist-url');
const importButton = document.querySelector('#import');
const status = document.querySelector('#status');
const result = document.querySelector('#result');
const savedKey = 'annual-playlist:last-import';
function showStatus(message, error = false) { status.hidden = false; status.textContent = message; status.className = `status${error ? ' error' : ''}`; }
window.updateImportedData = async (data, replace = false) => {
  // Keep the draft usable even when device storage is full; report the failure.
  window.dispatchEvent(new CustomEvent(replace ? 'playlist-loaded' : 'playlist-updated', {detail: data}));
  try { await ChartAssets.store(data); }
  catch (_) { showStatus('设备空间不足或浏览器禁止保存，请下载工程文件备份。', true); throw new Error('自动保存失败，请下载工程文件'); }
};
async function importPlaylist() {
  importButton.disabled = true; showStatus('正在读取歌单，并匹配歌曲详情…');
  try {
    const response = await fetch(ChartAssets.api('api/import'), {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({url:input.value})});
    const data = await response.json(); if (!response.ok) throw new Error(data.error || '导入失败');
    await window.updateImportedData(data, true);
    showStatus(`已读取 ${data.sourceCount} 首，匹配 ${data.items.filter(x=>x.matched).length} 首，已保存到此设备。`);
  } catch (error) { showStatus(error.message, true); } finally { importButton.disabled = !ChartAssets.localServer(); }
}
importButton.addEventListener('click',importPlaylist);
input.addEventListener('keydown',event=>{if(event.key==='Enter'&&!importButton.disabled)importPlaylist();});
if (!ChartAssets.localServer()) {
  importButton.disabled = true; input.disabled = true;
  input.closest('section').querySelector('.hint').textContent = '此静态版本支持手动添加与工程文件。网易云链接导入需运行本地服务，详见使用说明。';
}
document.querySelector('#clear').addEventListener('click',async()=>{
  await ChartAssets.clear(); localStorage.removeItem(savedKey);
  window.dispatchEvent(new Event('playlist-cleared')); showStatus('已清除当前设备草稿，现展示示例歌单。');
});
window.draftReady = (async()=>{
  try {
    let data = await ChartAssets.restore();
    if (!data) { data = JSON.parse(localStorage.getItem(savedKey)||'null'); if(data) { await ChartAssets.store(data); localStorage.removeItem(savedKey); } }
    if(data) { window.dispatchEvent(new CustomEvent('playlist-loaded',{detail:data})); showStatus('已恢复上次草稿（保存在此设备）。'); }
  } catch (_) { showStatus('浏览器未能读取本地草稿，仍可导入工程文件。',true); }
})();
