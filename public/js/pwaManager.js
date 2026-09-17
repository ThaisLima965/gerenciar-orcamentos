/**
 * Gerenciador PWA de Ciclo de Vida, Instalabilidade (A2HS) e Monitor de Conexão
 * TKE Gerenciador de Orçamentos
 */

import { offlineStore } from './offlineStore.js';
import { api } from './api.js';

class PwaManager {
  constructor() {
    this.deferredPrompt = null;
    this.isStandalone = false;
    this.isOnline = navigator.onLine;
    this.swRegistration = null;
    
    this.init();
  }

  async init() {
    this.checkStandaloneMode();
    this.registerServiceWorker();
    this.setupInstallPrompt();
    this.setupConnectionListeners();
    this.updateConnectionPill();
  }

  // 1. Detecta se o aplicativo já está instalado e rodando em modo nativo / standalone
  checkStandaloneMode() {
    const isStandaloneMedia = window.matchMedia('(display-mode: standalone)').matches;
    const isIosStandalone = window.navigator.standalone === true;
    this.isStandalone = isStandaloneMedia || isIosStandalone;

    if (this.isStandalone) {
      document.body.classList.add('pwa-standalone');
      console.log('📱 [PWA] Rodando em modo Standalone Nativo.');
    }
  }

  // 2. Registro do Service Worker
  async registerServiceWorker() {
    if ('serviceWorker' in navigator) {
      try {
        const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
        this.swRegistration = reg;
        console.log('✅ [PWA] Service Worker registrado com sucesso:', reg.scope);

        // Verifica atualizações do Service Worker
        reg.addEventListener('updatefound', () => {
          const newWorker = reg.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                this.showUpdateNotification();
              }
            });
          }
        });
      } catch (err) {
        console.warn('⚠️ [PWA] Falha ao registrar Service Worker:', err.message);
      }
    }
  }

  // 3. Configuração do Prompt de Instalação no Celular / Computador (A2HS)
  setupInstallPrompt() {
    const installBtnHeader = document.getElementById('pwa-btn-install-header');
    const installBannerMobile = document.getElementById('pwa-install-banner');
    const btnDismissBanner = document.getElementById('pwa-btn-dismiss-banner');
    const btnInstallBanner = document.getElementById('pwa-btn-install-banner');

    window.addEventListener('beforeinstallprompt', (e) => {
      // Impede o prompt padrão do Chrome para usarmos o nosso banner personalizado
      e.preventDefault();
      this.deferredPrompt = e;

      // Exibe os botões de instalação se não estiver em standalone
      if (!this.isStandalone) {
        if (installBtnHeader) installBtnHeader.style.display = 'inline-flex';
        
        // Exibe banner mobile após 3 segundos se ainda não foi dispensado nesta sessão
        if (installBannerMobile && !sessionStorage.getItem('pwa_banner_dismissed')) {
          setTimeout(() => {
            installBannerMobile.classList.add('active');
          }, 2500);
        }
      }
    });

    // Clique no botão do Header
    if (installBtnHeader) {
      installBtnHeader.addEventListener('click', () => {
        this.triggerInstallFlow();
      });
    }

    // Clique no botão do Banner Mobile
    if (btnInstallBanner) {
      btnInstallBanner.addEventListener('click', () => {
        this.triggerInstallFlow();
      });
    }

    // Dispensar banner
    if (btnDismissBanner && installBannerMobile) {
      btnDismissBanner.addEventListener('click', () => {
        installBannerMobile.classList.remove('active');
        sessionStorage.setItem('pwa_banner_dismissed', 'true');
      });
    }

    // Evento disparado quando o app é instalado com sucesso
    window.addEventListener('appinstalled', () => {
      console.log('🎉 [PWA] Aplicativo instalado com sucesso!');
      this.deferredPrompt = null;
      if (installBtnHeader) installBtnHeader.style.display = 'none';
      if (installBannerMobile) installBannerMobile.classList.remove('active');
      this.showToast('🎉 Aplicativo instalado com sucesso na tela inicial!', 'success');
    });
  }

  // Aciona o fluxo de instalação (Android/Desktop ou Modal iOS)
  async triggerInstallFlow() {
    this.vibrate(20);

    const isIos = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;

    if (this.deferredPrompt) {
      // Android / Chrome / Edge
      this.deferredPrompt.prompt();
      const { outcome } = await this.deferredPrompt.userChoice;
      console.log(`[PWA Install] Resultado da escolha: ${outcome}`);
      if (outcome === 'accepted') {
        this.deferredPrompt = null;
      }
    } else if (isIos && !this.isStandalone) {
      // Exibe modal com passo a passo para iOS Safari
      this.openIosInstallModal();
    } else {
      this.showToast('Para instalar no navegador, use o ícone de instalação na barra de endereços 📲', 'info');
    }
  }

  openIosInstallModal() {
    const iosModal = document.getElementById('pwa-ios-modal');
    if (iosModal) {
      iosModal.classList.add('active');
    }
  }

  closeIosInstallModal() {
    const iosModal = document.getElementById('pwa-ios-modal');
    if (iosModal) {
      iosModal.classList.remove('active');
    }
  }

  // 4. Monitor de Conexão em Tempo Real (Online / Offline / Sincronização)
  setupConnectionListeners() {
    window.addEventListener('online', async () => {
      this.isOnline = true;
      console.log('🌐 [PWA] Conexão restabelecida! Iniciando sincronização...');
      this.vibrate([15, 30, 15]);
      this.updateConnectionPill('syncing');

      try {
        const { synced, failed } = await offlineStore.syncPendingQueue(api);
        if (synced > 0) {
          this.showToast(`✅ Sincronização concluída: ${synced} registros salvos no servidor!`, 'success');
          // Dispara evento global para recarregar dados na tela
          window.dispatchEvent(new CustomEvent('pwa-sync-completed', { detail: { synced } }));
        }
      } catch (err) {
        console.error('Erro na sincronização automática:', err);
      } finally {
        this.updateConnectionPill('online');
      }
    });

    window.addEventListener('offline', () => {
      this.isOnline = false;
      console.warn('⚠️ [PWA] Conexão perdida. Modo Offline-First ativo.');
      this.vibrate(40);
      this.updateConnectionPill('offline');
      this.showToast('🟠 Você está no Modo Offline. Todas as alterações serão salvas localmente e sincronizadas quando voltar a internet.', 'warning');
    });
  }

  // Atualiza o indicador visual de conexão na barra superior
  async updateConnectionPill(forcedState = null) {
    const pill = document.getElementById('pwa-connection-status');
    if (!pill) return;

    const queueCount = await offlineStore.getSyncQueueCount();
    const state = forcedState || (navigator.onLine ? 'online' : 'offline');

    pill.classList.remove('status-online', 'status-offline', 'status-syncing');

    if (state === 'syncing') {
      pill.classList.add('status-syncing');
      pill.innerHTML = `<i class="bi bi-arrow-repeat spin"></i> <span>Sincronizando...</span>`;
      pill.title = 'Sincronizando alterações locais com o servidor';
    } else if (state === 'offline' || !navigator.onLine) {
      pill.classList.add('status-offline');
      const badgeText = queueCount > 0 ? `Modo Offline (${queueCount} pendente${queueCount > 1 ? 's' : ''})` : 'Modo Offline';
      pill.innerHTML = `<i class="bi bi-cloud-slash-fill"></i> <span>${badgeText}</span>`;
      pill.title = 'Modo Offline ativo: dados salvos localmente';
    } else {
      pill.classList.add('status-online');
      if (queueCount > 0) {
        pill.innerHTML = `<i class="bi bi-cloud-arrow-up-fill" style="color: #F59E0B;"></i> <span>${queueCount} pendente(s)</span>`;
      } else {
        pill.innerHTML = `<i class="bi bi-cloud-check-fill"></i> <span>Online</span>`;
      }
      pill.title = 'Conectado aos servidores da plataforma';
    }
  }

  // Feedback tátil para dispositivos móveis
  vibrate(pattern = 15) {
    if ('vibrate' in navigator) {
      try {
        navigator.vibrate(pattern);
      } catch (e) {}
    }
  }

  // Toast / Notificação simples integrada
  showToast(message, type = 'info') {
    let container = document.getElementById('pwa-toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'pwa-toast-container';
      container.className = 'pwa-toast-container';
      document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `pwa-toast pwa-toast-${type}`;
    
    let icon = 'bi-info-circle-fill';
    if (type === 'success') icon = 'bi-check-circle-fill';
    if (type === 'warning') icon = 'bi-exclamation-triangle-fill';
    if (type === 'error') icon = 'bi-x-circle-fill';

    toast.innerHTML = `
      <i class="bi ${icon}"></i>
      <div class="pwa-toast-content">${message}</div>
    `;

    container.appendChild(toast);

    setTimeout(() => {
      toast.classList.add('show');
    }, 50);

    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 400);
    }, 4500);
  }

  showUpdateNotification() {
    this.showToast('🚀 Nova versão da plataforma disponível! Recarregue a página para atualizar.', 'info');
  }
}

export const pwaManager = new PwaManager();
export default pwaManager;
