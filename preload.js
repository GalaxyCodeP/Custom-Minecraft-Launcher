const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Window controls
  minimizeWindow: () => ipcRenderer.invoke('minimize-window'),
  maximizeWindow: () => ipcRenderer.invoke('maximize-window'),
  closeWindow: () => ipcRenderer.invoke('close-window'),

  // Paths
  getAppPath: () => ipcRenderer.invoke('get-app-path'),
  getMinecraftPath: () => ipcRenderer.invoke('get-minecraft-path'),
  getBundledModsPath: () => ipcRenderer.invoke('get-bundled-mods-path'),
  getBundledConfigsPath: () => ipcRenderer.invoke('get-bundled-configs-path'),
  getBundledDefaultsPath: () => ipcRenderer.invoke('get-bundled-defaults-path'),
  getBundledResourcePacksPath: () => ipcRenderer.invoke('get-bundled-resourcepacks-path'),

  // Minecraft
  launchMinecraft: (options) => ipcRenderer.invoke('launch-minecraft', options),
  checkJava: () => ipcRenderer.invoke('check-java'),
  installJava: () => ipcRenderer.invoke('install-java'),

  // File operations
  downloadFile: (url, dest) => ipcRenderer.invoke('download-file', { url, dest }),
  extractZip: (zipPath, destPath) => ipcRenderer.invoke('extract-zip', { zipPath, destPath }),
  fileExists: (filePath) => ipcRenderer.invoke('file-exists', filePath),
  mkdir: (dirPath) => ipcRenderer.invoke('mkdir', dirPath),
  copyMods: (sourcePath, destPath) => ipcRenderer.invoke('copy-mods', { sourcePath, destPath }),
  copyConfigs: (sourcePath, destPath) => ipcRenderer.invoke('copy-configs', { sourcePath, destPath }),
  copyResourcePacks: (sourcePath, destPath) => ipcRenderer.invoke('copy-resourcepacks', { sourcePath, destPath }),
  syncKeybinds: (defaultsPath, gamePath) => ipcRenderer.invoke('sync-keybinds', { defaultsPath, gamePath }),
  listMods: (modsPath) => ipcRenderer.invoke('list-mods', modsPath),
  checkFabric: (gamePath, version) => ipcRenderer.invoke('check-fabric', { gamePath, version }),
  installFabric: (gamePath, mcVersion, fabricVersion) => ipcRenderer.invoke('install-fabric', { gamePath, mcVersion, fabricVersion }),

  // Event listeners
  onLauncherLog: (callback) => ipcRenderer.on('launcher-log', (_, data) => callback(data)),
  onLauncherClosed: (callback) => ipcRenderer.on('launcher-closed', (_, code) => callback(code)),
  onDownloadProgress: (callback) => ipcRenderer.on('download-progress', (_, data) => callback(data)),
  onCopyProgress: (callback) => ipcRenderer.on('copy-progress', (_, data) => callback(data)),

  // Remove listeners
  removeAllListeners: (channel) => ipcRenderer.removeAllListeners(channel)
});
