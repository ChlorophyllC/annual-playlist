// Large uploaded images belong in IndexedDB, not the small localStorage quota.
window.ChartAssets = (() => {
  let db;
  async function database() {
    if (!db) db = new Promise((resolve, reject) => {
      const request = indexedDB.open('annual-playlist', 1);
      request.onupgradeneeded = () => request.result.createObjectStore('projects');
      request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
    });
    return db;
  }
  async function store(value) {
    const databaseRef = await database();
    return new Promise((resolve, reject) => {
      const transaction = databaseRef.transaction('projects', 'readwrite');
      transaction.objectStore('projects').put(value, 'current');
      transaction.oncomplete = resolve; transaction.onerror = () => reject(transaction.error);
    });
  }
  async function restore() {
    const databaseRef = await database();
    return new Promise((resolve, reject) => {
      const r = databaseRef.transaction('projects').objectStore('projects').get('current');
      r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error);
    });
  }
  async function clear() {
    const databaseRef = await database();
    await new Promise((resolve, reject) => {
      const tx = databaseRef.transaction('projects', 'readwrite');
      tx.objectStore('projects').clear(); tx.oncomplete = resolve; tx.onerror = () => reject(tx.error);
    });
    for (const key of Object.keys(localStorage)) {
      // Connection settings are configuration, not cached user content.
      if (key.startsWith('annual-playlist:') && key !== 'annual-playlist:backend') localStorage.removeItem(key);
    }
    if ('caches' in window) for (const key of await caches.keys()) {
      if (key.startsWith('annual-playlist')) await caches.delete(key);
    }
  }
  function api(path) {
    const configured = localStorage.getItem('annual-playlist:backend') || (location.hostname === 'chlorophyllc.github.io' ? 'https://annual-playlist-netease.cookie4830.workers.dev' : '');
    return configured ? configured.replace(/\/$/, '') + '/' + path.replace(/^\//, '') : new URL(path.replace(/^\//, ''), location.href).href;
  }
  function localServer() {
    return ['localhost', '127.0.0.1'].includes(location.hostname) ||
      Boolean(localStorage.getItem('annual-playlist:backend')) ||
      location.hostname === 'chlorophyllc.github.io';
  }
  function dataURL(blob) { return new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = () => reject(reader.error); reader.readAsDataURL(blob); }); }
  async function normalize(blob) {
    if (blob.size > 20 * 1024 * 1024) throw new Error('请选择小于 20MB 的图片');
    const url = URL.createObjectURL(blob);
    try {
      const image = new Image(); image.src = url; await image.decode();
      const factor = Math.min(1, 1600 / Math.max(image.naturalWidth, image.naturalHeight));
      const canvas = document.createElement('canvas'); canvas.width = Math.max(1, Math.round(image.naturalWidth * factor)); canvas.height = Math.max(1, Math.round(image.naturalHeight * factor));
      canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
      return canvas.toDataURL('image/png');
    } finally { URL.revokeObjectURL(url); }
  }
  async function cover(url) {
    if (/^data:image\/(png|jpeg|webp);base64,/i.test(url)) return url;
    if (!/^https?:\/\//i.test(url)) throw new Error('请输入图片链接，而不是作品页面地址');
    let response;
    if (localServer()) response = await fetch(api('api/cover') + '?url=' + encodeURIComponent(url), {signal: AbortSignal.timeout(30000)});
    if (!response?.ok) response = await fetch(url, {signal: AbortSignal.timeout(20000), referrerPolicy: 'no-referrer'});
    if (!response.ok) throw new Error('封面暂时无法下载，可上传本地图片');
    return normalize(await response.blob());
  }
  return {store, restore, clear, api, localServer, dataURL, normalize, cover};
})();
