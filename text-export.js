(() => {
  const button = document.getElementById('text-export-button');
  const status = document.getElementById('text-export-status');
  let url;
  button.addEventListener('click', () => {
    const chart = window.getCurrentChartSnapshot?.();
    if (!chart || !chart.items.length) { status.textContent = '请先导入歌单。'; return; }
    const heading = `${chart.title}\n${chart.type === 'albums' ? '专辑榜' : '歌曲榜'}\n${'='.repeat(Math.min(40, chart.title.length + 4))}`;
    const lines = chart.items.map(item => `${String(item.rank).padStart(2, '0')}. ${item.name}${item.artists ? ` — ${item.artists}` : ''}${item.album && chart.type === 'songs' ? ` [${item.album}]` : ''}`);
    if (chart.unresolved?.length) lines.push('', '未纳入专辑榜的条目：', ...chart.unresolved.map(item => `- ${item.name || item.id}`));
    const blob = new Blob([`${heading}\n\n${lines.join('\n')}\n`], {type: 'text/plain;charset=utf-8'});
    if (url) URL.revokeObjectURL(url); url = URL.createObjectURL(blob);
    const link = document.createElement('a'); link.href = url; link.download = `${chart.title.replace(/[<>:"/\\|?*]/g, '_')}.txt`; link.click(); status.textContent = `已保存 ${chart.items.length} 条文字记录。`;
  });
})();
