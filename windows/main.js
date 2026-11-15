/* Atmos Studio — Windows omotač (Electron)
   Otvara sajt aplikacije u sopstvenom prozoru. Sadržaj se ažurira sam sa sajta
   (isti service worker kao PWA), a bez interneta radi iz keša. */
const { app, BrowserWindow, Menu, shell, session } = require('electron');
const path = require('path');

const APP_URL = 'https://gembirdt-bit.github.io/atmosstudio/index.html';
const SCOPE = 'https://gembirdt-bit.github.io/atmosstudio/';
const OFFLINE = path.join(__dirname, 'offline.html');

if (!app.requestSingleInstanceLock()) { app.quit(); }

// Oznaka po kojoj sajt zna da je otvoren iz Windows programa (iz pregledača se traži preuzimanje aplikacije).
// Postavlja se pre pokretanja, i još jednom na sesiji i prozoru, da važi za sve zahteve.
const UA_TAG = ' AtmosStudioApp/' + app.getVersion();
app.userAgentFallback = app.userAgentFallback + UA_TAG;
const withTag = ua => ua.includes('AtmosStudioApp') ? ua : ua + UA_TAG;

let win;
const inScope = u => typeof u === 'string' && u.startsWith(SCOPE);
const isWeb = u => /^https?:/i.test(u);
const isGoogleAuth = u => /^https:\/\/accounts\.google\.com\//.test(u || '');
/* Google ne dozvoljava prijavu iz „ugrađenih“ pregledača — za Google stranice šaljemo običan Chrome user-agent */
const plainUA = ua => ua.replace(/\s*Electron\/[\d.]+/, '').replace(/\s*AtmosStudioApp\/[\d.]+/, '').replace(/\s*atmos-studio\/[\d.]+/, '');

function openExternal(url) {
  // wa.me, viber://, sms:, tel:, mailto:, linkovi ka drugim sajtovima → sistemska aplikacija / pregledač
  shell.openExternal(url).catch(() => {});
}

function createWindow() {
  win = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 360,
    minHeight: 500,
    backgroundColor: '#141218',
    title: 'Atmos Studio',
    icon: path.join(__dirname, 'icon.png'),
    autoHideMenuBar: true,
    show: false,
    webPreferences: { contextIsolation: true, sandbox: true, spellcheck: false }
  });
  win.once('ready-to-show', () => win.show());

  const wc = win.webContents;

  // Novi prozori: unutar aplikacije ostaju u aplikaciji, ostalo ide napolje
  wc.setWindowOpenHandler(({ url }) => {
    // prijava na Google (Google Drive sinhronizacija) ostaje u prozoru aplikacije
    if (isGoogleAuth(url)) {
      return { action: 'allow', overrideBrowserWindowOptions: { width: 500, height: 680, autoHideMenuBar: true, parent: win, modal: false, icon: path.join(__dirname, 'icon.png') } };
    }
    if (inScope(url) || url === 'about:blank' || url.startsWith('blob:')) {
      return { action: 'allow', overrideBrowserWindowOptions: { autoHideMenuBar: true, icon: path.join(__dirname, 'icon.png') } };
    }
    openExternal(url);
    return { action: 'deny' };
  });

  // location.href = 'sms:…' / 'viber://…' i linkovi van aplikacije
  wc.on('will-navigate', (e, url) => {
    if (inScope(url) || url.startsWith('file:')) return;
    e.preventDefault();
    openExternal(url);
  });

  // Nema interneta pri prvom pokretanju (pre nego što se keš napuni) → poruka sa „Pokušaj ponovo“
  wc.on('did-fail-load', (e, code, desc, url, isMain) => {
    if (!isMain || code === -3 /* prekinuto */ || !isWeb(url)) return;
    win.loadFile(OFFLINE);
  });

  // Desni klik: iseci / kopiraj / nalepi
  wc.on('context-menu', (e, p) => {
    const items = [];
    if (p.isEditable) {
      items.push({ label: 'Iseci', role: 'cut', enabled: p.editFlags.canCut },
                 { label: 'Kopiraj', role: 'copy', enabled: p.editFlags.canCopy },
                 { label: 'Nalepi', role: 'paste', enabled: p.editFlags.canPaste },
                 { type: 'separator' },
                 { label: 'Izaberi sve', role: 'selectAll' });
    } else if (p.selectionText) {
      items.push({ label: 'Kopiraj', role: 'copy' });
    }
    if (p.linkURL && isWeb(p.linkURL) && !inScope(p.linkURL)) {
      items.push({ label: 'Otvori link u pregledaču', click: () => openExternal(p.linkURL) });
    }
    if (items.length) Menu.buildFromTemplate(items).popup({ window: win });
  });

  // Prečice: F5 osveži, Ctrl +/−/0 zum, F11 ceo ekran, Ctrl+Shift+I alati (za podršku)
  wc.on('before-input-event', (e, i) => {
    if (i.type !== 'keyDown') return;
    const k = i.key, ctrl = i.control || i.meta;
    if (k === 'F5' || (ctrl && k.toLowerCase() === 'r')) { wc.reload(); e.preventDefault(); }
    else if (k === 'F11') { win.setFullScreen(!win.isFullScreen()); e.preventDefault(); }
    else if (ctrl && (k === '+' || k === '=')) { wc.setZoomLevel(wc.getZoomLevel() + 0.5); e.preventDefault(); }
    else if (ctrl && k === '-') { wc.setZoomLevel(wc.getZoomLevel() - 0.5); e.preventDefault(); }
    else if (ctrl && k === '0') { wc.setZoomLevel(0); e.preventDefault(); }
    else if (ctrl && i.shift && k.toLowerCase() === 'i') { wc.toggleDevTools(); e.preventDefault(); }
  });

  wc.setUserAgent(withTag(wc.getUserAgent()));
  win.loadURL(APP_URL, { userAgent: wc.getUserAgent() });
}

app.on('second-instance', () => {
  if (win) { if (win.isMinimized()) win.restore(); win.focus(); }
});

app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  session.defaultSession.setUserAgent(withTag(session.defaultSession.getUserAgent()));
  app.setAppUserModelId('io.github.gembirdt-bit.atmosstudio');

  session.defaultSession.webRequest.onBeforeSendHeaders({ urls: ['https://accounts.google.com/*', 'https://*.google.com/*', 'https://*.gstatic.com/*'] }, (d, cb) => {
    d.requestHeaders['User-Agent'] = plainUA(d.requestHeaders['User-Agent'] || '');
    cb({ requestHeaders: d.requestHeaders });
  });
  app.on('web-contents-created', (e, c) => c.on('did-start-navigation', (ev, url) => { if (isGoogleAuth(url)) c.setUserAgent(plainUA(c.getUserAgent())); }));

  // Dozvole koje aplikacija koristi: obaveštenja (podsetnici),
  // folder za automatski backup, kopiranje u clipboard. Samo za sajt aplikacije.
  const allowed = new Set(['media', 'notifications', 'fileSystem', 'clipboard-sanitized-write', 'clipboard-read', 'persistent-storage', 'fullscreen']);
  const ok = (wc, perm, origin) => allowed.has(perm) && (
    (origin && SCOPE.startsWith(origin)) || (wc && (inScope(wc.getURL()) || wc.getURL().startsWith('file:'))));
  session.defaultSession.setPermissionRequestHandler((wc, perm, cb, details) =>
    cb(ok(wc, perm, details && details.requestingUrl ? new URL(details.requestingUrl).origin : '')));
  session.defaultSession.setPermissionCheckHandler((wc, perm, origin) => ok(wc, perm, origin));

  createWindow();
});

app.on('window-all-closed', () => app.quit());
