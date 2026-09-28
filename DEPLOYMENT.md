# 部署到独立 GitHub Pages 项目

推荐仓库：`ChlorophyllC/annual-playlist`。GitHub 项目页面默认 URL 为 **https://chlorophyllc.github.io/annual-playlist/**；这是个人站域名下的子路径，不会改变 `chlorophyllc.github.io` 仓库或根首页。无需修改用户主页仓库。

## 本项目发布流程

1. 使用 GitHub CLI 登录：`gh auth login --hostname github.com --git-protocol https --web`。不要将 token 写入代码或提交到仓库。
2. 将本目录初始化为 Git 仓库，并将 main 分支推送到新建的公开 `annual-playlist` 仓库。
3. 仓库 Settings → Pages → Source 选择 **GitHub Actions**。
4. 运行 `.github/workflows/pages.yml`，它执行 `python scripts/build_pages.py`，只发布 `dist/` 中的静态文件。
5. 发布成功后访问上方子路径。项目所有脚本和样稿均使用相对路径，可在子目录加载。

源码仓库可以包含本地 Python 服务和测试；Pages 网站发布产物明确排除它们。`.gitignore` 排除 `.env`、工程文件和本地缓存。`server.py` 不包含 API key。

## 功能边界

Pages 不运行 Python。公开页面支持 Apple / iTunes 手动搜索、自行填写、上传图片、工程文件、主题编辑和所有本地导出。网易云链接导入已连接你部署的 Cloudflare Worker；Last.fm API 搜索仍仅在本地后端或另行部署服务可用时启用。其他图片站点的跨域限制可能阻止下载，此时可手动上传。

本地运行 `python3 server.py`。如需 Last.fm 搜索，在自己的终端环境设置 `LASTFM_API_KEY`；不要提交它。未配置时，搜索界面会解释原因。

另行部署后端属于后续工作：目前仅预留 `annual-playlist:backend` 配置键，跨站后端需先配置明确的 CORS 允许来源、HTTPS 和请求限速，不能只设置一个地址就视为部署完成。

## 当前状态

构建与浏览器测试已就绪，公开页面已连接 `https://annual-playlist-netease.cookie4830.workers.dev`。
