const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs-extra');
const os = require('os');

let mainWindow;

const createWindow = () => {
  mainWindow = new BrowserWindow({
    width: 900,
    height: 600,
    minWidth: 800,
    minHeight: 500,
    resizable: true,
    frame: false,
    titleBarStyle: 'hidden',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    icon: path.join(__dirname, 'assets', 'icon.png')
  });

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
};

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

// IPC handlers
ipcMain.handle('minimize-window', () => {
  mainWindow?.minimize();
});

ipcMain.handle('maximize-window', () => {
  if (mainWindow?.isMaximized()) {
    mainWindow.unmaximize();
  } else {
    mainWindow?.maximize();
  }
});

ipcMain.handle('close-window', () => {
  mainWindow?.close();
});

ipcMain.handle('get-app-path', () => {
  return app.getPath('userData');
});

ipcMain.handle('get-minecraft-path', () => {
  return path.join(os.homedir(), 'AppData', 'Roaming', '.pixelmons');
});

ipcMain.handle('get-bundled-mods-path', () => {
  return app.isPackaged
    ? path.join(process.resourcesPath, 'mods')
    : path.join(__dirname, 'mods');
});

ipcMain.handle('get-bundled-configs-path', () => {
  return app.isPackaged
    ? path.join(process.resourcesPath, 'config')
    : path.join(__dirname, 'config');
});

ipcMain.handle('get-bundled-defaults-path', () => {
  return app.isPackaged
    ? path.join(process.resourcesPath, 'defaults')
    : path.join(__dirname, 'defaults');
});

ipcMain.handle('get-bundled-resourcepacks-path', () => {
  return app.isPackaged
    ? path.join(process.resourcesPath, 'resourcepacks')
    : path.join(__dirname, 'resourcepacks');
});

ipcMain.handle('launch-minecraft', async (event, options) => {
  try {
    const { Client } = require('minecraft-launcher-core');
    const launcher = new Client();

    // Check Java version first and find Java 21 path if available
    let javaPath = options.javaPath || 'java';
    const javaCheck = await new Promise((resolve) => {
      const java = spawn('java', ['-version']);
      let versionOutput = '';

      java.stderr.on('data', (data) => {
        versionOutput += data.toString();
      });

      java.on('close', (code) => {
        const versionMatch = versionOutput.match(/version\s+"?(\d+)[._\d]*"?/);
        const version = versionMatch ? versionMatch[1] : null;
        resolve(version);
      });
    });

    if (javaCheck && parseInt(javaCheck) >= 25) {
      mainWindow?.webContents.send('launcher-log', {
        type: 'warning',
        message: `⚠️ ตรวจพบ Java ${javaCheck} - กำลังมองหา Java 21 ที่เข้ากันได้ดีกว่า...`
      });

      // Try to find Java 21 in common installation paths
      const possiblePaths = [
        'C:\\Program Files\\Eclipse Adoptium\\jdk-21.0.5.11-hotspot\\bin\\java.exe',
        'C:\\Program Files\\Eclipse Adoptium\\jdk-21.0.4.9-hotspot\\bin\\java.exe',
        'C:\\Program Files\\Eclipse Adoptium\\jdk-21.0.3.9-hotspot\\bin\\java.exe',
        'C:\\Program Files\\Eclipse Adoptium\\jdk-21\\bin\\java.exe',
        'C:\\Program Files\\Java\\jdk-21\\bin\\java.exe'
      ];

      for (const path of possiblePaths) {
        if (require('fs').existsSync(path)) {
          javaPath = path;
          mainWindow?.webContents.send('launcher-log', {
            type: 'info',
            message: `✅ ใช้ Java 21: ${path}`
          });
          break;
        }
      }

      if (javaPath === 'java') {
        mainWindow?.webContents.send('launcher-log', {
          type: 'warning',
          message: '❌ ไม่พบ Java 21 แนะนำให้ติดตั้ง Java 21 เพื่อความเข้ากันได้ที่ดีที่สุด'
        });
      }
    } else if (javaCheck && parseInt(javaCheck) >= 17 && parseInt(javaCheck) <= 21) {
      mainWindow?.webContents.send('launcher-log', {
        type: 'info',
        message: `✅ ใช้ Java ${javaCheck} (รองรับดี)`
      });
    }

    // บน Windows เปลี่ยนให้ใช้ javaw เพื่อซ่อนหน้าจอ Console สีดำ
    if (os.platform() === 'win32') {
      if (javaPath === 'java') {
        javaPath = 'javaw';
      } else if (javaPath.toLowerCase().endsWith('java.exe')) {
        javaPath = javaPath.slice(0, -8) + 'javaw.exe';
      }
    }

    const opts = {
      authorization: {
        access_token: '',
        client_token: '',
        uuid: options.uuid || generateOfflineUUID(options.username),
        name: options.username,
        user_properties: {},
        meta: {
          type: 'mojang',
          demo: false
        }
      },
      root: options.gamePath,
      version: options.fabricVersion
        ? { number: '1.21.1', type: 'release', custom: options.fabricVersion }
        : (options.version || {
          number: '1.21.1',
          type: 'release'
        }),
      memory: {
        max: `${options.memory || '4096'}M`,
        min: '1G'
      },
      javaPath: javaPath
    };

    // Auto-connect to server — use BOTH customLaunchArgs and quickPlay for maximum compatibility
    if (options.serverIp) {
      const serverIp = options.serverIp;
      const serverPort = options.serverPort || '25565';

      // Method 1: customLaunchArgs — directly appended to game arguments (handler.js line 589)
      opts.customLaunchArgs = [
        '--server', serverIp,
        '--port', serverPort
      ];

      // Method 2: quickPlay multiplayer — for MC 1.20+ (generates --quickPlayMultiplayer ip:port)
      opts.quickPlay = {
        type: 'multiplayer',
        identifier: `${serverIp}:${serverPort}`
      };

      mainWindow?.webContents.send('launcher-log', {
        type: 'info',
        message: `🌐 Auto-connect to server: ${serverIp}:${serverPort}`
      });
    }

    launcher.launch(opts);

    // Log the full launch arguments for debugging
    launcher.on('arguments', (args) => {
      const serverArgs = args.filter(a =>
        a === '--server' || a === '--port' ||
        a === '--quickPlayMultiplayer' ||
        a === options.serverIp || a === (options.serverPort || '25565') ||
        (typeof a === 'string' && a.includes(options.serverIp))
      );
      mainWindow?.webContents.send('launcher-log', {
        type: 'info',
        message: `🔧 Server args found in launch command: ${serverArgs.length > 0 ? serverArgs.join(' ') : 'NONE — server flags not detected!'}`
      });
      mainWindow?.webContents.send('launcher-log', {
        type: 'debug',
        message: `Full launch args (last 10): ...${args.slice(-10).join(' ')}`
      });
    });

    launcher.on('debug', (e) => {
      mainWindow?.webContents.send('launcher-log', { type: 'debug', message: e });
    });

    launcher.on('data', (e) => {
      mainWindow?.webContents.send('launcher-log', { type: 'info', message: e });
    });

    // Auto-close launcher once Minecraft window is actually opening
    let gameStarted = false;
    launcher.on('data', (e) => {
      const logString = e.toString();
      // รอจนกว่าหน้าต่างเกมจะถูกสร้างขึ้นมาจริงๆ (พบ log ของ LWJGL หรือ OpenAL)
      if (!gameStarted && (logString.includes('LWJGL') || logString.includes('OpenAL') || logString.includes('OpenGL'))) {
        gameStarted = true;
        mainWindow?.webContents.send('launcher-log', {
          type: 'info',
          message: '✅ Minecraft กำลังแสดงหน้าต่าง... Launcher จะปิดใน 2 วินาที'
        });
        setTimeout(() => {
          app.quit();
        }, 2000);
      }
    });

    launcher.on('error', (e) => {
      mainWindow?.webContents.send('launcher-log', { type: 'error', message: e });
    });

    launcher.on('close', (code) => {
      mainWindow?.webContents.send('launcher-closed', code);
    });

    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('check-java', async () => {
  return new Promise((resolve) => {
    const java = spawn('java', ['-version']);
    let version = null;
    let fullVersion = '';

    java.stderr.on('data', (data) => {
      const output = data.toString();
      fullVersion += output;
      const match = output.match(/version\s+"?(\d+)[._\d]*"?/);
      if (match) {
        version = match[1];
      }
    });

    java.on('error', () => {
      resolve({ installed: false, version: null, recommended: false });
    });

    java.on('close', (code) => {
      if (code === 0 && version) {
        const recommended = parseInt(version) >= 17 && parseInt(version) <= 21;
        resolve({
          installed: true,
          version: version,
          recommended,
          fullVersion,
          needsUpgrade: parseInt(version) >= 25
        });
      } else {
        resolve({ installed: false, version: null, recommended: false });
      }
    });
  });
});

ipcMain.handle('install-java', async () => {
  try {
    const axios = require('axios');
    const path = require('path');
    const os = require('os');
    const { spawn } = require('child_process');

    const platform = os.platform();
    const arch = os.arch();

    // Determine the correct download URL for Java 21
    let downloadUrl;
    let fileName;

    if (platform === 'win32') {
      if (arch === 'x64') {
        downloadUrl = 'https://github.com/adoptium/temurin21-binaries/releases/download/jdk-21.0.5%2B11/OpenJDK21U-jdk_x64_windows_hotspot_21.0.5_11.msi';
        fileName = 'OpenJDK21U-jdk_x64_windows_hotspot_21.0.5_11.msi';
      } else {
        throw new Error('Unsupported architecture for Windows');
      }
    } else if (platform === 'linux') {
      if (arch === 'x64') {
        downloadUrl = 'https://github.com/adoptium/temurin21-binaries/releases/download/jdk-21.0.5%2B11/OpenJDK21U-jdk_x64_linux_hotspot_21.0.5_11.tar.gz';
        fileName = 'OpenJDK21U-jdk_x64_linux_hotspot_21.0.5_11.tar.gz';
      } else {
        throw new Error('Unsupported architecture for Linux');
      }
    } else {
      throw new Error('Unsupported platform');
    }

    const javaPath = path.join(app.getPath('temp'), fileName);

    mainWindow?.webContents.send('launcher-log', {
      type: 'info',
      message: 'กำลังดาวน์โหลด Java 21...'
    });

    // Download Java
    const response = await axios({
      url: downloadUrl,
      method: 'GET',
      responseType: 'stream',
      onDownloadProgress: (progressEvent) => {
        const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
        mainWindow?.webContents.send('download-progress', {
          progress: percentCompleted,
          downloaded: progressEvent.loaded,
          total: progressEvent.total
        });
      }
    });

    const writer = require('fs').createWriteStream(javaPath);
    response.data.pipe(writer);

    await new Promise((resolve, reject) => {
      writer.on('finish', resolve);
      writer.on('error', reject);
    });

    mainWindow?.webContents.send('launcher-log', {
      type: 'info',
      message: 'กำลังติดตั้ง Java 21...'
    });

    // Install Java (Windows MSI)
    if (platform === 'win32') {
      return new Promise((resolve, reject) => {
        const installer = spawn('msiexec', ['/i', javaPath, '/quiet', 'ADDLOCAL=FeatureMain,FeatureEnvironment,FeatureJarFileRunWith,FeatureJavaHome'], { detached: true });

        installer.on('close', (code) => {
          require('fs').unlinkSync(javaPath);
          if (code === 0) {
            resolve({ success: true });
          } else {
            reject(new Error(`Java installer exited with code ${code}`));
          }
        });

        installer.on('error', (err) => {
          require('fs').unlinkSync(javaPath);
          reject(err);
        });
      });
    } else {
      // For Linux - extract to /opt/java
      const tar = require('child_process').spawn('tar', ['-xzf', javaPath, '-C', '/opt/']);

      return new Promise((resolve, reject) => {
        tar.on('close', (code) => {
          require('fs').unlinkSync(javaPath);
          if (code === 0) {
            resolve({ success: true });
          } else {
            reject(new Error(`Java extraction failed with code ${code}`));
          }
        });
      });
    }
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('download-file', async (event, { url, dest }) => {
  const axios = require('axios');
  const writer = fs.createWriteStream(dest);

  const response = await axios({
    url,
    method: 'GET',
    responseType: 'stream'
  });

  const totalLength = parseInt(response.headers['content-length'], 10);
  let downloadedLength = 0;

  response.data.on('data', (chunk) => {
    downloadedLength += chunk.length;
    const progress = totalLength ? Math.round((downloadedLength / totalLength) * 100) : 0;
    mainWindow?.webContents.send('download-progress', { progress, downloaded: downloadedLength, total: totalLength });
  });

  response.data.pipe(writer);

  return new Promise((resolve, reject) => {
    writer.on('finish', resolve);
    writer.on('error', reject);
  });
});

ipcMain.handle('extract-zip', async (event, { zipPath, destPath }) => {
  const AdmZip = require('adm-zip');
  const zip = new AdmZip(zipPath);
  zip.extractAllTo(destPath, true);
});

ipcMain.handle('file-exists', async (event, filePath) => {
  return fs.existsSync(filePath);
});

ipcMain.handle('mkdir', async (event, dirPath) => {
  await fs.ensureDir(dirPath);
});

ipcMain.handle('copy-mods', async (event, { sourcePath, destPath }) => {
  try {
    await fs.ensureDir(destPath);
    const files = await fs.readdir(sourcePath);
    const jarFiles = files.filter(f => f.endsWith('.jar'));

    // Remove duplicates and incompatible mods - keep only the latest version for each mod
    const modMap = new Map();
    const incompatibleMods = [];

    for (const file of jarFiles) {
      const baseName = file.replace(/-\d+.*\.jar$/, '.jar'); // Remove version suffix
      const modName = baseName.replace(/\.jar$/, '');

      // Check for incompatible versions
      if (file.includes('mc1.20') || file.includes('1.20')) {
        incompatibleMods.push({ file, reason: 'MC 1.20 mod (incompatible with 1.21)' });
        continue;
      }

      // Special handling for fabric-api to keep only the latest version
      if (modName.startsWith('fabric-api')) {
        const version = file.match(/fabric-api-(.+)\.jar/);
        if (version) {
          const currentVersion = version[1];
          const existingVersion = modMap.get('fabric-api');

          if (!existingVersion || compareVersions(currentVersion, existingVersion) > 0) {
            modMap.set('fabric-api', file);
          }
        }
      } else {
        // For other mods, keep the first one found
        if (!modMap.has(modName)) {
          modMap.set(modName, file);
        }
      }
    }

    // Clear destination folder first
    await fs.emptyDir(destPath);

    let copied = 0;
    for (const [modName, file] of modMap) {
      const srcFile = path.join(sourcePath, file);
      const destFile = path.join(destPath, file);
      await fs.copy(srcFile, destFile, { overwrite: true });
      copied++;

      // Send progress
      mainWindow?.webContents.send('copy-progress', {
        current: copied,
        total: modMap.size,
        filename: file
      });
    }

    // Log incompatible mods
    if (incompatibleMods.length > 0) {
      mainWindow?.webContents.send('launcher-log', {
        type: 'warning',
        message: `ข้าม mod ที่ไม่รองรับ ${incompatibleMods.length} ตัว:`
      });
      for (const mod of incompatibleMods) {
        mainWindow?.webContents.send('launcher-log', {
          type: 'warning',
          message: `  - ${mod.file} (${mod.reason})`
        });
      }
    }

    return { success: true, count: copied, skipped: incompatibleMods.length };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('copy-configs', async (event, { sourcePath, destPath }) => {
  try {
    if (!await fs.pathExists(sourcePath)) {
      return { success: true, count: 0, message: "No configs folder found to copy" };
    }

    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('copy-resourcepacks', async (event, { sourcePath, destPath }) => {
  try {
    if (!await fs.pathExists(sourcePath)) {
      return { success: true, count: 0, message: "No resourcepacks folder found to copy" };
    }

    await fs.ensureDir(destPath);
    await fs.copy(sourcePath, destPath, { overwrite: true });

    return { success: true, count: 1 };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('sync-keybinds', async (event, { defaultsPath, gamePath }) => {
  try {
    // 1. Copy other configs (like Xaero minimap / waypoints) that reside in root
    if (await fs.pathExists(defaultsPath)) {
      const files = await fs.readdir(defaultsPath);
      for (const file of files) {
        if (file !== 'options.txt') {
          const src = path.join(defaultsPath, file);
          const dest = path.join(gamePath, file);
          await fs.copy(src, dest, { overwrite: true });
        }
      }
    }

    // 2. Options.txt logic
    const defaultOptionsPath = path.join(defaultsPath, 'options.txt');
    const playerOptionsPath = path.join(gamePath, 'options.txt');

    if (!await fs.pathExists(defaultOptionsPath)) {
      return { success: true, message: 'No default options.txt found' };
    }

    const defaultContent = await fs.readFile(defaultOptionsPath, 'utf8');

    if (!await fs.pathExists(playerOptionsPath)) {
      // If player doesn't have options.txt, just copy the whole file
      await fs.copy(defaultOptionsPath, playerOptionsPath);
      return { success: true, message: 'Copied new options.txt' };
    }

    // Merge keybinds & resourcePacks so we don't overwrite volume or render distance
    const playerContent = await fs.readFile(playerOptionsPath, 'utf8');
    const defaultLines = defaultContent.split(/\r?\n/);
    const playerLines = playerContent.split(/\r?\n/);

    const defaultKeys = {};
    for (const line of defaultLines) {
      if (line.trim().startsWith('key_') || line.trim().startsWith('resourcePacks') || line.trim().startsWith('incompatibleResourcePacks')) {
        const idx = line.indexOf(':');
        if (idx !== -1) {
          const k = line.slice(0, idx);
          const v = line.slice(idx + 1);
          defaultKeys[k] = v;
        }
      }
    }

    let modified = false;
    for (let i = 0; i < playerLines.length; i++) {
      const line = playerLines[i];
      if (line.trim().startsWith('key_') || line.trim().startsWith('resourcePacks') || line.trim().startsWith('incompatibleResourcePacks')) {
        const idx = line.indexOf(':');
        if (idx !== -1) {
          const k = line.slice(0, idx);
          if (defaultKeys[k] !== undefined && playerLines[i] !== `${k}:${defaultKeys[k]}`) {
            playerLines[i] = `${k}:${defaultKeys[k]}`;
            modified = true;
          }
          // Remove from map so we know what's left to append
          delete defaultKeys[k];
        }
      }
    }

    // Add any remaining default keys that weren't in player's file
    for (const [k, v] of Object.entries(defaultKeys)) {
      playerLines.push(`${k}:${v}`);
      modified = true;
    }

    if (modified) {
      await fs.writeFile(playerOptionsPath, playerLines.join('\n'), 'utf8');
      return { success: true, message: 'Merged keybinds successfully' };
    }

    return { success: true, message: 'Keybinds already up to date' };

  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Simple version comparison (returns 1 if a > b, -1 if a < b, 0 if equal)
function compareVersions(a, b) {
  const aParts = a.split(/[.\-+]/).map(x => parseInt(x) || 0);
  const bParts = b.split(/[.\-+]/).map(x => parseInt(x) || 0);

  for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
    const aVal = aParts[i] || 0;
    const bVal = bParts[i] || 0;

    if (aVal > bVal) return 1;
    if (aVal < bVal) return -1;
  }
  return 0;
}

ipcMain.handle('list-mods', async (event, modsPath) => {
  try {
    if (!await fs.pathExists(modsPath)) {
      return { success: true, mods: [] };
    }
    const files = await fs.readdir(modsPath);
    const jarFiles = files.filter(f => f.endsWith('.jar'));
    return { success: true, mods: jarFiles };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('check-fabric', async (event, { gamePath }) => {
  try {
    const versionsPath = path.join(gamePath, 'versions');
    if (!await fs.pathExists(versionsPath)) {
      return { installed: false, version: null };
    }

    const versions = await fs.readdir(versionsPath);
    // Find fabric version (e.g., fabric-loader-0.16.10-1.21.1)
    const fabricVersion = versions.find(v => v.startsWith('fabric-loader-'));

    if (fabricVersion) {
      return { installed: true, version: fabricVersion };
    }

    return { installed: false, version: null };
  } catch (error) {
    return { installed: false, error: error.message };
  }
});

ipcMain.handle('install-fabric', async (event, { gamePath, mcVersion, fabricVersion }) => {
  try {
    const axios = require('axios');
    const { spawn } = require('child_process');

    // Download Fabric installer
    const installerUrl = `https://maven.fabricmc.net/net/fabricmc/fabric-installer/${fabricVersion}/fabric-installer-${fabricVersion}.jar`;
    const installerPath = path.join(app.getPath('temp'), `fabric-installer-${fabricVersion}.jar`);

    mainWindow?.webContents.send('launcher-log', {
      type: 'info',
      message: `กำลังดาวน์โหลด Fabric Installer ${fabricVersion}...`
    });

    // Download installer
    const response = await axios({
      url: installerUrl,
      method: 'GET',
      responseType: 'stream'
    });

    const writer = fs.createWriteStream(installerPath);
    response.data.pipe(writer);

    await new Promise((resolve, reject) => {
      writer.on('finish', resolve);
      writer.on('error', reject);
    });

    mainWindow?.webContents.send('launcher-log', {
      type: 'info',
      message: 'กำลังติดตั้ง Fabric Loader...'
    });

    // Run installer
    const java = spawn('java', [
      '-jar', installerPath,
      'client',
      '-dir', gamePath,
      '-mcversion', mcVersion,
      '-noprofile'
    ]);

    return new Promise((resolve, reject) => {
      java.on('close', (code) => {
        fs.removeSync(installerPath);
        if (code === 0) {
          resolve({ success: true });
        } else {
          reject(new Error(`Fabric installer exited with code ${code}`));
        }
      });

      java.on('error', (err) => {
        fs.removeSync(installerPath);
        reject(err);
      });
    });
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Generate offline UUID (version 3 UUID based on "OfflinePlayer:<username>")
function generateOfflineUUID(username) {
  const crypto = require('crypto');
  const hash = crypto.createHash('md5').update('OfflinePlayer:' + username).digest();
  hash[6] = (hash[6] & 0x0f) | 0x30;
  hash[8] = (hash[8] & 0x3f) | 0x80;
  return hash.toString('hex').replace(/(.{8})(.{4})(.{4})(.{4})(.{12})/, '$1-$2-$3-$4-$5');
}
