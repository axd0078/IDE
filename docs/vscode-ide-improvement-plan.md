# VS Code 风格 IDE 改进计划清单

本文档记录当前 IDE 的 5 个改进项、建议编码顺序、涉及文件和验证流程。项目当前是 Electron + React + Vite，主进程在 `src/main/index.ts`，渲染进程入口在 `src/App.tsx`，编辑器状态集中在 `src/store/useEditorStore.ts`。

## 总体编码流程

- [ ] 先建立基线：运行 `npm run build`，确认当前 TypeScript 和打包状态。
- [ ] 按“主进程能力 -> preload API -> store 状态 -> React UI -> CSS 细节”的顺序改动，避免前端直接依赖 Electron 内部对象。
- [ ] 每完成一个功能点后运行一次 `npm run build`，最后用 `npm run dev` 手动验证完整流程。
- [ ] 所有新增 IPC 通道都只暴露必要能力，保持 `contextIsolation: true` 和 `nodeIntegration: false`。
- [ ] 中文菜单和界面文本顺手修正乱码，避免后续验证时误判菜单项。

## 1. 打开文件后支持鼠标滚轮下滑

### 现状

- 编辑器使用 `@uiw/react-codemirror`，文件在 `src/components/EditorPanel/CodeEditor.tsx`。
- 样式在 `src/components/EditorPanel/CodeEditor.module.css` 和 `src/components/EditorPanel/EditorPanel.module.css`。
- 当前多层容器使用 `height: 100%` 和 `overflow: hidden`，CodeMirror 的 `.cm-scroller` 虽设置了 `overflow: auto`，但高度链路需要确认并固定。

### 编码清单

- [ ] 在 `CodeEditor.module.css` 中确保 `.editor`、`.cm-editor`、`.cm-scroller` 都有稳定高度。
- [ ] 将 CodeMirror 根节点设置为 `height: 100%`，必要时通过 `style={{ height: '100%' }}` 或 `EditorView.theme` 固定内部滚动容器。
- [ ] 保留编辑器外层 `overflow: hidden`，滚动只发生在 `.cm-scroller`，避免页面整体滚动。
- [ ] 用长文件验证鼠标滚轮、拖动滚动条、键盘 PageDown 都正常。

### 验证

- [ ] 打开超过一屏的 `.c`、`.cpp` 或文本文件。
- [ ] 鼠标滚轮可以下滑到底部。
- [ ] 切换 Tab 后滚动区域不丢失、不影响侧栏滚动。

## 2. 软件启动后恢复上一次打开的工作区

### 现状

- 打开文件夹逻辑在 `src/main/index.ts` 的 `open-folder` IPC。
- 文件树和当前工作区路径存在 `src/store/useEditorStore.ts` 的 `folderPath`、`fileTree`。
- 目前没有持久化工作区路径，应用重启后进入空状态。

### 编码清单

- [ ] 在主进程新增工作区记录文件，例如 `app.getPath('userData')/workspace.json`。
- [ ] 打开文件夹成功后，把 `folderPath` 写入该记录文件。
- [ ] 新增 IPC：`get-last-workspace`，启动时读取上一次路径并检查目录是否仍存在。
- [ ] 新增或复用 `scan-folder`，恢复时重新扫描目录树，不复用旧树缓存。
- [ ] 在 `src/preload/index.ts` 暴露 `getLastWorkspace`。
- [ ] 在 `src/store/useEditorStore.ts` 增加 `restoreLastWorkspace` 方法，负责设置 `folderPath`、`fileTree`、一级目录展开状态和文件监听。
- [ ] 在 `src/App.tsx` 首次挂载时调用 `restoreLastWorkspace`。
- [ ] 如果上次目录不存在，静默忽略并停留在欢迎页，不弹错误。

### 验证

- [ ] 打开一个工作区，退出应用后重新启动，侧栏自动显示该工作区。
- [ ] 删除或移动上次工作区后启动，应用不崩溃。
- [ ] 恢复工作区后新增、删除文件仍能触发文件树刷新。

## 3. 从“视图”菜单移除开发者工具

### 现状

- `src/main/index.ts` 的菜单模板中存在 `{ role: 'toggleDevTools' }`。
- 当前菜单文本存在编码乱码，建议同次修正为正常中文。

### 编码清单

- [ ] 删除“视图”菜单里的 `toggleDevTools` 菜单项。
- [ ] 保留必要的普通用户菜单，例如重新加载也应谨慎；如果面向最终用户，建议移除 `reload` 或仅开发环境显示。
- [ ] 在生产环境禁用常见 DevTools 快捷键，例如 `F12`、`Ctrl+Shift+I`、`Cmd+Opt+I`。
- [ ] 确认 `preload` 只暴露文件读写、工作区恢复、监听和保存确认等必要 API，不暴露 Node、Electron 后端对象。

### 验证

- [ ] 启动应用，“视图”菜单不再出现“开发者工具”。
- [ ] 生产包中按 F12 或 Ctrl+Shift+I 不会打开开发者工具。
- [ ] 文件打开、保存、工作区恢复功能不受影响。

## 4. 有未保存修改时关闭软件前提示一次

### 现状

- Tab 的脏状态在 `src/store/types.ts` 的 `OpenTab.isDirty`。
- 保存逻辑在 `src/store/useEditorStore.ts` 的 `saveFile`。
- 目前关闭窗口时主进程直接退出，没有读取未保存状态。

### 编码清单

- [ ] 在 store 中新增 `hasDirtyTabs` selector 或方法，基于 `openTabs.some(tab => tab.isDirty)`。
- [ ] 新增保存所有脏文件的方法 `saveAllDirtyFiles`，关闭前选择保存时使用，不只保存当前激活文件。
- [ ] 渲染进程通过 IPC 把当前是否有未保存修改同步给主进程，例如 `set-dirty-state`。
- [ ] 主进程监听 `BrowserWindow` 的 `close` 事件；当存在未保存修改时 `event.preventDefault()`，只弹一次确认框。
- [ ] 确认框建议三个按钮：`保存并退出`、`不保存退出`、`取消`。
- [ ] 用户选择 `保存并退出` 时，主进程通知渲染进程执行 `saveAllDirtyFiles`，保存完成后再关闭窗口。
- [ ] 用户选择 `不保存退出` 时设置 `isQuitting = true`，再关闭窗口，避免重复弹框。
- [ ] 用户选择 `取消` 时保持窗口打开。

### 验证

- [ ] 修改一个文件后直接关闭窗口，只出现一次提示。
- [ ] 选择取消，窗口继续存在，Tab 仍显示未保存状态。
- [ ] 选择不保存退出，应用退出，文件内容不写入磁盘。
- [ ] 选择保存并退出，应用退出，重新打开文件后内容已保存。
- [ ] 多个脏 Tab 时能保存所有修改。

## 5. 前端改成 VS Code 简约风格，不使用图标

### 现状

- 侧栏和文件树中有 emoji 或乱码图标：`src/components/Sidebar/Sidebar.tsx`、`src/components/Sidebar/FileTree.tsx`、`src/components/EditorPanel/TabBar.tsx`。
- 现有配色已接近 VS Code 深色主题，但部分控件仍有图标和乱码文本。

### 编码清单

- [ ] 移除 Activity Bar 中的图标区域，或改成纯文本窄栏；如果只保留资源管理器，则可以直接取消 Activity Bar。
- [ ] 文件树不显示文件夹/文件 emoji 图标，只保留展开箭头、文件名和未保存/已打开状态。
- [ ] Tab 关闭按钮使用纯文本 `x`，未保存状态保留小圆点即可。
- [ ] 修复所有乱码中文文案，包括菜单、资源管理器标题、空状态按钮。
- [ ] 调整 CSS 到更简约的 VS Code 风格：低对比边框、紧凑行高、少阴影、少圆角、不使用装饰图形。
- [ ] 保持布局密度：侧栏宽度、Tab 高度、状态栏高度沿用当前变量，必要时只做小幅调整。

### 验证

- [ ] 启动后第一屏是 IDE 本体，不出现装饰化欢迎页或大图标。
- [ ] 侧栏、文件树、Tab 栏没有 emoji 或图标。
- [ ] 文件名长时正确省略，不挤压关闭按钮。
- [ ] 侧栏滚动和编辑器滚动互不影响。

## 推荐实施顺序

- [ ] 第一步：修复菜单乱码，并移除开发者工具入口。
- [ ] 第二步：实现工作区路径持久化和启动恢复。
- [ ] 第三步：修复编辑器滚动高度链路。
- [ ] 第四步：实现未保存关闭确认和保存所有脏文件。
- [ ] 第五步：统一前端简约样式，去掉图标和乱码文案。
- [ ] 最后：运行 `npm run build`，再启动 `npm run dev` 手动回归全部流程。

## 可能涉及的文件

- [ ] `src/main/index.ts`：菜单、工作区持久化、关闭确认、IPC handlers。
- [ ] `src/preload/index.ts`：新增安全 IPC API。
- [ ] `src/store/types.ts`：新增 store 方法类型。
- [ ] `src/store/useEditorStore.ts`：恢复工作区、保存所有脏文件、脏状态同步。
- [ ] `src/App.tsx`：启动恢复工作区、监听关闭前保存请求。
- [ ] `src/components/EditorPanel/CodeEditor.tsx`：CodeMirror 高度和滚动配置。
- [ ] `src/components/EditorPanel/CodeEditor.module.css`：滚动容器样式。
- [ ] `src/components/Sidebar/Sidebar.tsx`：移除图标、修复文本。
- [ ] `src/components/Sidebar/FileTree.tsx`：移除文件/文件夹图标。
- [ ] `src/components/EditorPanel/TabBar.tsx`：关闭按钮和未保存标记简化。
- [ ] `src/index.css` 及各模块 CSS：统一 VS Code 简约视觉风格。
