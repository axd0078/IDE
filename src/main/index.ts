import { app, BrowserWindow, dialog, ipcMain, Menu } from 'electron';
import { join } from 'node:path';
import { readFileSync, readdirSync, writeFileSync, existsSync, mkdirSync, watch } from 'node:fs';
import { spawn, ChildProcess } from 'node:child_process';
import { createInterface } from 'node:readline';
import * as iconv from 'iconv-lite';

let mainWindow: BrowserWindow | null = null;
let isQuitting = false;
let hasDirtyTabs = false;

const workspaceFile = join(app.getPath('userData'), 'workspace.json');

function saveWorkspace(folderPath: string): void {
  try {
    const dir = app.getPath('userData');
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    writeFileSync(workspaceFile, JSON.stringify({ folderPath }), 'utf-8');
  } catch { /* 静默忽略 */ }
}

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

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    backgroundColor: '#1e1e1e',
    title: 'C IDE',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    show: false,
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  // 禁用开发者工具快捷键
  mainWindow.webContents.on('before-input-event', (_event, input) => {
    if (input.key === 'F12') return _event.preventDefault();
    if ((input.control || input.meta) && input.shift && input.key.toLowerCase() === 'i') {
      return _event.preventDefault();
    }
  });

  const menu = Menu.buildFromTemplate([
    {
      label: '文件',
      submenu: [
        {
          label: '打开文件夹...',
          accelerator: 'Ctrl+K Ctrl+O',
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
  ]);
  Menu.setApplicationMenu(menu);

  // 关闭前确认未保存修改
  mainWindow.on('close', (e) => {
    if (isQuitting) return;
    if (hasDirtyTabs) {
      e.preventDefault();
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
          mainWindow?.webContents.send('save-all-and-close');
        } else if (response === 1) {
          isQuitting = true;
          mainWindow?.close();
        }
      });
    }
  });

  if (process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'));
  }
}

interface FileNode {
  id: string;
  name: string;
  type: 'file' | 'folder';
  children?: FileNode[];
  language?: string;
}

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
        children: scanDirectory(fullPath),
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

  nodes.sort((a, b) => {
    if (a.type !== b.type) return a.type === 'folder' ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  return nodes;
}

// 编码检测：BOM → UTF-8 试探 → GBK 回退 → Latin-1 兜底
function detectAndDecode(buffer: Buffer): { text: string; encoding: string } {
  // UTF-8 BOM
  if (buffer[0] === 0xEF && buffer[1] === 0xBB && buffer[2] === 0xBF) {
    return { text: buffer.subarray(3).toString('utf-8'), encoding: 'UTF-8 BOM' };
  }
  // UTF-16 LE BOM
  if (buffer[0] === 0xFF && buffer[1] === 0xFE) {
    return { text: buffer.subarray(2).toString('utf16le'), encoding: 'UTF-16 LE' };
  }
  // UTF-16 BE BOM
  if (buffer[0] === 0xFE && buffer[1] === 0xFF) {
    return { text: iconv.decode(buffer.subarray(2), 'utf16-be'), encoding: 'UTF-16 BE' };
  }

  // 尝试 UTF-8（无 BOM），失败则用 GBK
  const utf8 = buffer.toString('utf-8');
  if (!utf8.includes('�')) {
    return { text: utf8, encoding: 'UTF-8' };
  }

  // GBK / GB2312 / GB18030（中文 Windows 常见）
  try {
    const gbk = iconv.decode(buffer, 'gbk');
    return { text: gbk, encoding: 'GBK' };
  } catch { /* fall through */ }

  // 最后兜底：Latin-1（逐字节映射，永不失败）
  return { text: buffer.toString('latin1'), encoding: 'ISO-8859-1' };
}

// ===== IPC handlers =====

ipcMain.handle('open-folder', async () => {
  if (!mainWindow) return null;
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
  });
  if (result.canceled || result.filePaths.length === 0) return null;

  const folderPath = result.filePaths[0];
  const tree = scanDirectory(folderPath);
  saveWorkspace(folderPath);
  return { folderPath, tree };
});

ipcMain.handle('get-last-workspace', async () => {
  const folderPath = loadWorkspace();
  if (!folderPath) return null;
  try {
    const tree = scanDirectory(folderPath);
    return { folderPath, tree };
  } catch {
    return null;
  }
});

ipcMain.handle('read-file', async (_event, filePath: string) => {
  try {
    const buffer = readFileSync(filePath);
    const { text, encoding } = detectAndDecode(buffer);
    return { success: true, content: text, encoding };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('read-file-with-encoding', async (_event, filePath: string, encoding: string) => {
  try {
    const buffer = readFileSync(filePath);
    let text: string;
    switch (encoding) {
      case 'UTF-16 LE':
        text = iconv.decode(buffer, 'utf16-le');
        break;
      case 'UTF-16 BE':
        text = iconv.decode(buffer, 'utf16-be');
        break;
      case 'GBK':
        text = iconv.decode(buffer, 'gbk');
        break;
      case 'ISO-8859-1':
        text = buffer.toString('latin1');
        break;
      default:
        text = buffer.toString('utf-8');
    }
    return { success: true, content: text, encoding };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('write-file', async (_event, filePath: string, content: string) => {
  try {
    writeFileSync(filePath, content, 'utf-8');
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('scan-folder', async (_event, folderPath: string) => {
  try {
    const tree = scanDirectory(folderPath);
    return { success: true, tree };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('set-dirty-state', async (_event, dirty: boolean) => {
  hasDirtyTabs = dirty;
});

ipcMain.handle('confirm-quit', async () => {
  isQuitting = true;
  mainWindow?.close();
});

// ===== Python 词法扫描器 bridge =====
let pyProcess: ChildProcess | null = null;
let pyPending: ((value: any) => void) | null = null;
const compilerDir = join(app.getAppPath(), 'compiler');

function getPythonBridge(): ChildProcess {
  if (!pyProcess || pyProcess.killed) {
    pyProcess = spawn('python', [join(compilerDir, 'scanner_bridge.py')], {
      cwd: compilerDir,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    const rl = createInterface({ input: pyProcess.stdout! });
    rl.on('line', (line: string) => {
      if (pyPending) {
        const resolve = pyPending;
        pyPending = null;
        try {
          resolve(JSON.parse(line));
        } catch {
          resolve({ tokens: [], errors: [] });
        }
      }
    });
    pyProcess.stderr?.on('data', (data) => {
      console.error('Python scanner:', data.toString());
    });
    pyProcess.on('exit', () => { pyProcess = null; pyPending = null; });
  }
  return pyProcess;
}

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

// 使用 Node 内置 fs.watch 代替 chokidar，减少启动开销
let fileWatcher: ReturnType<typeof watch> | null = null;

ipcMain.handle('watch-folder', async (_event, folderPath: string) => {
  if (fileWatcher) fileWatcher.close();
  fileWatcher = watch(folderPath, { recursive: true }, (_eventType, _filename) => {
    mainWindow?.webContents.send('file-changed');
  });
});

ipcMain.handle('stop-watch', async () => {
  if (fileWatcher) {
    fileWatcher.close();
    fileWatcher = null;
  }
});

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (fileWatcher) fileWatcher.close();
  if (pyProcess && !pyProcess.killed) {
    pyProcess.stdin!.write(JSON.stringify({ action: 'exit' }) + '\n');
    pyProcess.kill();
  }
  app.quit();
});
