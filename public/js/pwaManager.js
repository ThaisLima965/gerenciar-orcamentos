/**
 * Gerenciador PWA Corporativo - Ciclo de Vida, Instalabilidade (A2HS) e Monitor de Conexão
 * TK Elevator - Gerenciador de Orçamentos & Liberação GEOR
 */

import { offlineStore } from './offlineStore.js';
import { api } from './api.js';

class PwaManager {
  constructor() {
    this.deferredPrompt = null;
    this.isStandalone = false;
    this.isOnline = navigator.onLine;
    this.swRegistration = null;

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.init());
    } else {
      this.init();
    }
  }

  async init() {
    this.checkStandaloneMode();
    this.registerServiceWorker();
    this.injectPwaElements();
    this.setupInstallPrompt();
    this.setupConnectionListeners();
    this.updateConnectionPill();
  }

  // 1. Detecta se o aplicativo já está instalado e rodando em modo nativo / standalone
  checkStandaloneMode() {
    const isStandaloneMedia = window.matchMedia('(display-mode: standalone)').matches;
    const isIosStandalone = window.navigator.standalone === true;
    const isAndroidApp = document.referrer.includes('android-app://');
    this.isStandalone = isStandaloneMedia || isIosStandalone || isAndroidApp;

    if (this.isStandalone) {
      document.body.classList.add('pwa-standalone');
      document.documentElement.classList.add('pwa-standalone');
      console.log('📱 [PWA] Rodando em modo Standalone Nativo.');
    }
  }

  // 2. Registro do Service Worker com detecção de atualizações
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

  // 3. Injeta elementos visuais do PWA no DOM caso ainda não existam
  injectPwaElements() {
    if (document.getElementById('pwa-injected-container')) return;

    const container = document.createElement('div');
    container.id = 'pwa-injected-container';
    container.innerHTML = `
      <!-- BANNER DE INSTALAÇÃO MÓVEL (A2HS) -->
      <div id="pwa-install-banner" class="pwa-install-banner" aria-label="Instalar Aplicativo">
        <div class="pwa-banner-card">
          <button id="pwa-btn-dismiss-banner" class="pwa-banner-close" aria-label="Dispensar banner">
            <i class="bi bi-x"></i>
          </button>
          <div class="pwa-banner-header">
            <div class="pwa-banner-icon">
              <img src="/images/icons/icon-192.png" alt="Orçamentos TKE" width="48" height="48" />
            </div>
            <div class="pwa-banner-info">
              <div class="pwa-banner-title">Instalar Aplicativo</div>
              <div class="pwa-banner-subtitle">Orçamentos & GEOR no seu celular</div>
              <div class="pwa-banner-features">
                <span><i class="bi bi-lightning-charge-fill"></i> Rápido</span>
                <span><i class="bi bi-wifi-off"></i> Offline</span>
                <span><i class="bi bi-phone-fill"></i> Tela cheia</span>
              </div>
            </div>
          </div>
          <div class="pwa-banner-actions">
            <button id="pwa-btn-install-banner" class="pwa-btn-install" type="button">
              <i class="bi bi-download"></i>
              <span>Instalar App</span>
            </button>
          </div>
        </div>
      </div>

      <!-- MODAL / DRAWER DE INSTALAÇÃO PARA IOS (SAFARI) -->
      <div id="pwa-ios-modal" class="pwa-ios-modal" aria-hidden="true">
        <div class="pwa-ios-backdrop" id="pwa-ios-backdrop"></div>
        <div class="pwa-ios-sheet">
          <div class="pwa-ios-drag-handle"></div>
          <div class="pwa-ios-header">
            <img src="/images/icons/icon-192.png" alt="Orçamentos" class="pwa-ios-app-icon" width="52" height="52" />
            <div class="pwa-ios-header-text">
              <h3>Instalar no iPhone / iPad</h3>
              <p>Adicione à sua Tela de Início para usar como um app nativo.</p>
            </div>
            <button id="pwa-btn-close-ios-modal" class="pwa-ios-close-btn" type="button" aria-label="Fechar">
              <i class="bi bi-x-lg"></i>
            </button>
          </div>
          <div class="pwa-ios-steps">
            <div class="pwa-ios-step">
              <div class="pwa-ios-step-num">1</div>
              <div class="pwa-ios-step-text">
                No Safari, toque no botão <strong>Compartilhar</strong> na barra inferior:
                <div class="pwa-ios-step-badge">
                  <i class="bi bi-box-arrow-up"></i>
                  <span>Compartilhar</span>
                </div>
              </div>
            </div>
            <div class="pwa-ios-step">
              <div class="pwa-ios-step-num">2</div>
              <div class="pwa-ios-step-text">
                Role para baixo e selecione a opção:
                <div class="pwa-ios-step-badge">
                  <i class="bi bi-plus-square"></i>
                  <span>Adicionar à Tela de Início</span>
                </div>
              </div>
            </div>
            <div class="pwa-ios-step">
              <div class="pwa-ios-step-num">3</div>
              <div class="pwa-ios-step-text">
                Toque em <strong>Adicionar</strong> no canto superior direito para concluir.
              </div>
            </div>
          </div>
          <div class="pwa-ios-footer">
            <button id="pwa-btn-ios-done" class="pwa-btn-ios-done" type="button">Entendido</button>
          </div>
        </div>
      </div>

      <!-- BOTÃO FLUTUANTE DISCRETO PARA REABRIR INSTALAÇÃO SE DISPENSADO -->
      <button id="pwa-floating-install-btn" class="pwa-floating-install-btn" type="button" title="Instalar Aplicativo" style="display: none;">
        <i class="bi bi-download"></i>
        <span>Instalar App</span>
      </button>
    `;
    document.body.appendChild(container);
  }

  // 4. Configuração do Prompt de Instalação (A2HS) para Android, iOS e Desktop
  setupInstallPrompt() {
    if (this.isStandalone) return;

    const isIos = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth <= 768;

    const installBtnHeader = document.getElementById('pwa-btn-install-header');
    const installBannerMobile = document.getElementById('pwa-install-banner');
    const btnDismissBanner = document.getElementById('pwa-btn-dismiss-banner');
    const btnInstallBanner = document.getElementById('pwa-btn-install-banner');
    const floatingBtn = document.getElementById('pwa-floating-install-btn');
    const iosBackdrop = document.getElementById('pwa-ios-backdrop');
    const btnCloseIos = document.getElementById('pwa-btn-close-ios-modal');
    const btnIosDone = document.getElementById('pwa-btn-ios-done');

    // Intercepta evento de instalação padrão no Chrome / Edge / Android
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      this.deferredPrompt = e;

      if (!this.isStandalone) {
        if (installBtnHeader) installBtnHeader.style.display = 'inline-flex';

        // Exibe o banner mobile se não foi dispensado nesta sessão
        if (installBannerMobile && !sessionStorage.getItem('pwa_banner_dismissed')) {
          setTimeout(() => {
            installBannerMobile.classList.add('active');
          }, 1500);
        } else if (floatingBtn && isMobile) {
          floatingBtn.style.display = 'inline-flex';
        }
      }
    });

    // Se estiver em iOS Safari (onde beforeinstallprompt não existe) e não estiver instalado
    if (isIos && !this.isStandalone) {
      if (installBtnHeader) installBtnHeader.style.display = 'inline-flex';

      if (installBannerMobile && !sessionStorage.getItem('pwa_banner_dismissed')) {
        setTimeout(() => {
          installBannerMobile.classList.add('active');
        }, 1800);
      } else if (floatingBtn) {
        floatingBtn.style.display = 'inline-flex';
      }
    } else if (isMobile && !this.isStandalone) {
      // Fallback para outros navegadores móveis (ex: Firefox móvel, Samsung Internet)
      setTimeout(() => {
        if (!this.deferredPrompt && !sessionStorage.getItem('pwa_banner_dismissed') && installBannerMobile) {
          installBannerMobile.classList.add('active');
        }
      }, 2500);
    }

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

    // Clique no botão flutuante discreto
    if (floatingBtn) {
      floatingBtn.addEventListener('click', () => {
        this.triggerInstallFlow();
      });
    }

    // Dispensar banner mobile
    if (btnDismissBanner && installBannerMobile) {
      btnDismissBanner.addEventListener('click', () => {
        installBannerMobile.classList.remove('active');
        sessionStorage.setItem('pwa_banner_dismissed', 'true');
        if (floatingBtn && isMobile && !this.isStandalone) {
          setTimeout(() => {
            floatingBtn.style.display = 'inline-flex';
          }, 600);
        }
      });
    }

    // Fechar modal iOS
    const closeIos = () => this.closeIosInstallModal();
    if (iosBackdrop) iosBackdrop.addEventListener('click', closeIos);
    if (btnCloseIos) btnCloseIos.addEventListener('click', closeIos);
    if (btnIosDone) btnIosDone.addEventListener('click', closeIos);

    // Evento disparado quando o app é instalado com sucesso
    window.addEventListener('appinstalled', () => {
      console.log('🎉 [PWA] Aplicativo instalado com sucesso!');
      this.deferredPrompt = null;
      this.isStandalone = true;
      document.body.classList.add('pwa-standalone');
      if (installBtnHeader) installBtnHeader.style.display = 'none';
      if (installBannerMobile) installBannerMobile.classList.remove('active');
      if (floatingBtn) floatingBtn.style.display = 'none';
      this.showToast('🎉 Aplicativo instalado com sucesso na sua tela inicial!', 'success');
    });
  }

  // Aciona o fluxo de instalação (Android/Desktop nativo ou Modal iOS Safari)
  async triggerInstallFlow() {
    this.vibrate(25);

    const isIos = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    const installBannerMobile = document.getElementById('pwa-install-banner');

    if (this.deferredPrompt) {
      // Android / Chrome / Edge
      this.deferredPrompt.prompt();
      const { outcome } = await this.deferredPrompt.userChoice;
      console.log(`[PWA Install] Resultado da escolha: ${outcome}`);
      if (outcome === 'accepted') {
        this.deferredPrompt = null;
        if (installBannerMobile) installBannerMobile.classList.remove('active');
      }
    } else if (isIos && !this.isStandalone) {
      // Abre o drawer passo a passo formatado para iOS
      this.openIosInstallModal();
    } else {
      // Outros navegadores (ex: desktop Safari ou navegadores sem prompt nativo exposto)
      this.openIosInstallModal();
    }
  }

  openIosInstallModal() {
    const iosModal = document.getElementById('pwa-ios-modal');
    if (iosModal) {
      iosModal.classList.add('active');
      iosModal.setAttribute('aria-hidden', 'false');
    }
  }

  closeIosInstallModal() {
    const iosModal = document.getElementById('pwa-ios-modal');
    if (iosModal) {
      iosModal.classList.remove('active');
      iosModal.setAttribute('aria-hidden', 'true');
    }
  }

  // 5. Monitor de Conexão em Tempo Real (Online / Offline / Sincronização)
  setupConnectionListeners() {
    window.addEventListener('online', async () => {
      this.isOnline = true;
      console.log('🌐 [PWA] Conexão restabelecida! Iniciando sincronização...');
      this.vibrate([15, 30, 15]);
      this.updateConnectionPill('syncing');

      try {
        const { synced } = await offlineStore.syncPendingQueue(api);
        if (synced > 0) {
          this.showToast(`✅ Sincronização concluída: ${synced} registros salvos no servidor!`, 'success');
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
      this.showToast('🟠 Você está offline. As alterações serão salvas no dispositivo e sincronizadas ao reconectar.', 'warning');
    });
  }

  // Atualiza o indicador visual de conexão na barra superior
  async updateConnectionPill(forcedState = null) {
    const pill = document.getElementById('pwa-connection-status');
    if (!pill) return;

    let queueCount = 0;
    try {
      queueCount = await offlineStore.getSyncQueueCount();
    } catch {}

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
  vibrate(pattern = 20) {
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
    this.showToast('🚀 Nova versão da plataforma disponível! Recarregue para atualizar.', 'info');
  }
}

export const pwaManager = new PwaManager();
export default pwaManager;
