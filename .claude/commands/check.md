# 快速健康检查

对 Floaty 项目执行全面的健康检查，依次运行以下 5 项检测，汇总报告结果。

## 检查项目

请依次执行以下命令并报告结果：

### 1. TypeScript 类型检查
```bash
npx tsc --noEmit
```

### 2. Rust 编译检查
```bash
cd src-tauri && cargo check 2>&1
```

### 3. Rust Lint 检查
```bash
cd src-tauri && cargo clippy 2>&1
```

### 4. Rust 格式检查
```bash
cd src-tauri && cargo fmt --check 2>&1
```

### 5. 前端测试
```bash
npx vitest run 2>&1
```

## 输出格式

```
## Floaty 健康检查报告

| # | 检查项 | 状态 | 详情 |
|---|--------|------|------|
| 1 | TypeScript 类型检查 | ✅/❌ | ... |
| 2 | Rust 编译检查 | ✅/❌ | ... |
| 3 | Rust Lint (clippy) | ✅/❌ | ... |
| 4 | Rust 格式 (fmt) | ✅/❌ | ... |
| 5 | 前端测试 (vitest) | ✅/❌ | ... |

### 总结
X/5 项通过。[需要修复的问题摘要]
```

## 如果有失败项

- 给出具体的错误信息和修复建议
- 如果用户同意，直接修复简单问题（如格式化问题可直接 `cargo fmt`）
