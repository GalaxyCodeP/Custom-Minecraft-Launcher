# Custom Minecraft Launcher 1.21.1

Custom Minecraft Launcher for Server
Launcher สำหรับ Minecraft 1.21.1 แบบ Offline Mode - เข้าเล่นเซิร์ฟเวอร์พร้อม Mod ครบชุด

## English Description

This is a custom Minecraft 1.21.1 launcher tailored for a specific server. It features an offline mode, pre-installed mods, auto-connect to the server, and a modern UI.

**Features:**
- ✅ **Offline Mode** - No Microsoft/Mojang account required
- ✅ **Pre-installed Mods** - Mods are ready to use
- ✅ **Auto-connect Server** - Automatically connects to the configured server
- ✅ **Modern UI** - Clean and easy-to-use interface
- ✅ **RAM Configuration** - Easy RAM allocation adjustment

**Requirements:**
- Windows 10/11
- Java 17 or higher
- RAM 4GB+ (8GB+ recommended)

**Installation:**
1. Install Java 17+ from https://adoptium.net/
2. Run `npm install` to install dependencies
3. Run `npm start` to open the launcher

## คุณสมบัติ (Thai)

- ✅ **Offline Mode** - ไม่ต้องมีบัญชี Microsoft/Mojang
- ✅ **Pre-installed Mods** - Mod พร้อมใช้งาน
- ✅ **Auto-connect Server** - เชื่อมต่อเซิร์ฟเวอร์อัตโนมัติ
- ✅ **Modern UI** - อินเตอร์เฟซสวยงาม ใช้งานง่าย
- ✅ **RAM Configuration** - ปรับ RAM ได้ตามต้องการ

## ความต้องการของระบบ

- Windows 10/11
- Java 17 หรือสูงกว่า
- RAM 4GB+ (แนะนำ 8GB+)

## การติดตั้ง

### 1. ติดตั้ง Java 17+
ดาวน์โหลดจาก: https://adoptium.net/

เลือก:
- Operating System: Windows
- Architecture: x64
- Package Type: JDK
- Version: 17 (LTS)

### 2. ติดตั้ง Dependencies
```bash
npm install
```

### 3. รัน Launcher
```bash
npm start
```

## การใช้งาน

1. **กรอกชื่อผู้ใช้** - ใส่ชื่อที่ต้องการ (3-16 ตัวอักษร a-z, A-Z, 0-9, _)
2. **เลือก RAM** - แนะนำ 4GB สำหรับ Modded
3. **กด START GAME** - Minecraft จะดาวน์โหลดและรันอัตโนมัติ

## การตั้งค่าเซิร์ฟเวอร์

1. กดปุ่ม ⚙️ (มุมขวาล่าง)
2. แก้ไข Server IP และ Port
3. บันทึก

## การใส่ Mods

แก้ไขไฟล์ `renderer/app.js` ในส่วน `CONFIG.mods`:

```javascript
mods: [
  {
    name: 'Fabric API',
    url: 'https://...',
    filename: 'fabric-api-0.92.0+1.21.1.jar'
  }
]
```

หรือวางไฟล์ .jar ลงในโฟลเดอร์ `.minecraft/mods/` เอง

## การ Build

สร้างไฟล์ Portable (.exe):
```bash
npm run build:win
```

ไฟล์จะอยู่ใน `dist/`

## โครงสร้างโปรเจกต์

```
├── main.js           # Electron main process
├── preload.js        # Preload script (IPC)
├── renderer/
│   ├── index.html    # UI หลัก
│   ├── styles.css    # สไตล์
│   └── app.js        # Logic หลัก
├── package.json
└── README.md
```

## หมายเหตุ

- โหมด Offline ใช้ UUID ที่สร้างจากชื่อผู้ใช้ (ไม่ใช่ UUID จริง)
- ครั้งแรกจะดาวน์โหลด Minecraft ~500MB
- Mod ติดตั้งใน `.minecraft/mods/`

## License

MIT
