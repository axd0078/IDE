import { app, BrowserWindow, dialog, ipcMain, Menu } from 'electron';
import { join } from 'node:path';
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { watch } from 'chokidar';

let mainWindow: BrowserWindow | null = null;

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
    {
      label: '视图',
      submenu: [
        { role: 'toggleDevTools', label: '开发者工具' },
        { role: 'reload', label: '重新加载' },
      ],
    },
  ]);
  Menu.setApplicationMenu(menu);

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

// IPC handlers
ipcMain.handle('open-folder', async () => {
  if (!mainWindow) return null;
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
  });
  if (result.canceled || result.filePaths.length === 0) return null;

  const folderPath = result.filePaths[0];
  const tree = scanDirectory(folderPath);
  return { folderPath, tree };
});

ipcMain.handle('read-file', async (_event, filePath: string) => {
  try {
    const content = readFileSync(filePath, 'utf-8');
    return { success: true, content };
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

let fileWatcher: ReturnType<typeof watch> | null = null;

ipcMain.handle('watch-folder', async (_event, folderPath: string) => {
  if (fileWatcher) {
    await fileWatcher.close();
  }
  fileWatcher = watch(folderPath, {
    ignored: /(^|[/\\])\./,
    ignoreInitial: true,
    depth: 10,
  });
  fileWatcher.on('all', () => {
    mainWindow?.webContents.send('file-changed');
  });
});

ipcMain.handle('stop-watch', async () => {
  if (fileWatcher) {
    await fileWatcher.close();
    fileWatcher = null;
  }
});

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (fileWatcher) fileWatcher.close();
  app.quit();
});
