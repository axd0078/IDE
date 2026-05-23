# C IDE

C IDE 是一个基于 Electron、React、TypeScript 和 CodeMirror 的本地 C/C++ 学习型集成开发环境。项目包含桌面编辑器界面，以及一个面向教学场景的 C++ 子集编译器实验模块。

## 功能概览

- 基于 Electron 的桌面应用壳
- React + TypeScript 前端界面
- CodeMirror 代码编辑器与 C/C++ 高亮支持
- 本地文件树、编辑器标签页和状态栏
- 编译器实验模块，支持词法分析、语法分析、语义检查和 Windows x86-64 汇编生成

## 项目结构

```text
.
├── compiler/              # Python 编写的 C++ 子集编译器实验模块
├── docs/                  # 项目文档与改进计划
├── src/                   # Electron + React 应用源码
│   ├── components/        # UI 组件
│   ├── language/          # 编辑器语言能力
│   ├── main/              # Electron 主进程
│   ├── preload/           # Electron preload 脚本
│   └── store/             # 编辑器状态管理
├── electron.vite.config.ts
├── package.json
└── vite.config.ts
```

## 环境要求

- Node.js
- npm
- Python 3（仅运行 `compiler/` 模块时需要）

## 常用命令

安装依赖：

```powershell
npm install
```

启动开发环境：

```powershell
npm run dev
```

构建应用：

```powershell
npm run build
```

打包桌面应用：

```powershell
npm run package
```

## 编译器模块

编译器实验模块位于 `compiler/`，详细说明见 `compiler/README.md`。

生成汇编示例：

```powershell
cd compiler
python mycompiler.py -S input.cpp -o build\program.s
```

## 文档

- `docs/项目详细文档.md`
- `docs/vscode-ide-improvement-plan.md`
- `compiler/README.md`
