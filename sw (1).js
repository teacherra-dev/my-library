// 나의 서재 — 인터넷이 끊겨도 서재가 열리도록 앱 파일을 기억해 두는 서비스 워커
// (책 기록 자체는 파이어베이스가 기기 안에 따로 적어 두었다가 다시 연결되면 올려요)
const V = "my-library-v3";
const IMG = "my-library-img";
const SHELL = ["./", "./index.html", "./manifest.webmanifest", "./icon-192.png", "./icon-512.png", "./apple-icon.png"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(V).then(c => Promise.all(SHELL.map(u => c.add(u).catch(() => {})))).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== V && k !== IMG).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

// 기록 저장·로그인·AI·책 검색은 늘 인터넷으로 (건드리지 않는다)
const SKIP = /firestore\.googleapis|identitytoolkit|securetoken|firebaseinstallations|firebaselogging|firebasevertexai|generativelanguage|aiplatform|content-firebaseappcheck|recaptcha\/(api|enterprise)\/|script\.google|script\.googleusercontent|youtube|googlevideo/;

async function trimImages() {
  const c = await caches.open(IMG), ks = await c.keys();
  for (let i = 0; i < ks.length - 400; i++) await c.delete(ks[i]);
}

self.addEventListener("fetch", e => {
  const r = e.request;
  if (r.method !== "GET") return;
  const u = new URL(r.url);
  if (SKIP.test(u.href)) return;
  const same = u.origin === self.location.origin;

  // 서재 화면(index.html): 먼저 인터넷에서 새것을 받고, 끊겼으면 기억해 둔 것을 연다
  if (same && (r.mode === "navigate" || /\.html$/.test(u.pathname))) {
    e.respondWith((async () => {
      const c = await caches.open(V);
      try {
        const res = await fetch(r);
        if (res && res.ok) c.put(new Request(u.origin + u.pathname), res.clone());
        return res;
      } catch {
        return (await c.match(new Request(u.origin + u.pathname))) || (await c.match(r, { ignoreSearch: true })) || (await c.match("./index.html")) || (await c.match("./")) || Response.error();
      }
    })());
    return;
  }

  // 앱 파일·글꼴·파이어베이스 프로그램: 기억해 둔 것을 먼저 쓰고, 뒤에서 새로 받아 둔다
  if (same || /(^|\.)gstatic\.com$|fonts\.googleapis\.com$/.test(u.host)) {
    e.respondWith((async () => {
      const c = await caches.open(V), hit = await c.match(r);
      const net = fetch(r).then(res => { if (res && (res.ok || res.type === "opaque")) c.put(r, res.clone()); return res; }).catch(() => null);
      if (hit) { e.waitUntil(net); return hit; }
      return (await net) || Response.error();
    })());
    return;
  }

  // 책 표지 그림: 한 번 본 표지는 기억해 두었다가 끊겨도 보여 준다
  if (r.destination === "image") {
    e.respondWith((async () => {
      const c = await caches.open(IMG), hit = await c.match(r);
      if (hit) return hit;
      try {
        const res = await fetch(r);
        if (res && (res.ok || res.type === "opaque")) { c.put(r, res.clone()); e.waitUntil(trimImages()); }
        return res;
      } catch { return Response.error(); }
    })());
  }
});
