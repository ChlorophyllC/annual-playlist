# 年度歌单 · Annual Playlist

整理歌曲／专辑榜单，制作封面海报或紧凑的纯文字主题图。支持导入网易云歌单、手动搜索添加、排序、图片替换和离线工程备份。

## 使用

本地需要 Python 3 与 curl，不需要安装运行依赖：

```bash
python3 server.py
```

打开 <http://127.0.0.1:8000>。公开静态版本的部署方法见 [DEPLOYMENT.md](DEPLOYMENT.md)。拟发布到独立仓库 `ChlorophyllC/annual-playlist`，项目 Pages 地址为 `https://chlorophyllc.github.io/annual-playlist/`，不改变个人站主页。

## 已支持

- **歌曲榜／专辑榜**：歌曲提取专辑时按专辑 ID 合并，保留首次出现顺序；同名不同版本不混合。音乐人优先用专辑署名，否则提示使用已导入歌曲的署名。
- **已有歌单**：网易云链接 → 完整 trackIds → 分批取得歌曲详情。无法匹配的歌曲保留；缺少专辑信息的歌曲在专辑榜下方列出。还支持粘贴纯文本歌单，每行逐一查询 Apple Music，默认取第一个结果并提示未匹配行。
- **从零开始或继续添加**：新建空白榜单；Apple / iTunes、网易云搜索后人工选择；自行填写作品名和图片。搜索来源和作品链接保存在数据中。Apple 搜索歌曲结果会带回所属专辑；切换到专辑榜时直接搜索专辑，所以两种榜单都能匹配封面和专辑信息。
- **排序**：先开启排序模式，再在预览或完整列表拖动；支持勾选多项一起移动、触屏把手、边缘滚动。普通模式可选择／复制文字。歌曲榜和专辑榜独立保存次序。
- **两种主题**：米白封面画廊、撞色年度杂志。杂志可选四组配色，或用颜色选择器自行设置；浏览器支持 EyeDropper 时可从屏幕取强调色。
- **直接改字**：点击预览文字编辑，Enter 完成，Esc 撤回本次修改。修改名次文字不改变顺序，可恢复当前类型的默认文字。
- **封面**：1:1 完整显示或居中填满；与输出比例独立。上传图片或使用可下载的封面 URL，按作品保存覆盖，不混改同专辑里的其他歌曲。
- **纯文字主题图**：选择「画面内容 → 纯文字 · 保留主题」，隐藏封面并重新排版；竖版／方形每页 24 条，横版 36 条。仍有标题、排名、署名和主题颜色。另可下载 UTF-8 TXT。
- **图片导出**：PNG／JPG；3:4、1:1、16:9；长边 1600／3200 px；当前页或全部分页 ZIP。封面无法取得时保留空位并说明，不阻止保存。

## 保存与图片一致性

草稿和图片保存在浏览器 IndexedDB，排版偏好使用 localStorage，兼容迁移早期 localStorage 草稿。存储失败会提示下载备份。

工程文件采用 `.annual.zip`：`project.json` 保存榜单、文字、评分、排序和主题设置，用户上传或手动替换的图片单独放在 `assets/`，不嵌入 JSON。Apple、网易云等远程封面只保存图片链接，重新打开时由浏览器按链接加载，不会为了导出而批量下载或缓存远程封面。旧版 `.annual.json` 仍可导入。

本地自动保存仍将当前项目和用户上传图片保存在浏览器 IndexedDB，以便刷新后恢复；应用封面 URL 时仅记录链接。上传图片最长边缩小到 1600px、PNG 编码；单张输入最大 20MB，导入 ZIP 最大 100MB。工程文件可能含私人文字和用户图片，请自行决定是否分享。
## 本地与 Pages 的区别

| 能力 | 本地服务 | GitHub Pages 静态版 |
| --- | --- | --- |
| 编辑、排序、颜色、工程文件、导出 | 支持 | 支持 |
| Apple / iTunes 手动搜索和文本逐行匹配 | 支持 | 支持 |
| 自填条目、上传图片 | 支持 | 支持 |
| 网易云歌单导入与手动搜索 | 本地服务或 Worker | 本地自动使用 `server.py`，Pages 使用已配置 Worker |
| 下载远程封面 | 限定来源的后端 + 直接请求回退 | 依赖来源 CORS；失败时可上传 |

API key 只能放服务端环境变量，不提交到 GitHub。静态版不是通过代理公共未知服务绕过平台限制。后续如果部署独立后端，需要补齐 CORS、HTTPS、限速和运维配置；仅设置地址不代表完整部署。

## 实现结构

- `design.js`：榜单派生、编辑、主题预览与 UI 同步。
- `themes.js`、`styles.css`：可扩展主题与布局。
- `albums.js`、`sorting.js`：专辑合并和排序。
- `assets.js`、`project.js`：IndexedDB、图片归档与工程格式。
- `manual.js`：搜索和手动添加。
- `export.js`：基于浏览器测量结果直接 Canvas 绘制，无 SVG foreignObject；适配 Chromium 和 WebKit。下载不包含编辑控件。
- `server.py`：本地网易云接口和限定图片来源代理。
- `scripts/build_pages.py`：构建纯静态 `dist/`；`.github/workflows/pages.yml` 发布。

目前没有运行时第三方 JS 包。代码采用 [MIT](LICENSE)，封面与音乐元数据不包含在该授权中。来源、隐私、平台使用边界见 [LEGAL.md](LEGAL.md)。

## 验证

可选开发测试：

```bash
python3 -m venv .venv
.venv/bin/pip install playwright
.venv/bin/playwright install chromium webkit
# 先启动本地服务，再执行：
.venv/bin/python tests/export_browser.py
.venv/bin/python tests/features_browser.py
```

已实测 SOTY 2026：39 个 ID 全部匹配；默认歌单详情只有 10 首。实际 Apple 搜索返回候选并成功加入／缓存专辑。

Chromium 与 WebKit 回归覆盖：两主题、三比例、PNG/JPG、四页 ZIP、图片位置和像素检查、歌曲／专辑、纯文字海报、手动新建、用户上传、配色、IndexedDB 恢复、工程文件离线重开、缺封面仍保存、TXT。未单独验证 Safari 发布版和 Firefox。

## 开发与版本管理

从 `v1.0.0` 开始维护版本日志，具体记录见 [CHANGELOG.md](CHANGELOG.md)。此前的提交历史不回溯整理。

- `develop` 用于日常开发。修复、小幅样式调整和实验性改动先在这里提交。
- `main` 只保留可发布状态，并继续作为 GitHub Pages 的发布分支。
- 主题更新、重大 bug 修复和新功能完成后，先更新 `CHANGELOG.md`，再将 `develop` 合并到 `main`。
- 正式版本使用语义化版本号：破坏性变更递增主版本，功能更新递增次版本，兼容性修复递增补丁版本；发布时创建对应的 `vX.Y.Z` 标签。

日常流程：

```bash
git switch develop
git add <files>
git commit -m "Describe the change"

# 准备发布时
git switch main
git merge --no-ff develop
git tag v1.1.0
git push origin main --tags
git switch develop
```

## JavaScript Worker（网易云）

`workers/netease-importer.js` 是不依赖 Python 的 Cloudflare Worker：读取歌单完整 `trackIds` 并分批查询详情，也代理歌曲／专辑候选搜索。当前线上页面默认连接 `https://annual-playlist-netease.cookie4830.workers.dev`；其他部署可在浏览器控制台设置 `localStorage.setItem('annual-playlist:backend', 'https://你的-worker.workers.dev')`。部署前要配置 Worker 的 CORS、频率限制、请求数量上限，并确认网易云网页接口和平台条款允许你的使用场景。网易云搜索使用的是网页相关接口，不是承诺稳定的开放 API，结果字段或可用性可能变化。Worker 不保存用户歌单或 API key。

## 后续

评分、9:16、长图、自定义裁切焦点和 Live 动效尚未实现。长名称按当前排版省略；不同设备的系统字体可能不同。平台接口及条款可能变化。

### 导入与移动端修复（2026-09-29）

左侧六组设置默认折叠。网易云导入支持分享文字和短链接，可填写起止位置，每次最多 100 首，也可以逐页追加到当前榜单。重新导入第一段会替换草稿；继续导入下一页会追加条目。清除本地记录删除项目、内嵌封面、文字、排序和设计设置，保留后端连接配置；不清除同域其他应用或浏览器全局 HTTP 缓存。Worker 必须单独更新，具体限流绑定和安全边界见 `workers/README.md`。

## 匿名访问统计

页面预留了 Cloudflare Web Analytics。要启用统计，请在 Cloudflare Web Analytics 创建站点，将生成的 token 填入 `index.html` 中 `window.ANNUAL_PLAYLIST_ANALYTICS_TOKEN` 的空字符串。统计仅用于访问量、设备、来源和地区等汇总信息，不发送歌单内容、搜索词、图片或工程文件。
