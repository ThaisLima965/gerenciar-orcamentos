/**
 * Service Worker Corporativo PWA - TKE Orçamentos
 * Estratégia de Caching: Stale-While-Revalidate para App Shell & Network-First para APIs
 */

const CACHE_NAME = 'tke-orcamentos-v1.0.1';

// Recursos essenciais para funcionamento 100% offline
const APP_SHELL = [
  '/',
  '/index.html',
  '/login.html',
  '/css/style.css',
  '/js/app.js',
  '/js/api.js',
  '/js/auth.js',
  '/js/login.js',
  '/js/confirmModal.js',
  '/js/offlineStore.js',
  '/js/pwaManager.js',
  '/manifest.json',
  '/images/icons/icon.svg',
  '/images/icons/icon-192.png',
  '/images/icons/icon-512.png',
  '/images/icons/icon-maskable-192.png',
  '/images/icons/icon-maskable-512.png',
  '/images/icons/apple-touch-icon.png',
  '/images/icons/favicon-32x32.png',
  '/images/tke_bg.jpg',
  '/images/tke_elevadores_banner.jpg',
  'https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css',
  'https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/fonts/bootstrap-icons.woff2?28514197',
  'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js'
];

// Instalação do Service Worker & Pre-caching do App Shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      console.log('⚡ [Service Worker] Pre-cacheando App Shell...');
      
      // Adiciona itens tolerando falhas pontuais de fontes externas
      for (const url of APP_SHELL) {
        try {
          await cache.add(new Request(url, { cache: 'reload' }));
        } catch (err) {
          console.warn(`⚠️ [Service Worker] Não foi possível cachear previamente: ${url}`, err.message);
        }
      }
    })
  );
  self.skipWaiting();
});

// Ativação e limpeza de caches antigos
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            console.log(`🧹 [Service Worker] Removendo cache obsoleto: ${cache}`);
            return caches.delete(cache);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Interceptação de requisições de rede
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Não interceptar requisições não-GET (como POST/PUT/DELETE) no SW de fetch
  if (request.method !== 'GET') {
    return;
  }

  // 1. Requisições de API: Network-First com fallback de cache
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Clona a resposta e atualiza o cache para leitura offline
          if (response.status === 200) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseClone);
            });
          }
          return response;
        })
        .catch(async () => {
          // Se estiver offline, tenta buscar a última resposta em cache
          const cachedResponse = await caches.match(request);
          if (cachedResponse) {
            console.log(`📦 [Service Worker] Retornando API do cache offline: ${url.pathname}`);
            return cachedResponse;
          }
          return new Response(JSON.stringify({ 
            offline: true, 
            message: 'Você está offline. Os dados locais do dispositivo estão sendo utilizados.' 
          }), {
            status: 503,
            headers: { 'Content-Type': 'application/json' }
          });
        })
    );
    return;
  }

  // 2. Navegação / Páginas HTML: Stale-While-Revalidate com Fallback
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, responseClone));
          return response;
        })
        .catch(async () => {
          const cachedPage = await caches.match(request);
          if (cachedPage) return cachedPage;
          const indexFallback = await caches.match('/index.html');
          if (indexFallback) return indexFallback;
          return caches.match('/login.html');
        })
    );
    return;
  }

  // 3. Recursos Estáticos (CSS, JS, Imagens, Fontes): Cache First com atualização em background
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      const fetchPromise = fetch(request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const clone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        }
        return networkResponse;
      }).catch(() => {
        // Falha de rede silenciosa para assets estáticos em modo offline
      });

      return cachedResponse || fetchPromise;
    })
  );
});

// Sincronização em Background (Background Sync API)
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-orcamentos') {
    event.waitUntil(
      self.clients.matchAll().then((clients) => {
        clients.forEach((client) => {
          client.postMessage({ type: 'TRIGGER_BACKGROUND_SYNC' });
        });
      })
    );
  }
});

// Mensagens do App (ex: skipWaiting)
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
