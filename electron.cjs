const { app, BrowserWindow } = require('electron');
const path = require('path');
const { spawn } = require('child_process');

let intervals = [];

function runPythonScript(script, intervalMs) {
  const run = () => {
    const scriptPath = path.join(__dirname, 'data', script);
    console.log(`Running: ${scriptPath}`);

    const process = spawn('py', ['-u', scriptPath], { cwd: __dirname });

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
  };

  run();
  const id = setInterval(run, intervalMs);
  intervals.push(id);
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

  runPythonScript('data_NBAV2.py', 120_000);
  runPythonScript('data_NFLV2.py', 120_000);
  runPythonScript('NBA_BPI.py', 120_000);
  runPythonScript('schedule_NBA.py', 60_000);
  runPythonScript('schedule_NFL.py', 60_000);
});

app.on('window-all-closed', () => {
  intervals.forEach(clearInterval);
  app.quit();
});
