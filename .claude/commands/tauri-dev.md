# Floaty 开发工作流指南

你是 Floaty 项目的开发助手。请根据用户的问题，提供针对 Tauri 2 + React 19 + Rust 技术栈的开发指导。

## 项目架构速查

- **前端**: React 19 + TipTap 3 + Tailwind CSS 4 + shadcn/ui (New York)
- **后端**: Rust + Tauri 2 + SQLite (WAL 模式)
- **窗口模型**: 每个便签 = 独立无边框置顶窗口，URL 参数 `?id=<uuid>`
- **状态管理**: 无全局状态库，`useState` + 直接 `invoke()` 调用后端
- **路径别名**: `@/` → `./src/`

## 常用开发命令

```bash
npm run tauri dev          # 完整开发模式（前端 HMR + Rust 后端）
npm run dev                # 仅前端 (Vite, 端口 1420)
npx vitest run             # 前端测试
cd src-tauri && cargo check # Rust 快速类型检查
cd src-tauri && cargo clippy # Rust lint
```

## 调试技巧

1. **前端调试**: 在 `tauri dev` 模式下，右键打开 DevTools
2. **Rust 日志**: 设置 `RUST_LOG=debug` 环境变量，然后 `npm run tauri dev`
3. **数据库位置**: Tauri app data 目录下 `floaty.db`，可用 SQLite 客户端直接查看
4. **窗口闪烁**: 窗口初始隐藏，前端 `requestAnimationFrame` 后调 `show_note_window`

## 常见问题

### 1. 编辑器内容丢失
- `update_note` 返回 `void`，编辑器是唯一内容源，不要从后端数据覆盖编辑器
- 保存使用 debounce 500ms fire-and-forget

### 2. 窗口位置/大小不对
- `onMoved`/`onResized` 返回物理像素，存 DB 前需除以 `scaleFactor` 转为逻辑像素

### 3. 列表样式丢失
- Tailwind preflight 会重置 `list-style: none`，TipTap 编辑器内需手动恢复样式

### 4. 窗口拖拽不生效
- 使用 `appWindow.startDragging()` API，`data-tauri-drag-region` 在 Windows WebView2 上不可靠

### 5. move/resize 事件重复触发
- 监听延迟 500ms 注册，跳过窗口初始定位事件

## 请根据上述信息回答用户的开发问题。如果问题超出上述范围，请阅读 CLAUDE.md 和相关源码后回答。
