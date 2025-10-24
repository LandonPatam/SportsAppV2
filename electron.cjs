const { app, BrowserWindow } = require('electron');
const { spawn } = require('child_process');
const path = require('path');

function runPythonScripts() {
  const scripts = [
    path.join(__dirname, 'src', 'f1data.py'),
    path.join(__dirname, 'src', 'nbadata.py'),
    path.join(__dirname, 'src', 'nfl_team_stats.py'),
    path.join(__dirname, 'src', 'ufcdata.py')
  ];

  for (const script of scripts) {
    const process = spawn('python', [script]);
    process.stdout.on('data', data => console.log(`[${path.basename(script)}]: ${data}`));
    process.stderr.on('data', data => console.error(`[ERROR ${path.basename(script)}]: ${data}`));
  }
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  win.loadFile(path.join(__dirname, 'dist', 'index.html'));

}

app.whenReady().then(() => {
  // Run Python scripts first
  runPythonScripts();

  // Start your React app
  const reactProcess = spawn('npm', ['run', 'dev'], { shell: true });
  reactProcess.stdout.on('data', data => console.log(`[React]: ${data}`));
  reactProcess.stderr.on('data', data => console.error(`[React ERROR]: ${data}`));

  // Give the server a few seconds to start before opening the window
  setTimeout(() => {
    createWindow();
  }, 5000);
});
