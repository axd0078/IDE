/**
 * C IDE — Electron 主进程
 *
 * 职责：
 * 1. 创建和管理应用窗口
 * 2. 构建菜单栏（文件/编辑/运行）
 * 3. 处理所有 IPC 请求（文件读写、编译运行、编码检测等）
 * 4. 管理 Python 子进程（词法扫描器的常驻进程）
 * 5. 工作区持久化（记住上次打开的文件夹）
 *
 * 安全：渲染进程通过 contextBridge 只能调用预加载暴露的有限 API，
 * 不能直接访问 Node.js 或 Electron 内部对象。
 */

import { app, BrowserWindow, dialog, ipcMain, Menu } from 'electron';
import { join } from 'node:path';
import { readFileSync, readdirSync, writeFileSync, existsSync, mkdirSync, watch } from 'node:fs';
import { spawn, exec, ChildProcess } from 'node:child_process';
import { createInterface } from 'node:readline';
import * as iconv from 'iconv-lite';

// === 全局状态 ===

let mainWindow: BrowserWindow | null = null;
let isQuitting = false;   // 标记是否正在退出（跳过关闭确认）
let hasDirtyTabs = false;  // 是否有未保存的文件

// 工作区持久化文件路径：%APPDATA%/C IDE/workspace.json
const workspaceFile = join(app.getPath('userData'), 'workspace.json');

/** 保存当前工作区路径到磁盘 */
function saveWorkspace(folderPath: string): void {
  try {
    const dir = app.getPath('userData');
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    writeFileSync(workspaceFile, JSON.stringify({ folderPath }), 'utf-8');
  } catch { /* 写文件失败不阻塞用户操作 */ }
}

/** 从磁盘读取上次工作区路径。如果目录已不存在返回 null */
function loadWorkspace(): string | null {
  try {
    if (!existsSync(workspaceFile)) return null;
    const data = JSON.parse(readFileSync(workspaceFile, 'utf-8'));
    if (data.folderPath && existsSync(data.folderPath)) return data.folderPath;
    return null;
  } catch {
    return null;
  }
}

// === 窗口创建 ===

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    backgroundColor: '#1e1e1e',  // 窗口背景色（和编辑器一致，避免白屏）
    title: 'C IDE',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,   // 隔离渲染进程，不能直接访问 Node.js
      nodeIntegration: false,   // 禁止渲染进程使用 require
    },
    show: false,  // 先隐藏，等 ready-to-show 再显示，避免白屏闪烁
  });

  // 页面加载完成后才显示窗口
  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  // 拦截开发者工具快捷键（面向最终用户的发布版本不应暴露调试功能）
  mainWindow.webContents.on('before-input-event', (_event, input) => {
    if (input.key === 'F12') return _event.preventDefault();
    if ((input.control || input.meta) && input.shift && input.key.toLowerCase() === 'i') {
      return _event.preventDefault();
    }
  });

  // 构建菜单栏
  const menu = Menu.buildFromTemplate([
    {
      label: '文件',
      submenu: [
        {
          label: '打开文件夹...',
          accelerator: 'Ctrl+K Ctrl+O',
          // 菜单点击 → 通知渲染进程（主进程不直接操作 UI）
          click: () => mainWindow?.webContents.send('menu-open-folder'),
        },
        {
          label: '保存',
          accelerator: 'Ctrl+S',
          click: () => mainWindow?.webContents.send('menu-save'),
        },
        { type: 'separator' },
        { role: 'quit', label: '退出' },
      ],
    },
    {
      label: '编辑',
      submenu: [
        { role: 'undo', label: '撤销' },
        { role: 'redo', label: '重做' },
        { type: 'separator' },
        { role: 'cut', label: '剪切' },
        { role: 'copy', label: '复制' },
        { role: 'paste', label: '粘贴' },
      ],
    },
    {
      label: '运行',
      submenu: [
        {
          label: '编译生成 .s',     // 只编译，不运行
          accelerator: 'F7',
          click: () => mainWindow?.webContents.send('menu-compile'),
        },
        {
          label: '链接并运行',      // 编译 + gcc 链接 + 执行
          accelerator: 'F5',
          click: () => mainWindow?.webContents.send('menu-link-run'),
        },
      ],
    },
  ]);
  Menu.setApplicationMenu(menu);

  // 关闭窗口前检查是否有未保存文件
  mainWindow.on('close', (e) => {
    if (isQuitting) return;  // 已经在退出流程中，不重复弹框
    if (hasDirtyTabs) {
      e.preventDefault();  // 阻止直接关闭
      dialog.showMessageBox(mainWindow!, {
        type: 'warning',
        title: 'C IDE',
        message: '有未保存的修改',
        detail: '你有未保存的修改，是否要在关闭前保存？',
        buttons: ['保存并退出', '不保存退出', '取消'],
        defaultId: 0,
        cancelId: 2,
      }).then(({ response }) => {
        if (response === 0) {
          // 用户选择"保存并退出"→ 通知渲染进程执行保存，保存完再关
          mainWindow?.webContents.send('save-all-and-close');
        } else if (response === 1) {
          // 用户选择"不保存退出"→ 设置标志直接关闭
          isQuitting = true;
          mainWindow?.close();
        }
        // response === 2 → "取消" → 什么都不做
      });
    }
  });

  // 开发模式加载 Vite dev server URL，生产模式加载打包后的 HTML 文件
  if (process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'));
  }
}

// === 文件系统相关类型和函数 ===

interface FileNode {
  id: string;          // 文件/文件夹的绝对路径（也是唯一标识）
  name: string;        // 显示名称
  type: 'file' | 'folder';
  children?: FileNode[];
  language?: string;   // 文件语言类型（c/cpp/text）
}

/** 根据文件扩展名判断语言类型 */
function getLanguage(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'c': return 'c';
    case 'h': return 'c';
    case 'cpp': case 'cc': case 'cxx': return 'cpp';
    case 'hpp': case 'hxx': return 'cpp';
    default: return 'text';
  }
}

/**
 * 递归扫描目录，生成文件树
 * - 跳过以 . 开头的文件和 node_modules
 * - 文件夹排在文件前面，同类按名称排序
 */
function scanDirectory(dirPath: string): FileNode[] {
  const entries = readdirSync(dirPath, { withFileTypes: true });
  const nodes: FileNode[] = [];

  for (const entry of entries) {
    if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
    const fullPath = join(dirPath, entry.name);
    if (entry.isDirectory()) {
      nodes.push({
        id: fullPath,
        name: entry.name,
        type: 'folder',
        children: scanDirectory(fullPath),  // 递归扫描子目录
      });
    } else {
      nodes.push({
        id: fullPath,
        name: entry.name,
        type: 'file',
        language: getLanguage(entry.name),
      });
    }
  }

  // 排序：文件夹在前，同类按字母序
  nodes.sort((a, b) => {
    if (a.type !== b.type) return a.type === 'folder' ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  return nodes;
}

/**
 * 编码检测 + 解码
 *
 * 策略（按优先级）：
 * 1. 检查 BOM（文件头标记）→ 直接确定 UTF-8 / UTF-16 LE / UTF-16 BE
 * 2. 尝试 UTF-8 解码，如果没出现替换字符 � 则认为正确
 * 3. 回退到 GBK（中文 Windows 最常见的本地编码，能正确显示中文注释）
 * 4. 最后兜底 Latin-1（逐字节映射，永不失败，但中文会乱码）
 *
 * 用 iconv-lite 处理 GBK 和 UTF-16 BE（Node 内置不支持这两种）
 */
function detectAndDecode(buffer: Buffer): { text: string; encoding: string } {
  // 检查 BOM：文件开头的几个特殊字节标记了编码
  if (buffer[0] === 0xEF && buffer[1] === 0xBB && buffer[2] === 0xBF) {
    return { text: buffer.subarray(3).toString('utf-8'), encoding: 'UTF-8 BOM' };
  }
  if (buffer[0] === 0xFF && buffer[1] === 0xFE) {
    return { text: buffer.subarray(2).toString('utf16le'), encoding: 'UTF-16 LE' };
  }
  if (buffer[0] === 0xFE && buffer[1] === 0xFF) {
    return { text: iconv.decode(buffer.subarray(2), 'utf16-be'), encoding: 'UTF-16 BE' };
  }

  // 无 BOM → 试探 UTF-8
  const utf8 = buffer.toString('utf-8');
  if (!utf8.includes('�')) {
    return { text: utf8, encoding: 'UTF-8' };
  }

  // UTF-8 失败 → 尝试 GBK（中文 Windows 常见）
  try {
    const gbk = iconv.decode(buffer, 'gbk');
    return { text: gbk, encoding: 'GBK' };
  } catch { /* 如果 iconv 也失败，进入兜底 */ }

  // 最后兜底：Latin-1 逐字节映射
  return { text: buffer.toString('latin1'), encoding: 'ISO-8859-1' };
}

// ===== IPC 处理器 =====
// Electron 的 IPC（进程间通信）通过 ipcMain.handle / ipcRenderer.invoke 实现
// 主进程注册处理器，渲染进程通过 preload 暴露的 API 调用

/** 打开文件夹：弹出原生对话框 → 扫描目录 → 保存工作区 */
ipcMain.handle('open-folder', async () => {
  if (!mainWindow) return null;
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
  });
  if (result.canceled || result.filePaths.length === 0) return null;

  const folderPath = result.filePaths[0];
  const tree = scanDirectory(folderPath);
  saveWorkspace(folderPath);  // 记住，下次启动自动恢复
  return { folderPath, tree };
});

/** 获取上次工作区：启动时调用，恢复上次打开的文件夹 */
ipcMain.handle('get-last-workspace', async () => {
  const folderPath = loadWorkspace();
  if (!folderPath) return null;
  try {
    const tree = scanDirectory(folderPath);
    return { folderPath, tree };
  } catch {
    return null;  // 目录被删除或移动，静默跳过
  }
});

/** 读取文件（自动检测编码） */
ipcMain.handle('read-file', async (_event, filePath: string) => {
  try {
    const buffer = readFileSync(filePath);  // 先读原始字节
    const { text, encoding } = detectAndDecode(buffer);
    return { success: true, content: text, encoding };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
});

/** 以指定编码读取文件（用户手动切换编码时用） */
ipcMain.handle('read-file-with-encoding', async (_event, filePath: string, encoding: string) => {
  try {
    const buffer = readFileSync(filePath);
    let text: string;
    switch (encoding) {
      case 'UTF-16 LE':  text = iconv.decode(buffer, 'utf16-le');  break;
      case 'UTF-16 BE':  text = iconv.decode(buffer, 'utf16-be');  break;
      case 'GBK':        text = iconv.decode(buffer, 'gbk');       break;
      case 'ISO-8859-1': text = buffer.toString('latin1');         break;
      default:           text = buffer.toString('utf-8');
    }
    return { success: true, content: text, encoding };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
});

/** 写入文件（统一用 UTF-8） */
ipcMain.handle('write-file', async (_event, filePath: string, content: string) => {
  try {
    writeFileSync(filePath, content, 'utf-8');
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
});

/** 重新扫描文件夹（文件变更后更新文件树） */
ipcMain.handle('scan-folder', async (_event, folderPath: string) => {
  try {
    const tree = scanDirectory(folderPath);
    return { success: true, tree };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
});

/** 同步脏状态：渲染进程告诉主进程是否有未保存文件 */
ipcMain.handle('set-dirty-state', async (_event, dirty: boolean) => {
  hasDirtyTabs = dirty;
});

/** 确认退出：保存完成后渲染进程调用，设置标志后关闭窗口 */
ipcMain.handle('confirm-quit', async () => {
  isQuitting = true;
  mainWindow?.close();
});

// ===== Python 词法扫描器（常驻子进程） =====

let pyProcess: ChildProcess | null = null;
let pyPending: ((value: any) => void) | null = null;  // 等待响应的回调
const compilerDir = join(app.getAppPath(), 'compiler');

/**
 * 获取或创建 Python 扫描器进程
 *
 * 使用"常驻进程"模式而非每次启动新进程：
 * - Python 冷启动约 200ms，常驻后每次扫描 < 5ms
 * - 通过 stdin/stdout 的 JSON 行协议通信
 * - 进程崩溃后下次请求自动重建
 */
function getPythonBridge(): ChildProcess {
  if (!pyProcess || pyProcess.killed) {
    // 启动 Python 子进程，管道连接 stdin/stdout/stderr
    pyProcess = spawn('python', [join(compilerDir, 'scanner_bridge.py')], {
      cwd: compilerDir,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    // 逐行读取 stdout，每行是一个完整的 JSON 响应
    const rl = createInterface({ input: pyProcess.stdout! });
    rl.on('line', (line: string) => {
      if (pyPending) {
        const resolve = pyPending;
        pyPending = null;
        try {
          resolve(JSON.parse(line));
        } catch {
          resolve({ tokens: [], errors: [] });  // 解析失败返回空
        }
      }
    });

    // stderr 输出到控制台（调试用）
    pyProcess.stderr?.on('data', (data) => {
      console.error('Python scanner:', data.toString());
    });

    // 进程退出时清理状态
    pyProcess.on('exit', () => { pyProcess = null; pyPending = null; });
  }
  return pyProcess;
}

/** 扫描代码：把代码文本发给 Python 扫描器，返回 Token 列表和错误列表 */
ipcMain.handle('scan-code', async (_event, code: string) => {
  try {
    const bridge = getPythonBridge();
    return new Promise((resolve) => {
      pyPending = resolve;
      bridge.stdin!.write(JSON.stringify({ code }) + '\n');
    });
  } catch (err: any) {
    return { tokens: [], errors: [{ line: 1, code: String(err.message) }] };
  }
});

// ===== 编译 & 链接运行 =====

/** 执行命令并捕获 stdout/stderr */
function runCmd(command: string, cwd?: string): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    exec(command, { cwd }, (err, stdout, stderr) => {
      resolve({ stdout: stdout || '', stderr: stderr || (err?.message ?? '') });
    });
  });
}

/** 编译生成 .s 汇编文件：调用 Python 编译器 */
ipcMain.handle('compile-file', async (_event, filePath: string) => {
  const compilerPy = join(compilerDir, 'mycompiler.py');
  // 输出文件名 = 源文件名换 .s 后缀
  const outPath = filePath.replace(/\.[^.]+$/, '.s');
  try {
    const cmd = `python "${compilerPy}" "${filePath}" -S -o "${outPath}"`;
    const { stderr } = await runCmd(cmd, compilerDir);
    if (stderr) {
      return { success: false, message: stderr.trim() };
    }
    return { success: true, message: `已生成 ${outPath}` };
  } catch (err: any) {
    return { success: false, message: err.message };
  }
});

/**
 * 链接并运行：编译 → gcc 汇编+链接 → 启动 exe
 *
 * 步骤：
 * 1. Python 编译器生成 .s 汇编文件
 * 2. gcc 把 .s 汇编+链接为 .exe
 * 3. 用 cmd /c 在新窗口运行 exe，结束后暂停等用户按键
 */
ipcMain.handle('link-and-run', async (_event, filePath: string) => {
  const compilerPy = join(compilerDir, 'mycompiler.py');
  const asmPath = filePath.replace(/\.[^.]+$/, '.s');
  const exePath = filePath.replace(/\.[^.]+$/, '.exe');

  // 步骤1：Python 编译器 → .s 汇编
  const compileCmd = `python "${compilerPy}" "${filePath}" -S -o "${asmPath}"`;
  const compileResult = await runCmd(compileCmd, compilerDir);
  if (compileResult.stderr) {
    return { success: false, message: '编译失败:\n' + compileResult.stderr.trim() };
  }

  // 步骤2：gcc 汇编 + 链接 → .exe
  const linkCmd = `gcc "${asmPath}" -o "${exePath}"`;
  const linkResult = await runCmd(linkCmd);
  if (linkResult.stderr && !existsSync(exePath)) {
    return { success: false, message: '链接失败:\n' + linkResult.stderr.trim() };
  }

  // 步骤3：运行 exe（新 cmd 窗口，结束后暂停）
  try {
    const exeDir = filePath.substring(0, filePath.replace(/\\/g, '/').lastIndexOf('/'));
    const runCmd = `start "C IDE 运行" cmd /c "cd /d "${exeDir}" && "${exePath}" && echo. && echo 程序已结束，按任意键关闭... && pause > nul"`;
    exec(runCmd);
    return { success: true, message: `已启动 ${exePath}` };
  } catch (err: any) {
    return { success: false, message: '运行失败: ' + err.message };
  }
});

// ===== 文件监听 =====
// 使用 Node 内置 fs.watch（而非 chokidar），零额外依赖

let fileWatcher: ReturnType<typeof watch> | null = null;

/** 开始监听文件夹变更（文件增删改 → 通知渲染进程刷新文件树） */
ipcMain.handle('watch-folder', async (_event, folderPath: string) => {
  if (fileWatcher) fileWatcher.close();
  fileWatcher = watch(folderPath, { recursive: true }, (_eventType, _filename) => {
    mainWindow?.webContents.send('file-changed');
  });
});

/** 停止监听 */
ipcMain.handle('stop-watch', async () => {
  if (fileWatcher) {
    fileWatcher.close();
    fileWatcher = null;
  }
});

// === 应用生命周期 ===

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  // 清理资源
  if (fileWatcher) fileWatcher.close();
  if (pyProcess && !pyProcess.killed) {
    pyProcess.stdin!.write(JSON.stringify({ action: 'exit' }) + '\n');
    pyProcess.kill();
  }
  app.quit();
});
