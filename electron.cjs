const { app, BrowserWindow } = require('electron');
const path = require('path');
const { spawn } = require('child_process');

let scheduler;

function runPythonScript(script) {
  const scriptPath = path.join(__dirname, 'data', script);
  console.log(`Running: ${scriptPath}`);

  const process = spawn('py', ['-u', scriptPath], { cwd: __dirname, windowsHide: true });
  scheduler = process;

  process.stdout.on('data', (data) =>
    console.log(`[${script}] ${data.toString().trim()}`)
  );
  process.stderr.on('data', (data) =>
    console.error(`[ERROR ${script}] ${data.toString().trim()}`)
  );
  process.on('error', (err) =>
    console.error(`[SPAWN ERROR ${script}] ${err.message}`)
  );
  process.on('close', (code) =>
    console.log(`[${script}] exited with code ${code}`)
  );
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1300,
    height: 900,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  win.loadURL('http://localhost:8080');
}

app.whenReady().then(() => {
  createWindow();

  runPythonScript('file_loop.py');
});

app.on('window-all-closed', () => {
  app.quit();
});

app.on('before-quit', () => {
  if (scheduler && scheduler.exitCode === null && scheduler.pid) {
    if (process.platform === 'win32') {
      spawn('taskkill', ['/pid', String(scheduler.pid), '/t', '/f'], { windowsHide: true });
    } else {
      scheduler.kill('SIGINT');
    }
  }
});
