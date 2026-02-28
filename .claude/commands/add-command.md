# 新增 Tauri Command 全栈脚手架

帮助用户新增一个 Tauri command，按照 Floaty 项目约定完成前后端全部步骤。

## 请用户提供

1. **Command 名称**（snake_case，如 `pin_note`）
2. **功能描述**（做什么）
3. **参数列表**（名称 + 类型）
4. **返回值类型**（如果修改了便签内容，必须返回 `()` 而非 Note）

## 实施步骤

### 1. Rust 后端

**a) 数据库层** (如果涉及数据持久化)
- 文件: `src-tauri/src/db/notes.rs`
- 添加数据库操作函数
- 使用参数化 SQL，防止注入

**b) Command 函数**
- 文件: `src-tauri/src/commands/notes.rs` 或 `commands/windows.rs`
- 遵循现有的错误处理模式
- 通过 `State<AppState>` 获取数据库连接

```rust
#[tauri::command]
pub async fn command_name(
    state: State<'_, AppState>,
    // 参数...
) -> Result<ReturnType, String> {
    // 实现...
}
```

**c) 注册 Command**
- 文件: `src-tauri/src/lib.rs`
- 在 `invoke_handler(tauri::generate_handler![...])` 中添加新 command

### 2. TypeScript 前端

**a) 类型定义** (如果有新的数据结构)
- 文件: `src/types/note.ts`

**b) 调用 Command**
- 使用 `invoke("command_name", { param1, param2 })` 直接调用
- 不要创建全局状态，直接在组件内使用 `useState` + `invoke`

### 3. 验证

- `cd src-tauri && cargo check` — 确认编译通过
- `cd src-tauri && cargo clippy` — 确认无 lint 警告
- `npx tsc --noEmit` — 确认 TypeScript 类型正确

## 关键约定提醒

- ⚠️ 如果 command 修改了便签内容，**必须返回 `()`**，不返回 Note 对象
- ⚠️ 窗口操作后保持初始隐藏，由前端控制显示时机
- ⚠️ 涉及窗口位置/大小时注意 DPI 缩放（物理像素 → 逻辑像素）

## 现在请告诉我你要新增什么 command，我来帮你完成全栈实现。
