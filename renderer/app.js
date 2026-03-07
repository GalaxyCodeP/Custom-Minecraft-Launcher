// Pixelmon Launcher - Application Logic

// Configuration
const CONFIG = {
  version: '1.21.1',
  serverIp: 'play.yourserver.com',
  serverPort: '25565',
  modsSourcePath: '', // Will be set on init
  configsSourcePath: '', // Will be set on init
  defaultsSourcePath: '', // Will be set on init
  resourcepacksSourcePath: '', // Will be set on init
  fabricVersion: '0.16.10',
  mods: []
};

// State
let isLaunching = false;
let isConsoleOpen = false;
let logs = [];

// DOM Elements
const elements = {
  username: document.getElementById('username'),
  memory: document.getElementById('memory'),
  launchBtn: document.getElementById('launchBtn'),
  btnText: document.getElementById('btnText'),
  progressFill: document.getElementById('progressFill'),
  progressText: document.getElementById('progressText'),
  progressContainer: document.getElementById('progressContainer'),
  serverIp: document.getElementById('serverIp'),
  serverPort: document.getElementById('serverPort'),
  javaStatus: document.getElementById('javaStatus'),
  gameStatus: document.getElementById('gameStatus'),
  modsStatus: document.getElementById('modsStatus'),
  settingsModal: document.getElementById('settingsModal'),
  settingsBtn: document.getElementById('settingsBtn'),
  settingsServerIp: document.getElementById('settingsServerIp'),
  settingsServerPort: document.getElementById('settingsServerPort'),
  saveSettingsBtn: document.getElementById('saveSettingsBtn'),
  cancelSettingsBtn: document.getElementById('cancelSettingsBtn'),
  minimizeBtn: document.getElementById('minimizeBtn'),
  maximizeBtn: document.getElementById('maximizeBtn'),
  closeBtn: document.getElementById('closeBtn'),
  exitBtn: document.getElementById('exitBtn'),
  consoleOutput: document.getElementById('consoleOutput'),
  consolePanel: document.getElementById('consolePanel'),
  consoleToggleBtn: document.getElementById('consoleToggleBtn'),
  consoleOpenBtn: document.getElementById('consoleOpenBtn'),
  particles: document.getElementById('particles')
};

// ==================
//  Initialize
// ==================
async function init() {
  createParticles();
  loadSettings();
  setupEventListeners();

  // Set the mods source path dynamically based on dev/prod environment
  CONFIG.modsSourcePath = await window.electronAPI.getBundledModsPath();
  CONFIG.configsSourcePath = await window.electronAPI.getBundledConfigsPath();
  CONFIG.defaultsSourcePath = await window.electronAPI.getBundledDefaultsPath();
  CONFIG.resourcepacksSourcePath = await window.electronAPI.getBundledResourcePacksPath();

  await checkRequirements();
  log('🎮 ระบบพร้อมใช้งาน — กรอกชื่อผู้ใช้เพื่อเริ่มเล่น Pixelmon!', 'info');
}

// ==================
//  Particles
// ==================
function createParticles() {
  const count = 25;
  for (let i = 0; i < count; i++) {
    const p = document.createElement('div');
    p.className = 'particle';
    p.style.left = Math.random() * 100 + '%';
    p.style.width = (Math.random() * 3 + 1) + 'px';
    p.style.height = p.style.width;
    p.style.animationDuration = (Math.random() * 15 + 10) + 's';
    p.style.animationDelay = (Math.random() * 10) + 's';
    p.style.opacity = Math.random() * 0.4 + 0.1;
    elements.particles.appendChild(p);
  }
}

// ==================
//  Settings
// ==================
function loadSettings() {
  const saved = localStorage.getItem('launcherSettings');
  if (saved) {
    const settings = JSON.parse(saved);
    CONFIG.serverIp = settings.serverIp || CONFIG.serverIp;
    CONFIG.serverPort = settings.serverPort || CONFIG.serverPort;
  }

  elements.serverIp.textContent = CONFIG.serverIp;
  elements.serverPort.textContent = CONFIG.serverPort;
  elements.settingsServerIp.value = CONFIG.serverIp;
  elements.settingsServerPort.value = CONFIG.serverPort;

  const savedUsername = localStorage.getItem('lastUsername');
  if (savedUsername) {
    elements.username.value = savedUsername;
  }
}

function saveSettings() {
  CONFIG.serverIp = elements.settingsServerIp.value || CONFIG.serverIp;
  CONFIG.serverPort = elements.settingsServerPort.value || CONFIG.serverPort;

  localStorage.setItem('launcherSettings', JSON.stringify({
    serverIp: CONFIG.serverIp,
    serverPort: CONFIG.serverPort
  }));

  elements.serverIp.textContent = CONFIG.serverIp;
  elements.serverPort.textContent = CONFIG.serverPort;
  elements.settingsModal.classList.remove('active');
  log(`✅ ตั้งค่าเซิร์ฟเวอร์: ${CONFIG.serverIp}:${CONFIG.serverPort}`, 'info');
}

// ==================
//  Event Listeners
// ==================
function setupEventListeners() {
  // Play button
  elements.launchBtn.addEventListener('click', launchGame);

  // Settings
  elements.settingsBtn.addEventListener('click', () => {
    elements.settingsServerIp.value = CONFIG.serverIp;
    elements.settingsServerPort.value = CONFIG.serverPort;
    elements.settingsModal.classList.add('active');
  });

  elements.saveSettingsBtn.addEventListener('click', saveSettings);
  elements.cancelSettingsBtn.addEventListener('click', () => {
    elements.settingsModal.classList.remove('active');
  });

  // Window controls
  elements.minimizeBtn.addEventListener('click', () => {
    window.electronAPI.minimizeWindow();
  });

  elements.maximizeBtn.addEventListener('click', () => {
    window.electronAPI.maximizeWindow();
  });

  elements.closeBtn.addEventListener('click', () => {
    window.electronAPI.closeWindow();
  });

  elements.exitBtn.addEventListener('click', () => {
    window.electronAPI.closeWindow();
  });

  // Console toggle
  elements.consoleOpenBtn.addEventListener('click', () => {
    isConsoleOpen = !isConsoleOpen;
    elements.consolePanel.classList.toggle('open', isConsoleOpen);
    elements.consoleOpenBtn.classList.toggle('hidden', isConsoleOpen);
  });

  elements.consoleToggleBtn.addEventListener('click', () => {
    isConsoleOpen = false;
    elements.consolePanel.classList.remove('open');
    elements.consoleOpenBtn.classList.remove('hidden');
  });

  // Close modal on overlay click
  elements.settingsModal.addEventListener('click', (e) => {
    if (e.target === elements.settingsModal) {
      elements.settingsModal.classList.remove('active');
    }
  });

  // Username input - Enter key to launch
  elements.username.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      launchGame();
    }
  });

  // Launcher events from main process
  window.electronAPI.onLauncherLog((data) => {
    log(data.message, data.type);
  });

  window.electronAPI.onCopyProgress((data) => {
    const pct = Math.round((data.current / data.total) * 100);
    setProgress(pct, `📦 กำลังคัดลอก Mods... (${data.current}/${data.total})`);
    log(`คัดลอก Mod: ${data.filename}`, 'debug');
  });

  window.electronAPI.onLauncherClosed((code) => {
    isLaunching = false;
    elements.launchBtn.disabled = false;
    setProgress(0, 'พร้อมเล่น');
    elements.btnText.textContent = 'PLAY GAME';
    log(`เกมปิดตัวลง (Exit code: ${code})`, code === 0 ? 'info' : 'error');
  });
}

// ==================
//  Requirements Check
// ==================
async function checkRequirements() {
  // Check Java
  const java = await window.electronAPI.checkJava();

  if (!java.installed) {
    updateStatusDot('javaStatus', 'error', 'Java: ไม่พบ — ติดตั้ง Java 21');
    log('⚠️ ไม่พบ Java — กรุณาติดตั้ง Java 21', 'error');
    showJavaInstallButton();
  } else if (java.needsUpgrade) {
    updateStatusDot('javaStatus', 'warning', `Java ${java.version}: แนะนำอัปเกรดเป็น 21`);
    log(`⚠️ Java ${java.version} — อาจมีปัญหาความเข้ากันได้`, 'warning');
    showJavaInstallButton();
  } else if (java.recommended) {
    updateStatusDot('javaStatus', 'ready', `Java ${java.version}: พร้อม`);
    log(`✅ Java ${java.version} รองรับดี`, 'info');
  } else {
    updateStatusDot('javaStatus', 'error', `Java ${java.version}: ไม่รองรับ`);
    log(`❌ Java ${java.version} ไม่รองรับ — ต้องการ Java 17-21`, 'error');
    showJavaInstallButton();
  }

  // Check Minecraft
  const gamePath = await getMinecraftPath();
  const hasMinecraft = await window.electronAPI.fileExists(gamePath);
  updateStatusDot('gameStatus', hasMinecraft ? 'ready' : 'checking',
    hasMinecraft ? 'Minecraft: พร้อม' : 'Minecraft: จะดาวน์โหลดอัตโนมัติ');

  // Check Mods
  const sourceMods = await window.electronAPI.listMods(CONFIG.modsSourcePath);
  if (sourceMods.success && sourceMods.mods.length > 0) {
    updateStatusDot('modsStatus', 'ready', `Mods: ${sourceMods.mods.length} ตัว`);
    log(`พบ ${sourceMods.mods.length} Mods พร้อมใช้งาน`, 'info');
  } else {
    updateStatusDot('modsStatus', 'error', 'Mods: ไม่พบ');
    log('⚠️ ไม่พบ Mods ในโฟลเดอร์ต้นทาง', 'warning');
  }

  // Check Fabric
  const fabricCheck = await window.electronAPI.checkFabric(gamePath);
  if (fabricCheck.installed) {
    log(`✅ Fabric Loader พร้อม (${fabricCheck.version})`, 'info');
  } else {
    log('⚠️ Fabric Loader จะติดตั้งอัตโนมัติเมื่อเริ่มเกม', 'warning');
  }
}

function updateStatusDot(elementId, status, text) {
  const el = document.getElementById(elementId);
  const dot = el.querySelector('.status-dot');
  const label = el.querySelector('.status-text');
  dot.className = `status-dot ${status}`;
  label.textContent = text;
}

// ==================
//  Minecraft Path
// ==================
async function getMinecraftPath() {
  return await window.electronAPI.getMinecraftPath();
}

// ==================
//  Progress & UI
// ==================
function setProgress(pct, text) {
  elements.progressFill.style.width = pct + '%';
  elements.progressText.textContent = text || '';
}

// ==================
//  Launch Game (Auto-connect to server)
// ==================
async function launchGame() {
  if (isLaunching) return;

  const username = elements.username.value.trim();
  if (!username) {
    shakeElement(elements.username);
    log('❌ กรุณากรอกชื่อผู้ใช้', 'error');
    return;
  }

  if (username.length < 3 || username.length > 16) {
    shakeElement(elements.username);
    log('❌ ชื่อผู้ใช้ต้องมีความยาว 3-16 ตัวอักษร', 'error');
    return;
  }

  if (!/^[a-zA-Z0-9_]+$/.test(username)) {
    shakeElement(elements.username);
    log('❌ ชื่อผู้ใช้ต้องเป็น a-z, A-Z, 0-9 และ _ เท่านั้น', 'error');
    return;
  }

  isLaunching = true;
  elements.launchBtn.disabled = true;
  elements.btnText.textContent = 'PREPARING...';
  setProgress(15, '⏳ กำลังเตรียมตัว...');

  // Save username
  localStorage.setItem('lastUsername', username);
  log(`🎮 เริ่มเกมในชื่อ: ${username}`, 'info');

  const gamePath = await getMinecraftPath();
  const memory = elements.memory.value;

  // Step 1: Copy Mods
  setProgress(30, '📦 กำลังคัดลอก Mods...');
  elements.btnText.textContent = 'COPYING MODS...';

  try {
    const destModsPath = gamePath + '\\mods';
    const copyResult = await window.electronAPI.copyMods(CONFIG.modsSourcePath, destModsPath);

    if (!copyResult.success) {
      throw new Error(`คัดลอก Mods ไม่สำเร็จ: ${copyResult.error}`);
    }

    log(`✅ คัดลอก Mods สำเร็จ: ${copyResult.count} ไฟล์`, 'info');
  } catch (error) {
    log(`⚠️ คัดลอก Mods: ${error.message}`, 'warning');
    // Continue — mods might already exist
  }

  // Step 1.5: Copy Configs (e.g. FancyMenu)
  setProgress(40, '🗂️ กำลังเตรียมตั้งค่าเกม...');
  try {
    const destConfigsPath = gamePath + '\\config';
    const copyConfigsResult = await window.electronAPI.copyConfigs(CONFIG.configsSourcePath, destConfigsPath);

    if (!copyConfigsResult.success) {
      throw new Error(`คัดลอก Configs ไม่สำเร็จ: ${copyConfigsResult.error}`);
    }

    if (copyConfigsResult.count !== 0) {
      log(`✅ อัปเดตการตั้งค่าเมนู (Configs) สำเร็จ`, 'info');
    }
  } catch (error) {
    log(`⚠️ คัดลอก Configs: ${error.message}`, 'warning');
  }

  // Step 1.6: Sync Keybinds
  try {
    const syncResult = await window.electronAPI.syncKeybinds(CONFIG.defaultsSourcePath, gamePath);
    if (!syncResult.success) {
      log(`⚠️ ซิงค์ข้อมูลการตั้งค่า: ${syncResult.error}`, 'warning');
    } else if (syncResult.message.includes('Merged') || syncResult.message.includes('Copied')) {
      log(`✅ อัปเดตการตั้งค่าระบบ (Options/Keybinds) สำเร็จ`, 'info');
    }
  } catch (error) {
    log(`⚠️ ซิงค์ข้อมูลการตั้งค่า: ${error.message}`, 'warning');
  }

  // Step 1.7: Copy Resource Packs
  setProgress(45, '🎨 กำลังเตรียม Resource Packs...');
  try {
    const destResourcePacksPath = gamePath + '\\resourcepacks';
    const copyRpResult = await window.electronAPI.copyResourcePacks(CONFIG.resourcepacksSourcePath, destResourcePacksPath);

    if (!copyRpResult.success) {
      throw new Error(`คัดลอก Resource Packs ไม่สำเร็จ: ${copyRpResult.error}`);
    } else if (copyRpResult.count !== 0 && destResourcePacksPath !== '') {
      log(`✅ อัปเดต Resource Packs สำเร็จ`, 'info');
    }
  } catch (error) {
    log(`⚠️ คัดลอก Resource Packs: ${error.message}`, 'warning');
  }

  // Step 2: Check/Install Fabric
  setProgress(55, '🔧 ตรวจสอบ Fabric Loader...');
  elements.btnText.textContent = 'CHECKING FABRIC...';

  let fabricVersionName = null;
  try {
    let fabricCheck = await window.electronAPI.checkFabric(gamePath);
    if (!fabricCheck.installed) {
      setProgress(60, '🔧 กำลังติดตั้ง Fabric Loader...');
      elements.btnText.textContent = 'INSTALLING FABRIC...';
      log('📥 กำลังติดตั้ง Fabric Loader...', 'info');

      const installResult = await window.electronAPI.installFabric(gamePath, '1.21.1', '1.0.1');
      if (!installResult.success) {
        throw new Error(`ติดตั้ง Fabric ไม่สำเร็จ: ${installResult.error}`);
      }
      log('✅ ติดตั้ง Fabric Loader สำเร็จ!', 'info');
      fabricCheck = await window.electronAPI.checkFabric(gamePath);
    }
    fabricVersionName = fabricCheck.version;
    log(`✅ Fabric version: ${fabricVersionName}`, 'info');
  } catch (error) {
    log(`⚠️ Fabric: ${error.message}`, 'warning');
  }

  // Step 3: Launch Minecraft + Auto-connect to Server
  setProgress(80, '🚀 กำลังเปิด Minecraft...');
  elements.btnText.textContent = 'LAUNCHING...';

  try {
    log(`🌐 เชื่อมต่อเซิร์ฟเวอร์อัตโนมัติ: ${CONFIG.serverIp}:${CONFIG.serverPort}`, 'info');

    const result = await window.electronAPI.launchMinecraft({
      username: username,
      gamePath: gamePath,
      memory: memory,
      serverIp: CONFIG.serverIp,
      serverPort: CONFIG.serverPort,
      version: {
        number: '1.21.1',
        type: 'release'
      },
      fabricVersion: fabricVersionName
    });

    if (result.success) {
      setProgress(90, 'กำลังติดตั้งตัวเกมส์...');
      elements.btnText.textContent = 'Please wait...';
      log('✅ Minecraft เริ่มต้นสำเร็จ! กำลังโหลดข้อมูล โปรดรอ...', 'info');
    } else {
      throw new Error(result.error);
    }
  } catch (error) {
    isLaunching = false;
    elements.launchBtn.disabled = false;
    setProgress(0, 'พร้อมเล่น');
    elements.btnText.textContent = 'PLAY GAME';
    log(`❌ เกิดข้อผิดพลาด: ${error.message}`, 'error');
  }
}

// ==================
//  Logging
// ==================
function log(message, type = 'info') {
  const timestamp = new Date().toLocaleTimeString('th-TH');
  const logEntry = document.createElement('div');
  logEntry.className = `log-${type}`;
  logEntry.textContent = `[${timestamp}] ${message}`;

  elements.consoleOutput.appendChild(logEntry);
  elements.consoleOutput.scrollTop = elements.consoleOutput.scrollHeight;

  // Keep only last 200 logs
  while (elements.consoleOutput.children.length > 200) {
    elements.consoleOutput.removeChild(elements.consoleOutput.firstChild);
  }
}

// ==================
//  Java Install UI
// ==================
function showJavaInstallButton() {
  const javaStatus = document.getElementById('javaStatus');

  // Avoid duplicates
  if (javaStatus.querySelector('.java-install-btn')) return;

  const installBtn = document.createElement('button');
  installBtn.textContent = '📦 Install Java 21';
  installBtn.className = 'java-install-btn';

  installBtn.addEventListener('click', async () => {
    installBtn.textContent = '⏳ Installing...';
    installBtn.disabled = true;

    try {
      const result = await window.electronAPI.installJava();
      if (result.success) {
        log('✅ ติดตั้ง Java 21 สำเร็จ!', 'info');
        setTimeout(() => checkRequirements(), 2000);
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      log(`❌ ติดตั้ง Java ล้มเหลว: ${error.message}`, 'error');
      installBtn.textContent = '🔄 Retry';
      installBtn.disabled = false;
    }
  });

  javaStatus.appendChild(installBtn);
}

// ==================
//  Utilities
// ==================
function shakeElement(el) {
  el.classList.add('shake');
  el.style.borderColor = '#EF5350';
  el.focus();
  setTimeout(() => {
    el.classList.remove('shake');
    el.style.borderColor = '';
  }, 600);
}

// CSS for shake animation (injected)
const shakeStyle = document.createElement('style');
shakeStyle.textContent = `
  @keyframes shake {
    0%, 100% { transform: translateX(0); }
    20% { transform: translateX(-6px); }
    40% { transform: translateX(6px); }
    60% { transform: translateX(-4px); }
    80% { transform: translateX(4px); }
  }
  .shake { animation: shake 0.4s ease; }
`;
document.head.appendChild(shakeStyle);

// ==================
//  Start App
// ==================
init();
