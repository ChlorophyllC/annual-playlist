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

刷新页面即可启用网易云导入和手动搜索。Worker 提供 `/api/import` 与 `/api/search`，未配置 API key。**修改 Worker 文件后必须在 Cloudflare Dashboard 点击 Deploy，或重新运行 `npx wrangler deploy --config workers/wrangler.toml`；仅修改 GitHub Pages 代码不会更新 Worker。**上线前请自行设置来源限制、频率限制、请求数量上限，并阅读平台条款。

## 2026-09-29 更新：分享链接与防护

前端 Pages 发布不会自动更新 Worker。在 Cloudflare 的该 Worker → Edit code 中，用 `workers/netease-importer.js` 的完整内容替换并 Deploy。

部署包含绑定的完整配置：在项目目录运行 `npx wrangler deploy --config workers/wrangler.toml`（需 Cloudflare 登录）。或者在 Dashboard 添加 Rate limiting 绑定，名称 `IMPORT_LIMITER`，namespace ID `1001`，每 60 秒 5 次，然后重新部署。仅粘贴 JS 不会创建此绑定。

- 支持分享文字、163cn.tv HTTP 重定向、移动端完整歌单 URL；最多 5 次跳转，仅允许网易云域名，不转发用户凭证。若短链返回 HTML/脚本跳转，请在浏览器打开后复制地址。
- 每次只查询前 100 首的详情；响应包含原始数量和截断标记。
- POST JSON，请求体最多 4 KiB；导入和上游请求禁用缓存；上游请求超时 8/12 秒。
- 只向允许的网站 Origin 开放 CORS（GitHub Pages、本项目 Pages 预览域名、本地开发地址，也可用 `SITE_ORIGIN` 环境变量添加一个正式域名）；CORS 并非身份验证，非浏览器客户端仍可访问。
- 每 IP 每分钟最多 5 次。未配置绑定时只有实例内临时限流；绑定也不是全球精确额度计数。
- 网易云手动搜索最多返回 18 条，搜索词最多 120 字符；搜索和导入共用每 IP 每分钟 5 次的限额。搜索依赖网易云网页相关接口，不保证长期稳定。
- 此防护降低单次成本及重复查询，不保证防住分布式攻击。被拒绝的请求仍可能消耗 Workers 免费请求额度；在 Cloudflare 查看请求指标和用量告警，异常时可临时禁用 Worker。保持 Free 方案，不要为此自动升级付费。
