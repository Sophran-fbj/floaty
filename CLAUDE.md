# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Floaty 是一个桌面悬浮便签应用，使用 Tauri 2 + React 19 + Rust 构建。每个便签是一个独立的无边框置顶窗口，通过系统托盘管理（无管理窗口）。

## Common Commands

```bash
# 开发
npm run tauri dev          # 启动完整 Tauri 应用（前端 + Rust 后端），带 HMR
npm run dev                # 仅启动前端 Vite 开发服务器（端口 1420）

# 构建
npm run tauri build        # 构建生产版本桌面应用
npm run build              # 仅构建前端（tsc 类型检查 + vite build）

# 测试
npx vitest run             # 运行一次前端测试
npx vitest run <file>      # 运行单个测试文件

# Rust
cd src-tauri && cargo build    # 编译 Rust 后端
cd src-tauri && cargo check    # 快速类型检查（不生成产物）
cd src-tauri && cargo clippy   # Rust lint
```

## Architecture

### 单窗口类型 + 系统托盘

```
前端 (React/TypeScript)              后端 (Rust/Tauri)
┌─────────────────────┐              ┌──────────────────────┐
│  App.tsx             │              │  lib.rs              │
│  └── NoteWindow      │   invoke()   │  ├── commands/       │
│      ├── TitleBar    │◄────────────►│  │   ├── notes.rs    │
│      ├── NoteEditor  │              │  │   └── windows.rs  │
│      └── NoteToolbar │              │  ├── db/             │
│                      │              │  │   └── notes.rs    │
│  无状态管理库         │              │  ├── state.rs        │
│  (直接 invoke)       │              │  └── tray.rs         │
└─────────────────────┘              └──────────────────────┘
                                              │
                                         SQLite (WAL)
```

- **无全局状态管理**：没有 Zustand/Redux，每个窗口用 `useState` + 直接 `invoke()` 调用后端
- **窗口路由**：`App.tsx` 读取 URL 参数 `?id=<uuid>` 渲染对应便签，无其他路由
- **所有窗口动态创建**：`tauri.conf.json` 中 `windows: []`，由 Rust 端按需创建
- **编辑器是内容源头**：`update_note` 返回 `()` 而不是 Note，防止后端数据覆盖编辑器状态
- **窗口属性**：无边框（`decorations: false`）、始终置顶（`always_on_top: true`）、不显示在任务栏（`skip_taskbar: true`）、初始隐藏（前端渲染完成后调用 `show_note_window`）
- **退出策略**：`RunEvent::ExitRequested` 中 `api.prevent_exit()`，关闭所有窗口后应用仍在托盘运行

### Tauri Commands

便签 CRUD: `create_note`, `get_note`, `update_note`, `delete_note`
窗口管理: `open_note_window`, `show_note_window`, `close_note_window`, `delete_note_and_close`

`get_all_notes` 仅在 Rust 内部使用（托盘的"显示全部"/"隐藏全部"），未注册为 command。

### 系统托盘

- 左键点击托盘图标 → 新建便签
- 菜单项：新建便签 / 显示全部 / 隐藏全部 / 退出
- "显示全部"会为 DB 中所有 note 创建窗口并设 `is_visible=true`
- "隐藏全部"仅隐藏窗口，不修改 DB 中的 `is_visible`

### 数据库

单表 `notes`，SQLite WAL 模式，位于 Tauri app data 目录下 `floaty.db`。便签内容以 TipTap JSON 格式存储在 `content` 字段。启动时通过 `ALTER TABLE ADD COLUMN` 兼容旧 schema。

### 关键技术栈

- **富文本编辑器**：TipTap 3（StarterKit + Underline + TaskList/TaskItem + 自定义扩展）
- **自定义 TipTap 扩展**：`ListBackspace`（列表行首 Backspace 转为段落而非合并上一行）、`CleanTrailingEmpty`（自动清理尾部空段落）
- **UI 组件库**：shadcn/ui (New York 风格)，路径别名 `@/components/ui/`
- **样式**：Tailwind CSS 4，注意 Tailwind preflight 会重置 HTML 元素默认样式（如 `list-style: none`），TipTap 编辑器内需手动恢复
- **窗口拖拽**：使用 `appWindow.startDragging()` API（`data-tauri-drag-region` 在 Windows WebView2 上不可靠）
- **DPI 处理**：`onMoved`/`onResized` 返回物理像素，存 DB 前需除以 `scaleFactor` 转为逻辑像素

### 重要设计决策

1. **update_note 返回 void**：防止 stale data 覆盖编辑器内容（之前的核心 bug）
2. **内容保存 debounce 500ms + fire-and-forget**：编辑器是唯一的内容 source of truth
3. **窗口初始隐藏**：避免渲染闪烁，前端 `requestAnimationFrame` 后调 `show_note_window`
4. **move/resize 监听延迟 500ms 注册**：跳过窗口初始定位事件

## Path Alias

TypeScript 和 Vite 均配置了 `@/` → `./src/` 的路径别名。
