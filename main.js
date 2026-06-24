const { app, BrowserWindow, globalShortcut, ipcMain, screen, Menu, shell } = require('electron');

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

function createWindow() {
  const disp = targetDisplay();
  const b = disp.bounds;
  win = new BrowserWindow({
    x: b.x, y: b.y, width: b.width, height: b.height,
    fullscreen: true,           // מסך מלא רגיל
    autoHideMenuBar: true,
    minimizable: true,          // אפשר למזער
    maximizable: true,
    webPreferences: { devTools: false, contextIsolation: true }
  });
  win.loadURL(APP_URL);

  // הגנה רק על סגירה: לא ייסגר בלי קוד מנהל (מזעור עדיין מותר)
  win.on('close', (e) => { if (!allowQuit) e.preventDefault(); });

  // קישורים חיצוניים (כמו בדיקת תו נכה) — חלון צף נפרד מעל האפליקציה
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith(APP_URL)) return { action: 'allow' };
    openExternal(url);
    return { action: 'deny' };
  });
  // אם האפליקציה מנסה לנווט החוצה (לא בחלון חדש) — נפתח חיצונית במקום
  win.webContents.on('will-navigate', (e, url) => {
    if (!url.startsWith(APP_URL)) { e.preventDefault(); openExternal(url); }
  });

  // חוסם רק מקשים מסוכנים — הקלדה רגילה ולחיצות עובדות כרגיל
  win.webContents.on('before-input-event', (e, input) => {
    const k = (input.key || '').toLowerCase();
    const ctrl = input.control || input.meta;
    if (k === 'f5' || k === 'f11' || k === 'f12' ||
        (ctrl && k === 'r') ||
        (ctrl && input.shift && k === 'i') ||
        (ctrl && input.shift && k === 'r')) {
      e.preventDefault();
    }
  });
}

// חלון צף מעל האפליקציה לאתרים חיצוניים (תו נכה וכו')
let extWin = null;
function openExternal(url) {
  if (extWin && !extWin.isDestroyed()) {
    extWin.loadURL(url); extWin.focus(); return;
  }
  extWin = new BrowserWindow({
    width: 520, height: 800, alwaysOnTop: true, parent: win,
    title: 'אינפיניגארד', autoHideMenuBar: true,
    webPreferences: { contextIsolation: true }
  });
  extWin.loadURL(url);
  extWin.on('closed', () => { extWin = null; });
}

function moveToNextDisplay() {
  const all = displays();
  if (all.length < 2) return;
  dispIndex = (dispIndex + 1) % all.length;
  const b = all[dispIndex].bounds;
  win.setFullScreen(false);
  win.setBounds({ x: b.x, y: b.y, width: b.width, height: b.height });
  win.setFullScreen(true);
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
  if (promptWin && !promptWin.isDestroyed()) { promptWin.focus(); return; }
  promptWin = new BrowserWindow({
    width: 320, height: 210, frame: false, alwaysOnTop: true,
    resizable: false, parent: win, modal: true, skipTaskbar: true,
    webPreferences: { nodeIntegration: true, contextIsolation: false, devTools: false }
  });
  promptWin.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(PROMPT_HTML));
  promptWin.on('closed', () => { promptWin = null; });
}

ipcMain.on('exit-try', (ev, code) => {
  if (String(code) === EXIT_CODE) { allowQuit = true; app.exit(0); }
  else { ev.sender.send('exit-wrong'); }
});
ipcMain.on('exit-cancel', () => { if (promptWin && !promptWin.isDestroyed()) promptWin.close(); });

app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  createWindow();
  globalShortcut.register('Control+Alt+Shift+Q', openExitPrompt);   // יציאה (קוד)
  globalShortcut.register('Control+Alt+Shift+M', moveToNextDisplay); // העבר צג
});

app.on('will-quit', () => globalShortcut.unregisterAll());
app.on('window-all-closed', () => app.exit(0));
