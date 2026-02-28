# 新增 React 组件

帮助用户按照 Floaty 项目约定创建新的 React 组件。

## 请用户提供

1. **组件名称**（PascalCase，如 `ColorPicker`）
2. **功能描述**
3. **放置位置**（`components/` 下的子目录）

## 项目组件约定

### 目录结构

```
src/components/
├── ui/              # shadcn/ui 基础组件（通过 npx shadcn add 安装）
├── TitleBar/
│   └── TitleBar.tsx
├── NoteEditor/
│   └── NoteEditor.tsx
├── NoteToolbar/
│   └── NoteToolbar.tsx
└── ErrorBoundary.tsx
```

- **业务组件**: 放在 `src/components/<ComponentName>/` 目录下
- **页面组件**: 放在 `src/pages/` 下
- **UI 基础组件**: 通过 `npx shadcn add <component>` 安装到 `src/components/ui/`

### 组件模板

```tsx
import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";

// 使用 @/ 路径别名引入项目内模块
import { Button } from "@/components/ui/button";

interface ComponentNameProps {
  // props 定义
}

export function ComponentName({ ...props }: ComponentNameProps) {
  // 直接使用 useState + invoke，不用全局状态管理
  const [data, setData] = useState<SomeType>();

  const handleAction = async () => {
    const result = await invoke("some_command", { param: value });
    setData(result);
  };

  return (
    <div className="...">
      {/* Tailwind CSS 4 样式 */}
    </div>
  );
}
```

### 关键约定

1. **无全局状态**: 使用 `useState` + 直接 `invoke()` 调用后端
2. **路径别名**: 所有 import 使用 `@/` 前缀（如 `@/components/ui/button`）
3. **UI 库**: shadcn/ui New York 风格，组件在 `@/components/ui/`
4. **样式**: Tailwind CSS 4，注意 class 语法变化
5. **类型安全**: 所有 props 定义 TypeScript interface，避免 `any`
6. **窗口 API**: 拖拽用 `appWindow.startDragging()`，不用 `data-tauri-drag-region`
7. **函数组件**: 使用 `export function` 而非 `export default`

### 如果组件涉及 TipTap 编辑器

- 编辑器是内容唯一源，不要从后端数据覆盖编辑器状态
- Tailwind preflight 重置了 HTML 默认样式，编辑器内需手动恢复列表等样式
- 自定义扩展参考: `ListBackspace`、`CleanTrailingEmpty`

## 现在请告诉我你要创建什么组件，我来帮你实现。
