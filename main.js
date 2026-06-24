const { app, BrowserWindow, globalShortcut, ipcMain, screen, Menu } = require('electron');

// ====== הגדרות ======
const APP_URL   = 'https://hosting-shifts-infinity-park.netlify.app/';
const EXIT_CODE = '4321';   // קוד יציאה למנהל — אפשר לשנות
// =====================

let win, allowQuit = false, dispIndex = 0;

function displays() { return screen.getAllDisplays(); }

function targetDisplay() {
  const all = displays();
  const primary = screen.getPrimaryDisplay();
  const ext = all.find(d => d.id !== primary.id);
  const chosen = ext || primary;
  dispIndex = all.findIndex(d => d.id === chosen.id);
  return chosen;
}

function placeOn(disp) {
  const b = disp.bounds;
  win.setBounds({ x: b.x, y: b.y, width: b.width, height: b.height });
  win.setFullScreen(true);
  win.setAlwaysOnTop(true, 'screen-saver');
}

function createWindow() {
  const disp = targetDisplay();
  const b = disp.bounds;
  win = new BrowserWindow({
    x: b.x, y: b.y, width: b.width, height: b.height,
    fullscreen: true, kiosk: true, alwaysOnTop: true,
    frame: false, autoHideMenuBar: true,
    closable: false, minimizable: false, maximizable: false,
    webPreferences: { devTools: false, contextIsolation: true }
  });
  win.setAlwaysOnTop(true, 'screen-saver');
  win.loadURL(APP_URL);

  win.on('close', (e) => { if (!allowQuit) e.preventDefault(); });
  win.on('leave-full-screen', () => { if (!allowQuit) win.setFullScreen(true); });

  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', (e, url) => {
    if (!url.startsWith(APP_URL)) e.preventDefault();
  });
  win.webContents.on('context-menu', (e) => e.preventDefault());
  win.webContents.on('before-input-event', (e, input) => {
    const k = (input.key || '').toLowerCase();
    const ctrl = input.control || input.meta;
    if (k === 'f5' || k === 'f11' || k === 'f12' ||
        (ctrl && k === 'r') || (ctrl && k === 'w') ||
        (ctrl && input.shift && k === 'i') ||
        (ctrl && input.shift && k === 'r') ||
        (input.alt && k === 'f4')) {
      e.preventDefault();
    }
  });
}

function moveToNextDisplay() {
  const all = displays();
  if (all.length < 2) return;
  dispIndex = (dispIndex + 1) % all.length;
  placeOn(all[dispIndex]);
}

const PROMPT_HTML = `<!doctype html><html dir="rtl"><body style="margin:0;font-family:Arial,sans-serif;direction:rtl;background:#101B2D;color:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh">
<div style="font-size:15px;margin-bottom:12px">\u05e7\u05d5\u05d3 \u05d9\u05e6\u05d9\u05d0\u05d4</div>
<input id="c" type="password" autofocus style="font-size:18px;padding:8px;width:180px;text-align:center;border-radius:8px;border:none">
<div id="err" style="color:#ff6b6b;height:16px;font-size:12px;margin-top:6px"></div>
<div style="margin-top:10px;display:flex;gap:8px">
<button onclick="go()" style="padding:8px 16px;border:none;border-radius:8px;background:#0EA5A4;color:#fff;cursor:pointer">\u05d9\u05e6\u05d9\u05d0\u05d4</button>
<button onclick="cancel()" style="padding:8px 16px;border:none;border-radius:8px;background:#33415c;color:#fff;cursor:pointer">\u05d1\u05d9\u05d8\u05d5\u05dc</button>
</div>
<script>
const { ipcRenderer } = require('electron');
function go(){ ipcRenderer.send('exit-try', document.getElementById('c').value); }
function cancel(){ ipcRenderer.send('exit-cancel'); }
document.getElementById('c').addEventListener('keydown', function(e){ if(e.key==='Enter') go(); });
ipcRenderer.on('exit-wrong', function(){ document.getElementById('err').textContent='\u05e7\u05d5\u05d3 \u05e9\u05d2\u05d5\u05d9'; document.getElementById('c').value=''; });
</script></body></html>`;

let promptWin = null;
function openExitPrompt() {
  if (promptWin) { try { promptWin.focus(); } catch (_) {} return; }
  promptWin = new BrowserWindow({
    width: 320, height: 210, frame: false, alwaysOnTop: true,
    resizable: false, parent: win, modal: true, skipTaskbar: true,
    webPreferences: { nodeIntegration: true, contextIsolation: false, devTools: false }
  });
  promptWin.setAlwaysOnTop(true, 'screen-saver');
  promptWin.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(PROMPT_HTML));
  promptWin.on('closed', () => { promptWin = null; });
}

ipcMain.on('exit-try', (ev, code) => {
  if (String(code) === EXIT_CODE) { allowQuit = true; app.exit(0); }
  else { ev.sender.send('exit-wrong'); }
});
ipcMain.on('exit-cancel', () => { if (promptWin) promptWin.close(); });

app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  createWindow();
  globalShortcut.register('Control+Alt+Shift+Q', openExitPrompt);
  globalShortcut.register('Control+Alt+Shift+M', moveToNextDisplay);
});

app.on('will-quit', () => globalShortcut.unregisterAll());
app.on('window-all-closed', () => app.exit(0));
