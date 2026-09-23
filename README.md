<div align="center">

<img src="build/to-do-panel-icon.png" alt="logo" width="112" height="112" />

# TO-DO Panel

**常驻 macOS / Windows 屏幕顶部的本地工作台。**

待办、随笔记、链接、录音与本机 AI 提醒，始终贴顶待命。

<p>
  <a href="#从源码运行"><strong>从源码运行</strong></a>
  ·
  <a href="#功能特性">功能特性</a>
  ·
  <a href="#技术栈">技术栈</a>
  ·
  <a href="#项目结构">项目结构</a>
  ·
  <a href="#更新日志">更新日志</a>
</p>

<p>
  <img alt="macOS 13+ Apple Silicon" src="https://img.shields.io/badge/macOS-13%2B%20Apple%20Silicon-111318?style=flat-square&logo=apple" />
  <img alt="Windows 10/11 x64" src="https://img.shields.io/badge/Windows-10%2F11%20x64-0078D4?style=flat-square" />
  <img alt="Electron 44" src="https://img.shields.io/badge/Electron-44-47848f?style=flat-square&logo=electron" />
  <img alt="License MIT" src="https://img.shields.io/badge/license-MIT-35c58b?style=flat-square" />
</p>

</div>

![首页](docs/screenshots/home.png)

![待办](docs/screenshots/todo.png)

## 它是什么

TO-DO Panel 是一个常驻 macOS / Windows 屏幕顶部的本地工作台。Mac 默认折叠成物理刘海大小；Windows 显示为贴顶的 200 × 38 逻辑像素悬浮条，避开顶部任务栏。点击后从顶部展开，包含首页、待办、笔记、链接、录制、密钥等页面。

数据全部保存在本机（LocalStorage 与工作区文件），无后端、无云同步。

## 下载

> 当前稳定版本：**1.1.2** · macOS 13.0+ Apple Silicon / Windows 10/11 x64

| 平台 | 下载 |
| --- | --- |
| macOS | [GitHub Releases 最新版（arm64.dmg）](https://github.com/yuexiangxu/TO-DO-Panel/releases/latest) |
| Windows | [GitHub Releases 最新版（x64-setup.exe）](https://github.com/yuexiangxu/TO-DO-Panel/releases/latest) |

推送与 `package.json` 版本一致的 `v*.*.*` 标签后，GitHub Actions 会构建并发布对应平台的安装包。

## ✨ 功能特性

| 页面 | 说明 |
| --- | --- |
| **首页** | 当前窗口、镜子、快速录音、随笔记、常用指令、汽水音乐与番茄钟集中在一个可拖拽的 Bento 工作台 |
| **待办** | 四个可改名的分类（默认 课程 / 自媒体&写作 / Vibe coding / 日常），回车即新增，默认当天 23:30，到期前一小时提醒 |
| **笔记** | Markdown 速记、归档、搜索、重命名与智能标题 |
| **链接** | 保存公开网址，后台补全标题、图标和分组（阻止本机、内网与不安全重定向） |
| **录制** | 录音即建记录，实时转写（可选百炼 Qwen3-ASR），页内配置 API |
| **密钥** | 账号密码与 API Key 经系统安全存储加密 |
| **剪贴板** | 默认关闭，可启用；历史由主进程轮询采集，图片不落 LocalStorage |
| **AI 提醒** | 接收 Codex / Claude Code / GPT 的本机完成事件，显示为不抢焦点的顶部提醒 |

隐私边界：镜子只有主动点击才开启，离开首页或收起立即释放摄像头；录音结束释放麦克风；链接抓取只允许公开 http/https。

## 🧱 技术栈

| 层 | 技术 |
| --- | --- |
| 🖥️ 桌面端 | Electron 44 · 原生 HTML / CSS / JavaScript（无渲染层构建步骤） |
| 🌐 官网 | React 19 · Vinext · 原生 CSS（`website/`） |
| 💾 数据 | LocalStorage + `userData/`（录音、剪贴板图片），无后端与云同步 |
| 📦 打包 | electron-builder（macOS DMG / Windows NSIS EXE） |

## 📁 项目结构

```text
.
├── main.js                 # Electron 主进程：窗口、定位、菜单栏、剪贴板、媒体与通知
├── main-services.js        # 可单测的纯领域服务（无 Electron 依赖）
├── preload.js              # contextBridge 安全桥接
├── renderer/               # 桌面界面与交互（HTML / CSS / JS）
├── build/                  # 打包钩子、entitlements 与应用图标
├── scripts/                # Codex / Claude Code 的通知转发脚本
├── tests/                  # Node 单元测试与渲染层检查
├── docs/                   # 设计说明、ADR 与验收图
└── website/                # 官网 React/Vinext 源码
```

## 🚀 从源码运行

桌面端要求 Node.js 18+：

```bash
git clone https://github.com/yuexiangxu/TO-DO-Panel.git
cd TO-DO-Panel
npm install
npm start
```

项目使用单一 Electron 架构，`npm start` 是唯一运行路径。

| 命令 | 用途 |
| --- | --- |
| `npm test` | 单元测试与 JavaScript 语法检查 |
| `npm start` | 启动 Electron 开发版 |
| `npm run pack` | 生成未安装的 `.app` |
| `npm run build` | 生成 Apple Silicon DMG（需用户确认） |
| `npm run build:win` | 生成 Windows x64 EXE 安装包 |
| `npm run build:zip` | 生成 ZIP 分发包 |

官网（`website/`）要求 Node.js 22.13.0+：

```bash
cd website
npm install
npm run dev
```

## 更新日志

当前稳定版本：**1.1.2**。完整版本历史、修复内容与未发布改动见 [CHANGELOG.md](CHANGELOG.md)。

## License

[MIT](LICENSE) © 2026 [yuexiangxu](https://github.com/yuexiangxu)
