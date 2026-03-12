const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const projectDir = __dirname;
const sourceDir = path.join(projectDir, 'frontend');
const tempDir = 'C:\\Temp\\ironwall_v2_build';
const appDir = path.join(tempDir, 'app');

console.log('Cleaning up previous build environments...');
if (fs.existsSync(tempDir)) {
    fs.rmSync(tempDir, { recursive: true, force: true });
}
fs.mkdirSync(appDir, { recursive: true });

console.log('Copying frontend assets...');
function copyDir(src, dest) {
    fs.mkdirSync(dest, { recursive: true });
    let entries = fs.readdirSync(src, { withFileTypes: true });
    for (let entry of entries) {
        let srcPath = path.join(src, entry.name);
        let destPath = path.join(dest, entry.name);
        if (entry.name === 'node_modules' || entry.name.endsWith('.apk') || entry.name.endsWith('.exe')) continue;
        if (entry.isDirectory()) {
            copyDir(srcPath, destPath);
        } else {
            fs.copyFileSync(srcPath, destPath);
        }
    }
}

copyDir(sourceDir, appDir);

const packageJson = {
    name: "ironwall-gamethon",
    version: "3.2.0",
    description: "IronWall+ Unified Command Center",
    main: "main.js",
    scripts: {
        "start": "electron .",
        "build": "electron-packager . \"ironwall-gamethon-desktop\" --platform=win32 --arch=x64 --out=dist --overwrite --icon=app/icon.png"
    },
    devDependencies: {
        "electron": "^33.0.0",
        "electron-packager": "^17.1.2"
    }
};

fs.writeFileSync(path.join(tempDir, 'package.json'), JSON.stringify(packageJson, null, 2));

const mainJs = `
const { app, BrowserWindow } = require('electron');
const path = require('path');

function createWindow () {
  const win = new BrowserWindow({
    width: 1280,
    height: 720,
    fullscreen: true,
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  win.loadFile('app/webapp.html');
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
`;

fs.writeFileSync(path.join(tempDir, 'main.js'), mainJs);

console.log('Installing Electron dependencies...');
execSync('npm install', { cwd: tempDir, stdio: 'inherit' });

console.log('Building Windows Executable...');
execSync('npm run build', { cwd: tempDir, stdio: 'inherit' });

function findExe(dir) {
    let files = fs.readdirSync(dir);
    for (let file of files) {
        let fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            let res = findExe(fullPath);
            if (res) return res;
        } else if (fullPath.endsWith('.exe')) {
            return fullPath;
        }
    }
    return null;
}

const exePath = findExe(path.join(tempDir, 'dist'));
if (exePath) {
    console.log('Copying new executable completely to project structure...');
    fs.copyFileSync(exePath, path.join(projectDir, 'public_site', 'ironwall-gamethon-desktop.exe'));
    fs.copyFileSync(exePath, path.join(projectDir, 'frontend', 'ironwall-gamethon-desktop.exe'));
    console.log('Update Complete!');
} else {
    console.log('Failed to find generated executable.');
}
