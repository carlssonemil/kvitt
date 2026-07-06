self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

// When the app is launched from the home screen, a failed navigation request
// (e.g. the server cold-starting) makes WKWebView show its own generic
// "This page couldn't load" error screen before any of our React code can
// run. Serve a small fallback page instead that matches our in-app loading
// state and retries on its own.
const OFFLINE_HTML = `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Kvitt</title>
<style>
  html, body { height: 100%; margin: 0; }
  body {
    display: flex;
    align-items: center;
    justify-content: center;
    background: #ffffff;
    color: #171717;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  }
  @media (prefers-color-scheme: dark) {
    body { background: #262626; color: #fafafa; }
  }
  .wrap { display: flex; flex-direction: column; align-items: center; gap: 12px; text-align: center; padding: 24px; }
  h1 { font-size: 1rem; font-weight: 600; margin: 0; }
  p { font-size: 0.875rem; opacity: 0.7; margin: 0; max-width: 20rem; }
  .spinner {
    width: 28px; height: 28px;
    border-radius: 50%;
    border: 3px solid currentColor;
    border-top-color: transparent;
    opacity: 0.6;
    animation: spin 0.8s linear infinite;
  }
  @keyframes spin { to { transform: rotate(360deg); } }
  button {
    margin-top: 4px;
    padding: 8px 16px;
    border-radius: 6px;
    border: 1px solid currentColor;
    background: transparent;
    color: inherit;
    font: inherit;
    opacity: 0.8;
  }
</style>
</head>
<body>
  <div class="wrap">
    <div class="spinner" id="spinner"></div>
    <h1 id="title">Connecting...</h1>
    <p id="message">Warming up the database, please wait.</p>
    <button id="reload" hidden onclick="location.reload()">Reload</button>
  </div>
  <script>
    (function () {
      var KEY = 'kvitt-sw-offline-retry-at';
      var last = Number(sessionStorage.getItem(KEY) || 0);
      var now = Date.now();
      if (now - last > 10000) {
        sessionStorage.setItem(KEY, String(now));
        setTimeout(function () { location.reload(); }, 3000);
      } else {
        document.getElementById('spinner').hidden = true;
        document.getElementById('title').textContent = 'Still having trouble';
        document.getElementById('message').textContent = 'Check your connection and try again.';
        document.getElementById('reload').hidden = false;
      }
    })();
  </script>
</body>
</html>`;

self.addEventListener('fetch', (event) => {
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(
        () => new Response(OFFLINE_HTML, { headers: { 'Content-Type': 'text/html; charset=utf-8' } })
      )
    );
    return;
  }
  event.respondWith(fetch(event.request));
});
