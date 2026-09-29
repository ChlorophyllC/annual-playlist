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
- **从零开始或继续添加**：新建空白榜单；Apple / iTunes 搜索后人工选择；可选 Last.fm 搜索；自行填写作品名和图片。搜索来源和作品链接保存在数据中。Apple 搜索歌曲结果会带回所属专辑；切换到专辑榜时直接搜索专辑，所以两种榜单都能匹配封面和专辑信息。
- **排序**：先开启排序模式，再在预览或完整列表拖动；支持勾选多项一起移动、触屏把手、边缘滚动。普通模式可选择／复制文字。歌曲榜和专辑榜独立保存次序。
- **两种主题**：米白封面画廊、撞色年度杂志。杂志可选四组配色，或用颜色选择器自行设置；浏览器支持 EyeDropper 时可从屏幕取强调色。
- **直接改字**：点击预览文字编辑，Enter 完成，Esc 撤回本次修改。修改名次文字不改变顺序，可恢复当前类型的默认文字。
- **封面**：1:1 完整显示或居中填满；与输出比例独立。上传图片或使用可下载的封面 URL，按作品保存覆盖，不混改同专辑里的其他歌曲。
- **纯文字主题图**：选择「画面内容 → 纯文字 · 保留主题」，隐藏封面并重新排版；竖版／方形每页 24 条，横版 36 条。仍有标题、排名、署名和主题颜色。另可下载 UTF-8 TXT。
- **图片导出**：PNG／JPG；3:4、1:1、16:9；长边 1600／3200 px；当前页或全部分页 ZIP。封面无法取得时保留空位并说明，不阻止保存。

## 保存与图片一致性

草稿和图片保存在浏览器 IndexedDB，排版偏好使用 localStorage，兼容迁移早期 localStorage 草稿。存储失败会提示下载备份。

工程格式为版本化 JSON：`*.annual.json`。点击「下载工程文件」会打包当前榜单（包括示例或手动榜单）、文字覆盖、两种榜单次序、配色和封面图片内容。图片以 data URL 内嵌，远程来源 URL 作为追踪信息保留。文件不是只保存 Last.fm 链接，因此完整缓存后重新打开不依赖原站、URL、账号或网络。工程导入恢复内嵌图片，不重新搜索匹配。

未成功取得的封面以空位保存，记录 `missingCovers` 和来源，其他内容仍可恢复。用户上传图片与手动添加时下载成功的封面立即归档。上传图片最长边缩小到 1600px，PNG 编码；输入文件最大 20MB，工程文件最大 200MB。工程文件包含私人文字和图片，请自行决定是否分享。

## 本地与 Pages 的区别

| 能力 | 本地服务 | GitHub Pages 静态版 |
| --- | --- | --- |
| 编辑、排序、颜色、工程文件、导出 | 支持 | 支持 |
| Apple / iTunes 手动搜索和文本逐行匹配 | 支持 | 支持 |
| 自填条目、上传图片 | 支持 | 支持 |
| 网易云链接导入 | 支持；也可部署 Worker | 已连接 annual-playlist-netease.cookie4830.workers.dev |
| Last.fm 搜索 | 设置 `LASTFM_API_KEY` 后支持 | 需独立后端；否则手动填写 |
| 下载远程封面 | 限定来源的后端 + 直接请求回退 | 依赖来源 CORS；失败时可上传 |

API key 只能放服务端环境变量，不提交到 GitHub。静态版不是通过代理公共未知服务绕过平台限制。后续如果部署独立后端，需要补齐 CORS、HTTPS、限速和运维配置；仅设置地址不代表完整部署。

## 实现结构

- `design.js`：榜单派生、编辑、主题预览与 UI 同步。
- `themes.js`、`styles.css`：可扩展主题与布局。
- `albums.js`、`sorting.js`：专辑合并和排序。
- `assets.js`、`project.js`：IndexedDB、图片归档与工程格式。
- `manual.js`：搜索和手动添加。
- `export.js`：基于浏览器测量结果直接 Canvas 绘制，无 SVG foreignObject；适配 Chromium 和 WebKit。下载不包含编辑控件。
- `server.py`：本地网易云／Last.fm 接口和限定图片来源代理。
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

Chromium 与 WebKit 回归覆盖：两主题、三比例、PNG/JPG、四页 ZIP、图片位置和像素检查、歌曲／专辑、纯文字海报、手动新建、用户上传、配色、IndexedDB 恢复、工程文件离线重开、缺封面仍保存、TXT。未单独验证 Safari 发布版和 Firefox。Last.fm 在线搜索需用户自己的 key，未对真实 key 运行测试。

## JavaScript Worker（网易云）

`workers/netease-importer.js` 是不依赖 Python 的 Cloudflare Worker：同样读取完整 `trackIds`，分批查询歌曲详情，返回与本地接口相同的数据结构。当前线上页面默认连接 `https://annual-playlist-netease.cookie4830.workers.dev`；其他部署可在浏览器控制台设置 `localStorage.setItem('annual-playlist:backend', 'https://你的-worker.workers.dev')`。部署前要配置 Worker 的 CORS、频率限制、请求数量上限，并确认网易云接口和平台条款允许你的使用场景。Worker 不保存用户歌单或 API key。

## 后续

评分、9:16、长图、自定义裁切焦点和 Live 动效尚未实现。长名称按当前排版省略；不同设备的系统字体可能不同。平台接口及条款可能变化。

### 导入与移动端修复（2026-09-29）

左侧六组设置默认折叠。网易云导入支持分享文字和短链接，每次前 100 首；重新导入会替换草稿、恢复该榜单原始排序及文字。清除本地记录删除项目、内嵌封面、文字、排序和设计设置，保留后端连接配置；不清除同域其他应用或浏览器全局 HTTP 缓存。Worker 必须单独更新，具体限流绑定和安全边界见 `workers/README.md`。
