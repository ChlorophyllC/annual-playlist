# 网易云 Worker

```bash
npm install -g wrangler
wrangler login
cd workers
wrangler deploy
```

部署后在年度歌单页面的浏览器控制台设置：

```js
localStorage.setItem('annual-playlist:backend', 'https://annual-playlist-netease.<你的账号>.workers.dev')
```

刷新页面即可启用网易云导入。Worker 仅提供 `/api/import`，未配置 API key。上线前请自行设置来源限制、频率限制、歌单数量上限，并阅读平台条款。
