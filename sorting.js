function chartItemKey(item, type) {
  return type === 'albums' ? `album:${item.id}` : `song:${item.id}:${item.position}`;
}
function applyChartOrder(items, order, type) {
  const positions = new Map(order.map((key, index) => [key, index]));
  return [...items].sort((a, b) => (positions.get(chartItemKey(a, type)) ?? Infinity) - (positions.get(chartItemKey(b, type)) ?? Infinity));
}
function moveChartSelection(keys, selected, target, after) {
  if (selected.has(target) || !keys.includes(target)) return keys;
  const moving = keys.filter(key => selected.has(key));
  const remaining = keys.filter(key => !selected.has(key));
  remaining.splice(remaining.indexOf(target) + (after ? 1 : 0), 0, ...moving);
  return remaining;
}

// Pointer events work with mouse and with the explicit touch drag handle.
function installChartDrag({active, selection, select, move}) {
  let drag = null;
  let suppressClick = false;
  let scrollFrame = null;
  const clearMarks = () => document.querySelectorAll('.drop-before,.drop-after').forEach(node => node.classList.remove('drop-before', 'drop-after'));
  function findTarget(x, y) {
    const card = document.elementFromPoint(x, y)?.closest('[data-sort-key]');
    clearMarks();
    if (!card || selection().has(card.dataset.sortKey)) return null;
    const rect = card.getBoundingClientRect();
    const after = y > rect.top + rect.height / 2;
    card.classList.add(after ? 'drop-after' : 'drop-before');
    return {key: card.dataset.sortKey, after};
  }
  function autoScroll() {
    if (!drag?.started) return;
    const speed = drag.y < 70 ? -14 : drag.y > innerHeight - 70 ? 14 : 0;
    if (speed) { window.scrollBy(0, speed); drag.target = findTarget(drag.x, drag.y); }
    scrollFrame = requestAnimationFrame(autoScroll);
  }
  document.addEventListener('pointerdown', event => {
    if (!active() || event.button !== 0 || event.target.closest('input,button')) return;
    const card = event.target.closest('[data-sort-key]');
    if (!card || (event.pointerType !== 'mouse' && !event.target.closest('.drag-handle'))) return;
    // Cancel native text selection before the drag threshold is reached.
    event.preventDefault();
    window.getSelection()?.removeAllRanges();
    drag = {key: card.dataset.sortKey, x: event.clientX, y: event.clientY, startX: event.clientX, startY: event.clientY, id: event.pointerId};
  }, {passive: false});
  document.addEventListener('selectstart', event => {
    const target = event.target.nodeType === 1 ? event.target : event.target.parentElement;
    if (active() && target?.closest('[data-sort-key]') && !target.closest('input,button')) event.preventDefault();
  });
  document.addEventListener('pointermove', event => {
    if (!drag || event.pointerId !== drag.id) return;
    drag.x = event.clientX; drag.y = event.clientY;
    if (!drag.started && Math.hypot(drag.x - drag.startX, drag.y - drag.startY) > 6) {
      drag.started = true;
      if (!selection().has(drag.key)) select(new Set([drag.key]));
      document.body.classList.add('chart-dragging');
      autoScroll();
    }
    if (drag.started) { event.preventDefault(); drag.target = findTarget(drag.x, drag.y); }
  }, {passive: false});
  function end(event) {
    if (!drag) return;
    const finished = drag; drag = null;
    cancelAnimationFrame(scrollFrame); clearMarks(); document.body.classList.remove('chart-dragging');
    if (finished.started) {
      suppressClick = true; setTimeout(() => { suppressClick = false; }, 0);
      if (event.type === 'pointerup' && finished.target) move(finished.target.key, finished.target.after);
    }
  }
  document.addEventListener('pointerup', end);
  document.addEventListener('pointercancel', end);
  window.addEventListener('blur', end);
  document.addEventListener('click', event => { if (suppressClick) { event.preventDefault(); event.stopPropagation(); } }, true);
  document.addEventListener('dragstart', event => { if (active() && event.target.closest('[data-sort-key]')) event.preventDefault(); });
}
