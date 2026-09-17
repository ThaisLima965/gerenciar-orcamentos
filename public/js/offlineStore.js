/**
 * Motor de Persistência Local Offline-First com IndexedDB
 * TKE Gerenciador de Orçamentos
 */

const DB_NAME = 'TkeOrcamentosOfflineDB';
const DB_VERSION = 1;

class OfflineStore {
  constructor() {
    this.db = null;
    this.isReady = false;
    this.initPromise = this.init();
  }

  async init() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;

        // 1. Tabela de Orçamentos
        if (!db.objectStoreNames.contains('orcamentos')) {
          const orcStore = db.createObjectStore('orcamentos', { keyPath: 'id' });
          orcStore.createIndex('status', 'status', { unique: false });
          orcStore.createIndex('matricula_tecnico', 'matricula_tecnico', { unique: false });
          orcStore.createIndex('numero_contrato', 'numero_contrato', { unique: false });
          orcStore.createIndex('g_origem', 'g_origem', { unique: false });
        }

        // 2. Tabela de Clientes
        if (!db.objectStoreNames.contains('clientes')) {
          const cliStore = db.createObjectStore('clientes', { keyPath: 'numero_contrato' });
          cliStore.createIndex('nome_cliente', 'nome_cliente', { unique: false });
        }

        // 3. Tabela de Técnicos
        if (!db.objectStoreNames.contains('tecnicos')) {
          const tecStore = db.createObjectStore('tecnicos', { keyPath: 'matricula' });
          tecStore.createIndex('nome_sobrenome', 'nome_sobrenome', { unique: false });
        }

        // 4. Fila de Sincronização em Background (Mutações Offline)
        if (!db.objectStoreNames.contains('sync_queue')) {
          const queueStore = db.createObjectStore('sync_queue', { keyPath: 'queue_id', autoIncrement: true });
          queueStore.createIndex('status', 'status', { unique: false });
          queueStore.createIndex('timestamp', 'timestamp', { unique: false });
        }

        // 5. Metadados e Caches (Dashboard / Perfil)
        if (!db.objectStoreNames.contains('app_meta')) {
          db.createObjectStore('app_meta', { keyPath: 'key' });
        }
      };

      request.onsuccess = (event) => {
        this.db = event.target.result;
        this.isReady = true;
        console.log('📦 [OfflineStore] IndexedDB inicializado com sucesso.');
        resolve(this.db);
      };

      request.onerror = (event) => {
        console.error('❌ [OfflineStore] Falha ao abrir IndexedDB:', event.target.error);
        reject(event.target.error);
      };
    });
  }

  async ensureReady() {
    if (!this.isReady) {
      await this.initPromise;
    }
  }

  // =========================================================================
  // ORÇAMENTOS (CACHE & MUTATIONS)
  // =========================================================================

  async saveOrcamentos(orcamentos) {
    await this.ensureReady();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(['orcamentos'], 'readwrite');
      const store = tx.objectStore('orcamentos');

      // Limpa dados antigos e insere os mais recentes recebidos da API
      store.clear();
      for (const item of orcamentos) {
        store.put(item);
      }

      tx.oncomplete = () => resolve(true);
      tx.onerror = () => reject(tx.error);
    });
  }

  async getOrcamentos() {
    await this.ensureReady();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(['orcamentos'], 'readonly');
      const store = tx.objectStore('orcamentos');
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  async getOrcamentoById(id) {
    await this.ensureReady();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(['orcamentos'], 'readonly');
      const store = tx.objectStore('orcamentos');
      const parsedId = isNaN(Number(id)) ? id : Number(id);
      const request = store.get(parsedId);

      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  async saveOrcamentoLocal(item) {
    await this.ensureReady();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(['orcamentos'], 'readwrite');
      const store = tx.objectStore('orcamentos');
      store.put(item);

      tx.oncomplete = () => resolve(item);
      tx.onerror = () => reject(tx.error);
    });
  }

  async deleteOrcamentoLocal(id) {
    await this.ensureReady();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(['orcamentos'], 'readwrite');
      const store = tx.objectStore('orcamentos');
      const parsedId = isNaN(Number(id)) ? id : Number(id);
      store.delete(parsedId);

      tx.oncomplete = () => resolve(true);
      tx.onerror = () => reject(tx.error);
    });
  }

  // =========================================================================
  // CLIENTES & TÉCNICOS (LOOKUP OFFLINE)
  // =========================================================================

  async saveClientes(clientes) {
    await this.ensureReady();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(['clientes'], 'readwrite');
      const store = tx.objectStore('clientes');
      store.clear();
      for (const c of clientes) {
        store.put(c);
      }
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => reject(tx.error);
    });
  }

  async getClientes() {
    await this.ensureReady();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(['clientes'], 'readonly');
      const store = tx.objectStore('clientes');
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  }

  async saveTecnicos(tecnicos) {
    await this.ensureReady();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(['tecnicos'], 'readwrite');
      const store = tx.objectStore('tecnicos');
      store.clear();
      for (const t of tecnicos) {
        store.put(t);
      }
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => reject(tx.error);
    });
  }

  async getTecnicos() {
    await this.ensureReady();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(['tecnicos'], 'readonly');
      const store = tx.objectStore('tecnicos');
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  }

  // =========================================================================
  // FILA DE SINCRONIZAÇÃO (SYNC QUEUE PARA AÇÕES OFFLINE)
  // =========================================================================

  async enqueueMutation(endpoint, method, body, tempId = null) {
    await this.ensureReady();
    const item = {
      endpoint,
      method: method.toUpperCase(),
      body,
      tempId,
      status: 'pending',
      timestamp: new Date().toISOString(),
      retries: 0
    };

    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(['sync_queue'], 'readwrite');
      const store = tx.objectStore('sync_queue');
      const req = store.add(item);

      req.onsuccess = () => {
        console.log(`📥 [OfflineStore] Ação offline enfileirada: ${method} ${endpoint}`, item);
        resolve(req.result);
      };
      req.onerror = () => reject(req.error);
    });
  }

  async getPendingQueue() {
    await this.ensureReady();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(['sync_queue'], 'readonly');
      const store = tx.objectStore('sync_queue');
      const req = store.getAll();

      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  }

  async removeQueueItem(queueId) {
    await this.ensureReady();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(['sync_queue'], 'readwrite');
      const store = tx.objectStore('sync_queue');
      const req = store.delete(queueId);

      req.onsuccess = () => resolve(true);
      req.onerror = () => reject(req.error);
    });
  }

  async getSyncQueueCount() {
    const queue = await this.getPendingQueue();
    return queue.length;
  }

  // Sincroniza todas as mutações pendentes com o servidor backend
  async syncPendingQueue(apiInstance, onProgress = null) {
    const queue = await this.getPendingQueue();
    if (queue.length === 0) return { synced: 0, failed: 0 };

    console.log(`🔄 [OfflineStore] Iniciando sincronização de ${queue.length} ações pendentes...`);
    let synced = 0;
    let failed = 0;

    for (const item of queue) {
      try {
        let res;
        if (item.method === 'POST') {
          res = await apiInstance.post(item.endpoint, item.body);
        } else if (item.method === 'PUT') {
          res = await apiInstance.put(item.endpoint, item.body);
        } else if (item.method === 'PATCH') {
          res = await apiInstance.patch(item.endpoint, item.body);
        } else if (item.method === 'DELETE') {
          res = await apiInstance.delete(item.endpoint);
        }

        // Se o item foi criado com tempId, atualiza o item local com os dados reais do servidor
        if (item.tempId && res?.data?.id) {
          await this.deleteOrcamentoLocal(item.tempId);
          await this.saveOrcamentoLocal(res.data);
        } else if (res?.data) {
          await this.saveOrcamentoLocal(res.data);
        }

        await this.removeQueueItem(item.queue_id);
        synced++;

        if (typeof onProgress === 'function') {
          onProgress({ current: synced + failed, total: queue.length, success: true });
        }
      } catch (err) {
        console.error(`❌ [OfflineStore] Falha ao sincronizar item #${item.queue_id}:`, err.message);
        failed++;
        if (typeof onProgress === 'function') {
          onProgress({ current: synced + failed, total: queue.length, success: false, error: err.message });
        }
      }
    }

    console.log(`✅ [OfflineStore] Sincronização concluída: ${synced} processados, ${failed} pendentes.`);
    return { synced, failed };
  }

  // =========================================================================
  // METADADOS E CACHE DO DASHBOARD
  // =========================================================================

  async setMeta(key, value) {
    await this.ensureReady();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(['app_meta'], 'readwrite');
      const store = tx.objectStore('app_meta');
      store.put({ key, value, updatedAt: new Date().toISOString() });
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => reject(tx.error);
    });
  }

  async getMeta(key) {
    await this.ensureReady();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(['app_meta'], 'readonly');
      const store = tx.objectStore('app_meta');
      const req = store.get(key);
      req.onsuccess = () => resolve(req.result?.value || null);
      req.onerror = () => reject(req.error);
    });
  }
}

export const offlineStore = new OfflineStore();
export default offlineStore;
