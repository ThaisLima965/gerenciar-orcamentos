/**
 * Sistema Corporativo de Diálogos e Prompts Modais TKE
 * Substitui os prompts e confirmações nativas do navegador (confirm/alert)
 * por modais modernos, animados e integrados ao design system corporativo.
 */

let modalElement = null;
let activeResolve = null;

function ensureModalCreated() {
  if (modalElement && document.body.contains(modalElement)) {
    return modalElement;
  }

  const existing = document.getElementById('tke-confirm-dialog-modal');
  if (existing) {
    modalElement = existing;
    return modalElement;
  }

  const backdrop = document.createElement('div');
  backdrop.id = 'tke-confirm-dialog-modal';
  backdrop.className = 'confirm-modal-backdrop';
  backdrop.setAttribute('role', 'dialog');
  backdrop.setAttribute('aria-modal', 'true');

  backdrop.innerHTML = `
    <div class="confirm-modal-card">
      <div class="confirm-modal-icon-wrapper" id="confirm-modal-icon-wrapper">
        <i id="confirm-modal-icon" class="bi bi-question-circle-fill"></i>
      </div>
      
      <div class="confirm-modal-body">
        <h3 id="confirm-modal-title" class="confirm-modal-title">Confirmação</h3>
        <p id="confirm-modal-message" class="confirm-modal-message">Tem certeza que deseja prosseguir com esta ação?</p>
        <div id="confirm-modal-details" class="confirm-modal-details" style="display: none;"></div>
      </div>

      <div class="confirm-modal-actions">
        <button type="button" class="btn btn-secondary confirm-btn-cancel" id="confirm-modal-btn-cancel">
          <i class="bi bi-x-lg"></i>
          <span id="confirm-modal-cancel-text">Cancelar</span>
        </button>
        <button type="button" class="btn confirm-btn-action" id="confirm-modal-btn-confirm">
          <i id="confirm-modal-action-icon" class="bi bi-check2-circle"></i>
          <span id="confirm-modal-confirm-text">Confirmar</span>
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(backdrop);
  modalElement = backdrop;

  // Event Listeners
  const btnCancel = backdrop.querySelector('#confirm-modal-btn-cancel');
  const btnConfirm = backdrop.querySelector('#confirm-modal-btn-confirm');

  const closeDialog = (result) => {
    backdrop.classList.remove('active');
    setTimeout(() => {
      backdrop.style.display = 'none';
    }, 200);

    if (activeResolve) {
      const resolve = activeResolve;
      activeResolve = null;
      resolve(result);
    }
  };

  btnCancel.addEventListener('click', () => closeDialog(false));
  btnConfirm.addEventListener('click', () => closeDialog(true));

  // Fecha ao clicar fora do card
  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) {
      closeDialog(false);
    }
  });

  // Fecha ao apertar Escape
  window.addEventListener('keydown', (e) => {
    if (backdrop.classList.contains('active') && e.key === 'Escape') {
      closeDialog(false);
    }
  });

  return modalElement;
}

/**
 * Exibe um modal de confirmação moderno e responsivo.
 * @param {Object} options
 * @param {string} options.title - Título do diálogo
 * @param {string} options.message - Mensagem principal explicativa
 * @param {string} [options.details] - Detalhes adicionais ou aviso de segurança
 * @param {string} [options.confirmText] - Texto do botão de confirmação
 * @param {string} [options.cancelText] - Texto do botão de cancelamento
 * @param {'danger'|'warning'|'primary'|'info'} [options.variant] - Variante visual e tema de cores
 * @param {string} [options.icon] - Classe de ícone Bootstrap Icons
 * @returns {Promise<boolean>} Retorna true se o usuário confirmou, false se cancelou
 */
export function showConfirmDialog(options = {}) {
  const {
    title = 'Confirmação',
    message = 'Deseja prosseguir com esta operação?',
    details = '',
    confirmText = 'Confirmar',
    cancelText = 'Cancelar',
    variant = 'primary',
    icon = ''
  } = options;

  const backdrop = ensureModalCreated();
  const iconWrapper = backdrop.querySelector('#confirm-modal-icon-wrapper');
  const iconEl = backdrop.querySelector('#confirm-modal-icon');
  const titleEl = backdrop.querySelector('#confirm-modal-title');
  const msgEl = backdrop.querySelector('#confirm-modal-message');
  const detailsEl = backdrop.querySelector('#confirm-modal-details');
  const btnConfirm = backdrop.querySelector('#confirm-modal-btn-confirm');
  const confirmTextEl = backdrop.querySelector('#confirm-modal-confirm-text');
  const cancelTextEl = backdrop.querySelector('#confirm-modal-cancel-text');
  const actionIconEl = backdrop.querySelector('#confirm-modal-action-icon');

  // Configura textos
  titleEl.textContent = title;
  msgEl.innerHTML = message;

  if (details) {
    detailsEl.style.display = 'block';
    detailsEl.innerHTML = details;
  } else {
    detailsEl.style.display = 'none';
    detailsEl.innerHTML = '';
  }

  confirmTextEl.textContent = confirmText;
  cancelTextEl.textContent = cancelText;

  // Limpa classes anteriores de variante
  iconWrapper.className = `confirm-modal-icon-wrapper variant-${variant}`;
  btnConfirm.className = `btn confirm-btn-action variant-${variant}`;

  // Define ícone padrão baseado na variante se não informado
  let resolvedIcon = icon;
  let actionIcon = 'bi-check2-circle';

  if (variant === 'danger') {
    resolvedIcon = resolvedIcon || 'bi-exclamation-triangle-fill';
    actionIcon = 'bi-trash3-fill';
  } else if (variant === 'warning') {
    resolvedIcon = resolvedIcon || 'bi-shield-exclamation';
    actionIcon = 'bi-check2';
  } else if (variant === 'info') {
    resolvedIcon = resolvedIcon || 'bi-info-circle-fill';
    actionIcon = 'bi-check2-circle';
  } else {
    // primary
    resolvedIcon = resolvedIcon || 'bi-shield-check';
    actionIcon = 'bi-arrow-right-circle-fill';
  }

  iconEl.className = `bi ${resolvedIcon}`;
  actionIconEl.className = `bi ${actionIcon}`;

  // Mostra modal com animação suave
  backdrop.style.display = 'flex';
  // Força reflow para transição
  void backdrop.offsetWidth;
  backdrop.classList.add('active');

  // Foco no botão de confirmação
  setTimeout(() => {
    btnConfirm.focus();
  }, 50);

  return new Promise((resolve) => {
    activeResolve = resolve;
  });
}
