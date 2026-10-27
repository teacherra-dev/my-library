// 나의 서재 — 앱 설치용 최소 서비스 워커 (저장은 하지 않고 그대로 인터넷에서 불러와요)
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", e => e.waitUntil(self.clients.claim()));
