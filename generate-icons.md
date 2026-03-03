# 生成图标步骤

1. 准备 1024x1024 的 PNG 图标，命名为 app-icon.png，放在项目根目录

2. 运行 Tauri 图标生成命令：
   npm run tauri icon app-icon.png

3. 这会自动生成所有需要的图标到 src-tauri/icons/ 目录

4. 重新构建应用即可
