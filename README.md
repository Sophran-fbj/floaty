# Floaty

轻量级桌面悬浮便签。无边框置顶窗口，系统托盘管理，用完即走。

## 特性

- 富文本编辑（TipTap）— 格式、列表、任务清单
- 每个便签独立调节透明度、字体大小、置顶状态
- 窗口位置 & 尺寸自动记忆，DPI 适配
- 拖拽排序、回收站（7 天自动清理）
- 管理窗口集中查看，支持亮色 / 暗色主题
- 托盘常驻，关窗不退出

## 技术栈

Tauri 2 · React 19 · TipTap 3 · SQLite · Tailwind CSS 4 · shadcn/ui

## 开发

```bash
npm install
npm run tauri dev
```

需要 [Node.js](https://nodejs.org/) (LTS)、[Rust](https://www.rust-lang.org/tools/install) 和 [Tauri 2 前置依赖](https://tauri.app/start/prerequisites/)。

## 构建

```bash
npm run tauri build
```

## License

MIT
