// Optional Cloudflare Web Analytics beacon.
// Set the token after creating a Web Analytics site in Cloudflare. No user
// content, search terms, playlist URLs, or uploaded images are sent here.
(() => {
  const token = window.ANNUAL_PLAYLIST_ANALYTICS_TOKEN || '';
  if (!token || token === 'REPLACE_ME') return;
  const script = document.createElement('script');
  script.defer = true;
  script.src = 'https://static.cloudflareinsights.com/beacon.min.js';
  script.dataset.cfBeacon = JSON.stringify({token});
  script.crossOrigin = 'anonymous';
  document.head.append(script);
})();
