import { api } from './api.js';
import { auth } from './auth.js';

// Estado global da aplicação no frontend
const state = {
  user: null,
  orcamentos: [],
  clientes: [],
  tecnicos: [],
  usuarios: [],
  userFilters: {
    q: '',
    perfil: '',
    grupo: '',
    status: ''
  },
  filters: {
    q: '',
    tipo_servico: '',
    g_origem: '',
    status: '',
    geor_liberou: ''
  },
  premiacao: {
    ciclo: '2025/2026',
    mes: 'acumulado',
    g_origem: '',
    data: null
  },
  activeTab: 'orcamentos',
  editingId: null
};

// =====================================================================
// UTILITÁRIOS & TOASTS
// =====================================================================
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  
  let icon = 'bi-info-circle-fill';
  if (type === 'success') icon = 'bi-check-circle-fill';
  if (type === 'error') icon = 'bi-exclamation-octagon-fill';

  toast.innerHTML = `
    <i class="bi ${icon}"></i>
    <span>${message}</span>
  `;

  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(100%)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

function formatDate(dateString) {
  if (!dateString) return '-';
  // Formata YYYY-MM-DD para DD/MM/YYYY
  const parts = dateString.split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return dateString;
}

function formatCurrency(value) {
  const num = Number(value) || 0;
  return num.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

// =====================================================================
// INICIALIZAÇÃO
// =====================================================================
document.addEventListener('DOMContentLoaded', async () => {
  // 1. Validação da Sessão
  const user = await auth.checkSession();
  if (!user) {
    window.location.href = '/login.html';
    return;
  }
  state.user = user;

  // 2. Setup do Layout e Usuário
  setupUserProfile();
  setupTheme();
  setupEventListeners();

  // 3. Carga Inicial de Dados
  await Promise.all([
    loadClientes(),
    loadTecnicos()
  ]);
  await loadOrcamentos();
});

// =====================================================================
// SETUP DE PERFIL, PERMISSÕES & SEGURANÇA (ANTI-PRINT / ANTI-EXPORT)
// =====================================================================
function setupUserProfile() {
  const user = state.user;
  const navUserName = document.getElementById('nav-user-name');
  const navUserAvatar = document.getElementById('nav-user-avatar');
  const roleBadge = document.getElementById('nav-user-role');

  if (navUserName) navUserName.textContent = user.nome;
  if (navUserAvatar) {
    const initial = (user.nome || user.matricula || 'U').trim().charAt(0).toUpperCase();
    navUserAvatar.textContent = initial;
    navUserAvatar.title = `${user.nome} (${user.perfil})`;
  }

  if (roleBadge) {
    roleBadge.textContent = user.perfil;
    roleBadge.className = 'user-role-badge';
  }

  const btnExportCsv = document.getElementById('btn-export-csv');
  const btnExportExcel = document.getElementById('btn-export-excel-prem');
  const tabNavUsuarios = document.getElementById('tab-nav-usuarios');
  const btnOpenCadastros = document.getElementById('btn-open-cadastros');

  if (user.perfil === 'CONSULTORA') {
    if (roleBadge) {
      roleBadge.classList.add('role-consultora');
      roleBadge.textContent = 'CONSULTORA (ADMIN)';
    }
    document.body.classList.remove('role-tecnico-active');
    if (btnExportCsv) btnExportCsv.style.display = '';
    if (btnExportExcel) btnExportExcel.style.display = '';
    if (tabNavUsuarios) tabNavUsuarios.style.display = '';
    if (btnOpenCadastros) btnOpenCadastros.style.display = '';
  } else if (user.perfil === 'SUPERVISOR') {
    if (roleBadge) {
      roleBadge.classList.add('role-supervisor');
      roleBadge.textContent = 'SUPERVISOR';
    }
    document.body.classList.remove('role-tecnico-active');
    if (btnExportCsv) btnExportCsv.style.display = '';
    if (btnExportExcel) btnExportExcel.style.display = '';
    if (tabNavUsuarios) tabNavUsuarios.style.display = 'none';
    if (btnOpenCadastros) btnOpenCadastros.style.display = '';
  } else {
    roleBadge.classList.add('role-tecnico');
    roleBadge.textContent = 'TÉCNICO';
    document.body.classList.add('role-tecnico-active');
    
    // Oculta botões de exportação, cadastros de apoio e gestão de usuários para o técnico
    if (btnExportCsv) btnExportCsv.style.display = 'none';
    if (btnExportExcel) btnExportExcel.style.display = 'none';
    if (tabNavUsuarios) tabNavUsuarios.style.display = 'none';
    if (btnOpenCadastros) btnOpenCadastros.style.display = 'none';

    // Ativa travas de segurança e proteção anti-print / anti-screenshot
    setupTecnicoSecurityGuards();
  }

  // Interceptação de Primeiro Acesso pendente no Dashboard
  if (user.primeiro_acesso) {
    const dashFirstAccessModal = document.getElementById('dashboard-primeiro-acesso-modal');
    if (dashFirstAccessModal) {
      dashFirstAccessModal.classList.add('active');
    }
  }
}

// Proteção leve para perfil Técnico (sem bloquear a interface nem gerar travamentos)
let securityGuardsInitialized = false;
function setupTecnicoSecurityGuards() {
  if (securityGuardsInitialized) return;
  securityGuardsInitialized = true;

  // Bloqueio amigável de atalhos de impressão
  window.addEventListener('keydown', (e) => {
    if (state.user?.perfil !== 'TECNICO') return;

    if ((e.ctrlKey || e.metaKey) && (e.key === 'p' || e.key === 'P')) {
      e.preventDefault();
      showToast('⚠️ Impressão não permitida para o perfil Técnico.', 'info');
      return false;
    }
  });
}

function setupTheme() {
  const savedTheme = localStorage.getItem('app_theme') || 'light';
  document.documentElement.setAttribute('data-theme', savedTheme);
  updateThemeIcon(savedTheme);

  const toggleBtn = document.getElementById('theme-toggle-btn');
  toggleBtn.addEventListener('click', () => {
    const current = document.documentElement.getAttribute('data-theme');
    const nextTheme = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', nextTheme);
    localStorage.setItem('app_theme', nextTheme);
    updateThemeIcon(nextTheme);
  });
}

function updateThemeIcon(theme) {
  const btn = document.getElementById('theme-toggle-btn');
  if (!btn) return;
  btn.innerHTML = theme === 'dark' 
    ? '<i class="bi bi-sun-fill" style="color: #f59e0b;"></i>' 
    : '<i class="bi bi-moon-stars-fill"></i>';
}

// =====================================================================
// CARGA DE DADOS (API)
// =====================================================================
async function loadClientes() {
  try {
    const res = await api.get('/api/clientes');
    state.clientes = res.data || [];
    populateClientesSelect();
    renderCadastrosClientesTable();
  } catch (err) {
    console.error('Erro ao carregar clientes:', err);
  }
}

async function loadTecnicos() {
  try {
    const res = await api.get('/api/tecnicos');
    state.tecnicos = res.data || [];
    populateTecnicosSelect();
    renderCadastrosTecnicosTable();
  } catch (err) {
    console.error('Erro ao carregar técnicos:', err);
  }
}

async function loadOrcamentos() {
  const tbody = document.getElementById('orcamentos-table-body');
  try {
    const params = {};
    if (state.filters.q) params.q = state.filters.q;
    if (state.filters.tipo_servico) params.tipo_servico = state.filters.tipo_servico;
    if (state.filters.g_origem) params.g_origem = state.filters.g_origem;
    if (state.filters.status) params.status = state.filters.status;
    if (state.filters.geor_liberou) params.geor_liberou = state.filters.geor_liberou;

    const res = await api.get('/api/orcamentos', params);
    state.orcamentos = res.data || [];

    // Atualiza KPIs
    if (res.stats) {
      document.getElementById('kpi-total').textContent = res.stats.total;
      document.getElementById('kpi-geor-wait').textContent = res.stats.aguardando_geor;
      document.getElementById('kpi-geor-ok').textContent = res.stats.liberados_geor;
      document.getElementById('kpi-sent').textContent = res.stats.enviados_cliente;
    }

    renderOrcamentosTable();
  } catch (err) {
    tbody.innerHTML = `
      <tr>
        <td colspan="12" style="text-align: center; color: #ef4444; padding: 2rem;">
          <i class="bi bi-exclamation-triangle-fill" style="font-size: 1.5rem;"></i>
          <div>Falha ao carregar lista de orçamentos: ${err.message}</div>
        </td>
      </tr>
    `;
  }
}

// =====================================================================
// RENDERIZAÇÃO DA TABELA
// =====================================================================
function renderOrcamentosTable() {
  const tbody = document.getElementById('orcamentos-table-body');
  const items = state.orcamentos;
  const isConsultora = auth.isConsultora(state.user);

  if (!items || items.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="12" style="text-align: center; color: var(--text-muted); padding: 3rem;">
          <i class="bi bi-inbox" style="font-size: 2rem; display: block; margin-bottom: 0.5rem;"></i>
          Nenhum orçamento encontrado com os filtros atuais.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = items.map((item) => {
    const isGeorSim = item.geor_liberou === 'Sim';
    const isPreventivo = item.tipo_servico === 'Preventivo';

    let statusBadgeClass = 'badge-pill-yes';
    if (item.status === 'Aberto') statusBadgeClass = 'badge-tag role-supervisor';
    else if (item.status === 'Aguardando GEOR') statusBadgeClass = 'badge-pill-no';
    else if (item.status === 'Liberado GEOR') statusBadgeClass = 'badge-pill-yes';
    else if (item.status === 'Enviado ao Cliente') statusBadgeClass = 'badge-tag role-consultora';
    else if (item.status === 'Cancelado') statusBadgeClass = 'badge-tag' + ' style="background:#fee2e2; color:#b91c1c;"';

    return `
      <tr>
        <td>
          <div style="font-weight: 700; color: var(--brand-primary);">${item.numero_pgo}</div>
          <div style="font-size: 0.72rem; color: var(--text-muted);">ID #${item.id}</div>
        </td>
        <td>
          <span class="badge-tag" style="background: rgba(98, 0, 234, 0.08); color: var(--tke-purple); font-weight: 800; border: 1px solid rgba(98, 0, 234, 0.2); letter-spacing: 0.03em;">
            ${escapeHtml(item.g_origem || 'G11')}
          </span>
        </td>
        <td>
          <span class="badge-tag ${isPreventivo ? 'badge-type-preventivo' : 'badge-type-corretivo'}">
            <i class="bi ${isPreventivo ? 'bi-shield-check' : 'bi-tools'}"></i>
            ${item.tipo_servico}
          </span>
        </td>
        <td>
          <div style="font-weight: 600;">${escapeHtml(item.nome_cliente)}</div>
          <div style="font-size: 0.72rem; color: var(--text-muted);">${escapeHtml(item.numero_contrato)}</div>
        </td>
        <td>
          <div style="font-weight: 500;">${escapeHtml(item.nome_tecnico)}</div>
          <div style="font-size: 0.72rem; color: var(--text-muted);">Matrícula: ${escapeHtml(item.matricula_tecnico)}</div>
        </td>
        <td>
          <span style="font-family: monospace; font-weight: 700; color: var(--text-primary);">${escapeHtml(item.numero_orcamento)}</span>
        </td>
        <td>
          <div style="font-size: 0.82rem; font-weight: 500; color: var(--text-primary); max-width: 220px; line-height: 1.3;">
            ${escapeHtml(item.descricao_servico || '-')}
          </div>
        </td>
        <td>
          <span style="font-size: 0.8rem;">${formatDate(item.data_liberacao)}</span>
        </td>
        <td>
          <span class="badge-tag ${isGeorSim ? 'badge-pill-yes' : 'badge-pill-no'}">
            <i class="bi ${isGeorSim ? 'bi-check-circle-fill' : 'bi-clock-history'}"></i>
            ${item.geor_liberou}
          </span>
        </td>
        <td>
          <span style="font-size: 0.8rem;">${formatDate(item.data_envio_cliente)}</span>
        </td>
        <td>
          <span class="badge-tag" style="font-weight: 600; background: var(--bg-primary); border: 1px solid var(--border-strong);">
            ${escapeHtml(item.status)}
          </span>
        </td>
        <td style="text-align: right; white-space: nowrap;">
          <button 
            type="button" 
            class="btn btn-secondary btn-sm btn-edit-orcamento" 
            data-id="${item.id}"
            title="Editar Orçamento"
          >
            <i class="bi bi-pencil-square"></i>
            <span>Editar</span>
          </button>
          ${isConsultora ? `
            <button 
              type="button" 
              class="btn btn-secondary btn-sm btn-delete-orcamento" 
              data-id="${item.id}"
              data-pgo="${escapeHtml(item.numero_pgo)}"
              style="color: #ef4444; border-color: #fecaca;"
              title="Excluir (Exclusivo Consultora)"
            >
              <i class="bi bi-trash3-fill"></i>
            </button>
          ` : ''}
        </td>
      </tr>
    `;
  }).join('');

  // Associa eventos nos botões da tabela
  document.querySelectorAll('.btn-edit-orcamento').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-id');
      openEditModal(id);
    });
  });

  document.querySelectorAll('.btn-delete-orcamento').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.getAttribute('data-id');
      const pgo = btn.getAttribute('data-pgo');
      if (confirm(`Confirma a exclusão definitiva do chamado ${pgo} (ID #${id})?`)) {
        try {
          await api.delete(`/api/orcamentos/${id}`);
          showToast('Chamado excluído com sucesso!', 'success');
          await loadOrcamentos();
        } catch (err) {
          showToast(err.message, 'error');
        }
      }
    });
  });
}

// =====================================================================
// =====================================================================
// DATALISTS PARA AUTOCOMPLETE DE ELEVADORES E TÉCNICOS
// =====================================================================
function populateDatalists() {
  const elevList = document.getElementById('elevadores-datalist');
  if (elevList) {
    elevList.innerHTML = state.clientes.map(c => `
      <option value="${escapeHtml(c.numero_contrato)}">${escapeHtml(c.numero_contrato)} - ${escapeHtml(c.nome_cliente)}</option>
    `).join('');
  }

  const tecList = document.getElementById('tecnicos-datalist');
  if (tecList) {
    tecList.innerHTML = state.tecnicos.map(t => `
      <option value="${escapeHtml(t.matricula)}">${escapeHtml(t.matricula)} - ${escapeHtml(t.nome_sobrenome)} (${escapeHtml(t.funcao || 'Técnico')})</option>
    `).join('');
  }
}

// Mantido para compatibilidade se invocado externamente
function populateClientesSelect() {
  populateDatalists();
}

function populateTecnicosSelect() {
  populateDatalists();
}

// =====================================================================
// MODAL DE NOVO / EDITAR ORÇAMENTO COM RBAC DINÂMICO E 3 SEÇÕES
// =====================================================================
function applyRbacToModal(isEdit = false, item = null) {
  const user = state.user;
  const isConsultora = auth.isConsultora(user);
  const isSupervisor = auth.isSupervisor(user);
  const isTecnico = auth.isTecnico(user);

  // Cards das 3 Seções
  const secTecnico = document.getElementById('sec-card-tecnico');
  const secSupervisor = document.getElementById('sec-card-supervisor');
  const secConsultora = document.getElementById('sec-card-consultora');

  // Inputs da Seção 1 (Técnico)
  const inputMatricula = document.getElementById('form-tecnico-matricula');
  const inputNomeTecnico = document.getElementById('form-tecnico-nome');
  const selectTipo = document.getElementById('form-tipo');
  const selectGOrigem = document.getElementById('form-g-origem');
  const inputElevador = document.getElementById('form-elevador');
  const inputNomeCliente = document.getElementById('form-cliente-nome');
  const inputPgo = document.getElementById('form-pgo');
  const inputDesc = document.getElementById('form-descricao-servico');

  // Inputs da Seção 2 (Supervisão)
  const inputOrcamento = document.getElementById('form-orcamento');
  const inputValorTotal = document.getElementById('form-valor-total');
  const inputDataLiberacao = document.getElementById('form-data-liberacao');
  const selectGeor = document.getElementById('form-geor');

  // Inputs da Seção 3 (Consultoria)
  const inputDataEnvio = document.getElementById('form-data-envio');
  const selectStatus = document.getElementById('form-status');

  // Controles de Ação do Modal
  const saveBtn = document.getElementById('modal-save-btn');
  const saveBtnText = document.getElementById('modal-save-btn-text');
  const rbacText = document.getElementById('form-rbac-text');

  // Reset de classes de bloqueio
  secTecnico.classList.remove('section-locked');
  secSupervisor.classList.remove('section-locked');
  secConsultora.classList.remove('section-locked');
  saveBtn.style.display = 'inline-flex';

  // =====================================================================
  // CENÁRIO 1: PERFIL TÉCNICO
  // =====================================================================
  if (isTecnico) {
    if (isEdit) {
      // Pós-gravação: estritamente SOMENTE LEITURA para o técnico
      secTecnico.classList.add('section-locked');
      secSupervisor.classList.add('section-locked');
      secConsultora.classList.add('section-locked');

      inputMatricula.disabled = true;
      selectTipo.disabled = true;
      selectGOrigem.disabled = true;
      inputElevador.disabled = true;
      inputPgo.disabled = true;
      inputDesc.disabled = true;

      inputOrcamento.disabled = true;
      inputValorTotal.disabled = true;
      inputDataLiberacao.disabled = true;
      selectGeor.disabled = true;

      inputDataEnvio.disabled = true;
      selectStatus.disabled = true;

      saveBtn.style.display = 'none';
      rbacText.innerHTML = '🔒 <strong>Modo Somente Leitura (Técnico):</strong> Este chamado já foi gravado no sistema e não permite alterações posteriores por técnicos.';
    } else {
      // Momento da Criação: Preenche Seção 1. Seções 2 e 3 bloqueadas.
      secSupervisor.classList.add('section-locked');
      secConsultora.classList.add('section-locked');

      inputMatricula.value = user.matricula;
      inputNomeTecnico.value = user.nome;
      inputMatricula.disabled = true; // Vinculado compulsoriamente a ele mesmo
      selectTipo.disabled = false;
      selectGOrigem.disabled = false;
      inputElevador.disabled = false;
      inputPgo.disabled = false;
      inputDesc.disabled = false;

      inputOrcamento.disabled = true;
      inputValorTotal.disabled = true;
      inputDataLiberacao.disabled = true;
      selectGeor.disabled = true;

      inputDataEnvio.disabled = true;
      selectStatus.disabled = true;

      saveBtnText.textContent = 'Salvar Chamado (Técnico)';
      rbacText.innerHTML = '🛠️ <strong>Perfil Técnico:</strong> Preencha os dados da Seção 1 (Elevador, Tipo de Serviço, G de Origem e PGO). As seções de Supervisão e Consultoria serão preenchidas pelas áreas competentes.';
    }
    return;
  }

  // =====================================================================
  // CENÁRIO 2: PERFIL SUPERVISOR
  // =====================================================================
  if (isSupervisor) {
    // Seção 1 é sempre Somente Leitura para o Supervisor
    secTecnico.classList.add('section-locked');
    inputMatricula.disabled = true;
    selectTipo.disabled = true;
    selectGOrigem.disabled = true;
    inputElevador.disabled = true;
    inputPgo.disabled = true;
    inputDesc.disabled = true;

    // Seção 3 é sempre Bloqueada para o Supervisor (Valor Total, Data de Envio e Status)
    secConsultora.classList.add('section-locked');
    inputValorTotal.disabled = true;
    inputDataEnvio.disabled = true;
    selectStatus.disabled = true;

    // Seção 2 (Supervisão):
    if (item && item.geor_liberou === 'Sim') {
      // Se já salvo e liberado GEOR, torna-se SOMENTE LEITURA
      secSupervisor.classList.add('section-locked');
      inputOrcamento.disabled = true;
      inputDataLiberacao.disabled = true;
      selectGeor.disabled = true;
      saveBtn.style.display = 'none';
      rbacText.innerHTML = '🔒 <strong>Liberação Concluída (Somente Leitura):</strong> A validação GEOR deste orçamento já foi concluída e salva pela supervisão.';
    } else {
      // Pode preencher Seção 2 (Nº Orçamento, Data Liberação e GEOR)
      inputOrcamento.disabled = false;
      inputDataLiberacao.disabled = false;
      selectGeor.disabled = false;
      saveBtnText.textContent = 'Salvar Liberação (Supervisão)';
      rbacText.innerHTML = '👔 <strong>Perfil Supervisor:</strong> Preencha a Seção 2 (Nº Orçamento, Data da Liberação e GEOR). A Seção 1 é somente leitura e a Seção 3 (Valor do Orçamento, Envio e Status) é de responsabilidade da Consultoria.';
    }
    return;
  }

  // =====================================================================
  // CENÁRIO 3: PERFIL CONSULTORA (ADMIN)
  // =====================================================================
  // Controle Total e Irrestrito em todas as seções 1, 2 e 3
  inputMatricula.disabled = false;
  selectTipo.disabled = false;
  selectGOrigem.disabled = false;
  inputElevador.disabled = false;
  inputPgo.disabled = false;
  inputDesc.disabled = false;

  inputOrcamento.disabled = false;
  inputValorTotal.disabled = false;
  inputDataLiberacao.disabled = false;
  selectGeor.disabled = false;

  inputDataEnvio.disabled = false;
  selectStatus.disabled = false;

  saveBtnText.textContent = isEdit ? 'Salvar Alterações (Consultora)' : 'Salvar Novo Orçamento (Consultora)';
  rbacText.innerHTML = '👑 <strong>Perfil Consultora (Admin):</strong> Controle total e irrestrito liberado para todas as seções (Técnico, Supervisão e Consultoria Comercial).';
}

function openNewModal() {
  state.editingId = null;
  document.getElementById('modal-title').textContent = 'Novo Chamado / Orçamento TKE';
  document.getElementById('orcamento-form').reset();
  document.getElementById('form-id').value = '';
  document.getElementById('form-g-origem').value = 'G11';
  document.getElementById('form-descricao-servico').value = '';
  document.getElementById('form-valor-total').value = '';
  document.getElementById('form-geor').value = 'Não';
  document.getElementById('form-status').value = 'Aberto';
  document.getElementById('form-tecnico-nome').value = '';
  document.getElementById('form-cliente-nome').value = '';

  populateDatalists();
  applyRbacToModal(false, null);

  document.getElementById('orcamento-modal').classList.add('active');
}

function openEditModal(id) {
  const item = state.orcamentos.find(o => String(o.id) === String(id));
  if (!item) return;

  state.editingId = item.id;
  document.getElementById('modal-title').textContent = `Orçamento TKE - ${item.numero_pgo} (#${item.id})`;

  document.getElementById('form-id').value = item.id;
  document.getElementById('form-tecnico-matricula').value = item.matricula_tecnico;
  document.getElementById('form-tecnico-nome').value = item.nome_tecnico;
  document.getElementById('form-tipo').value = item.tipo_servico;
  document.getElementById('form-g-origem').value = item.g_origem || 'G11';
  document.getElementById('form-elevador').value = item.numero_contrato;
  document.getElementById('form-cliente-nome').value = item.nome_cliente;
  document.getElementById('form-pgo').value = item.numero_pgo;
  document.getElementById('form-orcamento').value = item.numero_orcamento && item.numero_orcamento !== 'Aguardando Orçamento' ? item.numero_orcamento : '';
  document.getElementById('form-valor-total').value = item.valor_total ? Number(item.valor_total) : '';
  document.getElementById('form-descricao-servico').value = item.descricao_servico || '';
  document.getElementById('form-status').value = item.status;
  document.getElementById('form-geor').value = item.geor_liberou;
  document.getElementById('form-data-liberacao').value = item.data_liberacao || '';
  document.getElementById('form-data-envio').value = item.data_envio_cliente || '';

  populateDatalists();
  applyRbacToModal(true, item);

  document.getElementById('orcamento-modal').classList.add('active');
}

function closeModal() {
  document.getElementById('orcamento-modal').classList.remove('active');
}

// =====================================================================
// EVENT LISTENERS GERAIS
// =====================================================================
function setupEventListeners() {
  // Setup de abas principais
  setupMainTabs();

  // Setup do Módulo de Sincronização em Tempo Real
  setupAutoSync();

  // Setup do Módulo de Gestão de Usuários (Consultora)
  setupUsuariosEventListeners();

  // Setup do Modal de Primeiro Acesso (Dashboard)
  setupDashboardFirstAccessListener();

  // Logout
  document.getElementById('btn-logout').addEventListener('click', () => {
    if (confirm('Deseja realmente sair da sessão corporativa?')) {
      auth.logout();
    }
  });

  // Abertura de Novo Orçamento
  document.getElementById('btn-new-orcamento').addEventListener('click', openNewModal);
  document.getElementById('modal-close-btn').addEventListener('click', closeModal);
  document.getElementById('modal-cancel-btn').addEventListener('click', closeModal);

  // Autocomplete: Digitar Matrícula -> Preenche Nome do Técnico e G de Origem
  const matriculaInput = document.getElementById('form-tecnico-matricula');
  const handleMatriculaLookup = () => {
    const val = matriculaInput.value.trim();
    if (!val) {
      document.getElementById('form-tecnico-nome').value = '';
      return;
    }
    const found = state.tecnicos.find(t => 
      String(t.matricula).toLowerCase() === val.toLowerCase() || 
      String(t.nome_sobrenome).toLowerCase() === val.toLowerCase()
    );
    if (found) {
      matriculaInput.value = found.matricula;
      document.getElementById('form-tecnico-nome').value = found.nome_sobrenome;
    }
  };
  matriculaInput.addEventListener('input', handleMatriculaLookup);
  matriculaInput.addEventListener('change', handleMatriculaLookup);

  // Autocomplete: Digitar Número do Elevador / Contrato -> Preenche Nome do Cliente
  const elevadorInput = document.getElementById('form-elevador');
  const clienteNomeInput = document.getElementById('form-cliente-nome');
  const hintElevador = document.getElementById('hint-elevador-auto');

  const handleElevadorLookup = () => {
    let val = (elevadorInput.value || '').trim();
    if (!val) {
      if (clienteNomeInput) clienteNomeInput.value = '';
      if (hintElevador) {
        hintElevador.innerHTML = '<i class="bi bi-buildings"></i> Digite para autocompletar o nome do cliente';
        hintElevador.style.color = '';
      }
      return;
    }

    // Se o usuário selecionou da lista no formato "ELEV-01 - Nome do Cliente"
    if (val.includes(' - ')) {
      const parts = val.split(' - ');
      val = parts[0].trim();
      elevadorInput.value = val;
    }

    const valLower = val.toLowerCase();
    const found = state.clientes.find(c => 
      String(c.numero_contrato).trim().toLowerCase() === valLower || 
      String(c.nome_cliente).trim().toLowerCase() === valLower
    );

    if (found) {
      elevadorInput.value = found.numero_contrato;
      if (clienteNomeInput) clienteNomeInput.value = found.nome_cliente;
      if (hintElevador) {
        hintElevador.innerHTML = `<i class="bi bi-check-circle-fill" style="color: #10B981;"></i> Cliente: <strong>${escapeHtml(found.nome_cliente)}</strong>`;
        hintElevador.style.color = '#059669';
      }
    } else {
      if (clienteNomeInput) clienteNomeInput.value = '';
      if (hintElevador) {
        hintElevador.innerHTML = '<i class="bi bi-info-circle"></i> Elevador não cadastrado. Cadastre o cliente na base para autopreenchimento.';
        hintElevador.style.color = 'var(--text-muted)';
      }
    }
  };
  elevadorInput.addEventListener('input', handleElevadorLookup);
  elevadorInput.addEventListener('change', handleElevadorLookup);

  // Salvar Orçamento (Create / Update)
  document.getElementById('orcamento-form').addEventListener('submit', async (e) => {
    e.preventDefault();

    const saveBtn = document.getElementById('modal-save-btn');
    saveBtn.disabled = true;
    saveBtn.innerHTML = '<i class="bi bi-arrow-repeat spin"></i> Salvando...';

    try {
      const payload = {
        matricula_tecnico: document.getElementById('form-tecnico-matricula').value.trim(),
        nome_tecnico: document.getElementById('form-tecnico-nome').value.trim(),
        tipo_servico: document.getElementById('form-tipo').value,
        g_origem: document.getElementById('form-g-origem').value,
        numero_contrato: document.getElementById('form-elevador').value.trim(),
        numero_elevador: document.getElementById('form-elevador').value.trim(),
        nome_cliente: document.getElementById('form-cliente-nome').value.trim(),
        numero_pgo: document.getElementById('form-pgo').value.trim(),
        numero_orcamento: document.getElementById('form-orcamento').value.trim() || null,
        valor_total: Number(document.getElementById('form-valor-total').value) || 0.00,
        descricao_servico: document.getElementById('form-descricao-servico').value.trim() || null,
        geor_liberou: document.getElementById('form-geor').value,
        data_liberacao: document.getElementById('form-data-liberacao').value || null,
        data_envio_cliente: document.getElementById('form-data-envio').value || null,
        status: document.getElementById('form-status').value
      };

      if (state.editingId) {
        await api.put(`/api/orcamentos/${state.editingId}`, payload);
        showToast('Registro atualizado com sucesso!', 'success');
      } else {
        await api.post('/api/orcamentos', payload);
        showToast('Novo chamado cadastrado com sucesso!', 'success');
      }

      closeModal();
      await loadOrcamentos();
    } catch (err) {
      showToast(err.message || 'Erro ao salvar registro', 'error');
    } finally {
      saveBtn.disabled = false;
      saveBtn.innerHTML = '<i class="bi bi-check-lg"></i> <span id="modal-save-btn-text">Salvar Registro</span>';
    }
  });

  // Filtros em tempo real
  let debounceTimer;
  document.getElementById('filter-search').addEventListener('input', (e) => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      state.filters.q = e.target.value.trim();
      loadOrcamentos();
    }, 250);
  });

  const filterTipo = document.getElementById('filter-tipo');
  if (filterTipo) {
    filterTipo.addEventListener('change', (e) => {
      state.filters.tipo_servico = e.target.value;
      loadOrcamentos();
    });
  }

  document.getElementById('filter-g-origem').addEventListener('change', (e) => {
    state.filters.g_origem = e.target.value;
    loadOrcamentos();
  });

  document.getElementById('filter-status').addEventListener('change', (e) => {
    state.filters.status = e.target.value;
    loadOrcamentos();
  });

  document.getElementById('filter-geor').addEventListener('change', (e) => {
    state.filters.geor_liberou = e.target.value;
    loadOrcamentos();
  });

  document.getElementById('btn-clear-filters').addEventListener('click', () => {
    document.getElementById('filter-search').value = '';
    const filterTipoEl = document.getElementById('filter-tipo');
    if (filterTipoEl) filterTipoEl.value = '';
    document.getElementById('filter-g-origem').value = '';
    document.getElementById('filter-status').value = '';
    document.getElementById('filter-geor').value = '';
    state.filters = { q: '', tipo_servico: '', g_origem: '', status: '', geor_liberou: '' };
    loadOrcamentos();
    showToast('Filtros redefinidos.', 'info');
  });

  // Exportar CSV
  const btnExportCsvEl = document.getElementById('btn-export-csv');
  if (btnExportCsvEl) {
    btnExportCsvEl.addEventListener('click', exportToCSV);
  }

  // Modal de Cadastros de Apoio (Clientes & Técnicos)
  setupCadastrosModal();

  // Modal de Alteração de Cadastros (Exclusivo Consultora)
  setupEditCadastroModal();
}

// =====================================================================
// MODAL DE CADASTROS (CLIENTES & TÉCNICOS)
// =====================================================================
function setupCadastrosModal() {
  const modal = document.getElementById('cadastros-modal');
  const btnOpen = document.getElementById('btn-open-cadastros');
  const btnClose = document.getElementById('cadastros-close-btn');
  const btnOk = document.getElementById('cadastros-ok-btn');

  const tabClientesBtn = document.getElementById('tab-btn-clientes');
  const tabTecnicosBtn = document.getElementById('tab-btn-tecnicos');

  const contentClientes = document.getElementById('tab-content-clientes');
  const contentTecnicos = document.getElementById('tab-content-tecnicos');

  const isConsultora = auth.isConsultora(state.user);

  // Esconde formulários manuais se não for CONSULTORA
  const formWrapperCli = document.getElementById('cad-cliente-form-wrapper');
  const formWrapperTec = document.getElementById('cad-tecnico-form-wrapper');

  if (!isConsultora) {
    if (formWrapperCli) formWrapperCli.style.display = 'none';
    if (formWrapperTec) formWrapperTec.style.display = 'none';
  }

  const activateTab = (tab) => {
    if (tabClientesBtn) tabClientesBtn.className = 'btn btn-secondary btn-sm';
    if (tabTecnicosBtn) tabTecnicosBtn.className = 'btn btn-secondary btn-sm';

    if (contentClientes) contentClientes.style.display = 'none';
    if (contentTecnicos) contentTecnicos.style.display = 'none';

    if (tab === 'clientes') {
      if (tabClientesBtn) tabClientesBtn.className = 'btn btn-primary btn-sm';
      if (contentClientes) contentClientes.style.display = 'block';
    } else if (tab === 'tecnicos') {
      if (tabTecnicosBtn) tabTecnicosBtn.className = 'btn btn-primary btn-sm';
      if (contentTecnicos) contentTecnicos.style.display = 'block';
    }
  };

  if (btnOpen) {
    btnOpen.addEventListener('click', () => {
      if (state.user?.perfil === 'TECNICO') {
        showToast('Acesso restrito à supervisão e consultoria.', 'warning');
        return;
      }
      activateTab('clientes');
      if (modal) modal.classList.add('active');
    });
  }

  if (btnClose) btnClose.addEventListener('click', () => modal?.classList.remove('active'));
  if (btnOk) btnOk.addEventListener('click', () => modal?.classList.remove('active'));

  if (tabClientesBtn) tabClientesBtn.addEventListener('click', () => activateTab('clientes'));
  if (tabTecnicosBtn) tabTecnicosBtn.addEventListener('click', () => activateTab('tecnicos'));

  // Cadastro Manual de Cliente
  const cadCliForm = document.getElementById('cad-cliente-form');
  if (cadCliForm) {
    cadCliForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const numero_contrato = document.getElementById('cad-contrato-input')?.value.trim();
      const nome_cliente = document.getElementById('cad-cliente-nome-input')?.value.trim();

      try {
        await api.post('/api/clientes', { numero_contrato, nome_cliente });
        showToast('Cliente cadastrado com sucesso!', 'success');
        cadCliForm.reset();
        await loadClientes();
      } catch (err) {
        showToast(err.message, 'error');
      }
    });
  }

  // Cadastro Manual de Técnico (Matrícula, Função, Nome Completo)
  const cadTecForm = document.getElementById('cad-tecnico-form');
  if (cadTecForm) {
    cadTecForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const matricula = document.getElementById('cad-tec-matricula')?.value.trim();
      const funcao = document.getElementById('cad-tec-funcao')?.value.trim();
      const nome_sobrenome = document.getElementById('cad-tec-nome')?.value.trim();

      try {
        await api.post('/api/tecnicos', { matricula, funcao, nome_sobrenome });
        showToast('Técnico cadastrado com sucesso!', 'success');
        cadTecForm.reset();
        await loadTecnicos();
      } catch (err) {
        showToast(err.message, 'error');
      }
    });
  }

  // Setup do Módulo de Importação Embutido (Clientes e Técnicos)
  setupInlineUploader({
    type: 'cli',
    endpoint: '/api/clientes/import',
    refreshFn: loadClientes
  });

  setupInlineUploader({
    type: 'tec',
    endpoint: '/api/tecnicos/import',
    refreshFn: loadTecnicos
  });
}

// Helper genérico para upload inline de planilhas
function setupInlineUploader({ type, endpoint, refreshFn }) {
  const toggleBtn = document.getElementById(`btn-toggle-import-${type}`);
  const panel = document.getElementById(`import-${type}-panel`);
  const dropzone = document.getElementById(`dropzone-${type}`);
  const fileInput = document.getElementById(`file-input-${type}`);
  const fileChip = document.getElementById(`file-chip-${type}`);
  const fileName = document.getElementById(`filename-${type}`);
  const fileMeta = document.getElementById(`filemeta-${type}`);
  const removeBtn = document.getElementById(`btn-remove-${type}`);
  const uploadBtn = document.getElementById(`btn-upload-${type}`);

  const progressContainer = document.getElementById(`progress-container-${type}`);
  const progressBar = document.getElementById(`progress-bar-${type}`);
  const progressPercent = document.getElementById(`progress-percent-${type}`);
  const progressLabel = document.getElementById(`progress-label-${type}`);

  const resultsBox = document.getElementById(`results-${type}`);
  const statTotal = document.getElementById(`stat-total-${type}`);
  const statIns = document.getElementById(`stat-ins-${type}`);
  const statUpd = document.getElementById(`stat-upd-${type}`);
  const statErr = document.getElementById(`stat-err-${type}`);
  const errorsBox = document.getElementById(`errors-box-${type}`);
  const errorsList = document.getElementById(`errors-list-${type}`);

  if (!toggleBtn || !panel) return;

  let selectedFile = null;

  toggleBtn.addEventListener('click', () => {
    const isVisible = panel.style.display !== 'none';
    panel.style.display = isVisible ? 'none' : 'block';
    toggleBtn.classList.toggle('btn-primary', !isVisible);
    toggleBtn.classList.toggle('btn-secondary', isVisible);
  });

  const handleFile = (file) => {
    if (!file) return;
    const name = file.name.toLowerCase();
    if (!name.endsWith('.xlsx') && !name.endsWith('.xls') && !name.endsWith('.csv')) {
      showToast('Formato inválido! Envie apenas planilhas Excel (.xlsx, .xls) ou CSV.', 'error');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      showToast('Arquivo muito grande! Máximo 10MB.', 'error');
      return;
    }
    selectedFile = file;
    fileName.textContent = file.name;
    fileMeta.textContent = `${(file.size / 1024).toFixed(1)} KB`;
    fileChip.style.display = 'flex';
    dropzone.style.display = 'none';
    uploadBtn.disabled = false;
    resultsBox.style.display = 'none';
  };

  const reset = () => {
    selectedFile = null;
    fileInput.value = '';
    fileChip.style.display = 'none';
    dropzone.style.display = 'flex';
    uploadBtn.disabled = true;
  };

  removeBtn.addEventListener('click', reset);
  dropzone.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', (e) => {
    if (e.target.files && e.target.files[0]) handleFile(e.target.files[0]);
  });

  ['dragenter', 'dragover'].forEach(evt => dropzone.addEventListener(evt, (e) => {
    e.preventDefault();
    dropzone.classList.add('dragover');
  }));

  ['dragleave', 'drop'].forEach(evt => dropzone.addEventListener(evt, (e) => {
    e.preventDefault();
    dropzone.classList.remove('dragover');
  }));

  dropzone.addEventListener('drop', (e) => {
    if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  });

  uploadBtn.addEventListener('click', async () => {
    if (!selectedFile) return;

    uploadBtn.disabled = true;
    uploadBtn.innerHTML = '<i class="bi bi-arrow-repeat spin"></i> Processando...';

    progressContainer.style.display = 'block';
    progressBar.style.width = '30%';
    progressPercent.textContent = '30%';
    progressLabel.textContent = 'Validando estrutura da planilha...';

    const formData = new FormData();
    formData.append('file', selectedFile);

    try {
      setTimeout(() => {
        progressBar.style.width = '75%';
        progressPercent.textContent = '75%';
        progressLabel.textContent = 'Gravando e atualizando registros...';
      }, 300);

      const res = await api.upload(endpoint, formData);

      progressBar.style.width = '100%';
      progressPercent.textContent = '100%';
      progressLabel.textContent = 'Concluído!';

      if (res.stats) {
        statTotal.textContent = res.stats.totalRows || 0;
        statIns.textContent = res.stats.inserted || 0;
        statUpd.textContent = res.stats.updated || 0;
        statErr.textContent = res.stats.errorsCount || 0;
      }

      if (res.errors && res.errors.length > 0) {
        errorsList.innerHTML = res.errors.map(err => `<li>${escapeHtml(err)}</li>`).join('');
        errorsBox.style.display = 'block';
      } else {
        errorsBox.style.display = 'none';
      }

      resultsBox.style.display = 'block';
      showToast(res.message || 'Importação realizada com sucesso!', 'success');

      await refreshFn();
      await loadOrcamentos();
      reset();

    } catch (err) {
      progressBar.style.width = '100%';
      progressBar.style.background = '#EF4444';
      progressPercent.textContent = 'Erro';
      progressLabel.textContent = `Falha: ${err.message}`;
      showToast(err.message || 'Erro ao processar planilha.', 'error');
    } finally {
      uploadBtn.disabled = false;
      uploadBtn.innerHTML = '<i class="bi bi-cloud-upload-fill"></i> Enviar e Importar';
    }
  });
}

function renderCadastrosClientesTable() {
  const tbody = document.getElementById('cad-clientes-tbody');
  if (!tbody) return;
  const isConsultora = auth.isConsultora(state.user);

  if (!state.clientes || state.clientes.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="4" style="text-align: center; color: var(--text-muted); padding: 2rem;">
          Nenhum cliente cadastrado.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = state.clientes.map(c => `
    <tr>
      <td style="font-weight: 700;">${escapeHtml(c.numero_contrato)}</td>
      <td>${escapeHtml(c.nome_cliente)}</td>
      <td style="font-size: 0.75rem; color: var(--text-muted);">${formatDate(c.created_at?.split(' ')[0])}</td>
      <td style="text-align: center; white-space: nowrap;">
        ${isConsultora ? `
          <div style="display: flex; gap: 0.35rem; justify-content: center;">
            <button 
              type="button" 
              class="btn btn-secondary btn-sm btn-edit-cad-cli" 
              data-contrato="${escapeHtml(c.numero_contrato)}" 
              title="Alterar Cadastro de Cliente (Exclusivo Consultora)"
              style="padding: 0.2rem 0.5rem; font-size: 0.75rem;"
            >
              <i class="bi bi-pencil-square" style="color: var(--tke-purple);"></i>
              <span>Editar</span>
            </button>
            <button 
              type="button" 
              class="btn btn-secondary btn-sm btn-delete-cad-cli" 
              data-contrato="${escapeHtml(c.numero_contrato)}"
              data-name="${escapeHtml(c.nome_cliente)}"
              title="Excluir Cliente"
              style="padding: 0.2rem 0.5rem; font-size: 0.75rem; color: #EF4444;"
            >
              <i class="bi bi-trash3-fill"></i>
            </button>
          </div>
        ` : `
          <span style="font-size: 0.72rem; color: var(--text-muted);">-</span>
        `}
      </td>
    </tr>
  `).join('');

  if (isConsultora) {
    document.querySelectorAll('.btn-edit-cad-cli').forEach(btn => {
      btn.addEventListener('click', () => {
        const contrato = btn.getAttribute('data-contrato');
        openEditClienteModal(contrato);
      });
    });

    document.querySelectorAll('.btn-delete-cad-cli').forEach(btn => {
      btn.addEventListener('click', async () => {
        const contrato = btn.getAttribute('data-contrato');
        const name = btn.getAttribute('data-name');
        if (confirm(`Confirma a exclusão do cliente "${name}" (Contrato: ${contrato})?`)) {
          try {
            const res = await api.delete(`/api/clientes/${encodeURIComponent(contrato)}`);
            showToast(res.message || 'Cliente excluído com sucesso!', 'success');
            await loadClientes();
            await loadOrcamentos();
          } catch (err) {
            showToast(`Erro ao excluir cliente: ${err.message}`, 'error');
          }
        }
      });
    });
  }
}

function renderCadastrosTecnicosTable() {
  const tbody = document.getElementById('cad-tecnicos-tbody');
  if (!tbody) return;
  const isConsultora = auth.isConsultora(state.user);

  if (!state.tecnicos || state.tecnicos.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="4" style="text-align: center; color: var(--text-muted); padding: 2rem;">
          Nenhum técnico cadastrado.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = state.tecnicos.map(t => `
    <tr>
      <td style="font-weight: 700; color: var(--text-primary); font-family: monospace; font-size: 0.88rem;">${escapeHtml(t.matricula)}</td>
      <td>
        <span class="badge-tag" style="background: rgba(98, 0, 234, 0.08); color: var(--tke-purple); font-weight: 600;">
          ${escapeHtml(t.funcao || 'Técnico de Manutenção')}
        </span>
      </td>
      <td style="font-weight: 600; color: var(--text-primary);">${escapeHtml(t.nome_sobrenome)}</td>
      <td style="text-align: center; white-space: nowrap;">
        ${isConsultora ? `
          <div style="display: flex; gap: 0.35rem; justify-content: center;">
            <button 
              type="button" 
              class="btn btn-secondary btn-sm btn-edit-cad-tec" 
              data-matricula="${escapeHtml(t.matricula)}" 
              title="Alterar Cadastro de Técnico (Exclusivo Consultora)"
              style="padding: 0.2rem 0.5rem; font-size: 0.75rem;"
            >
              <i class="bi bi-pencil-square" style="color: var(--tke-purple);"></i>
              <span>Editar</span>
            </button>
            <button 
              type="button" 
              class="btn btn-secondary btn-sm btn-delete-cad-tec" 
              data-matricula="${escapeHtml(t.matricula)}"
              data-name="${escapeHtml(t.nome_sobrenome)}"
              title="Excluir Técnico"
              style="padding: 0.2rem 0.5rem; font-size: 0.75rem; color: #EF4444;"
            >
              <i class="bi bi-trash3-fill"></i>
            </button>
          </div>
        ` : `
          <span style="font-size: 0.72rem; color: var(--text-muted);">-</span>
        `}
      </td>
    </tr>
  `).join('');

  if (isConsultora) {
    document.querySelectorAll('.btn-edit-cad-tec').forEach(btn => {
      btn.addEventListener('click', () => {
        const matricula = btn.getAttribute('data-matricula');
        openEditTecnicoModal(matricula);
      });
    });

    document.querySelectorAll('.btn-delete-cad-tec').forEach(btn => {
      btn.addEventListener('click', async () => {
        const matricula = btn.getAttribute('data-matricula');
        const name = btn.getAttribute('data-name');
        if (confirm(`Confirma a exclusão do técnico "${name}" (Matrícula: ${matricula})?`)) {
          try {
            const res = await api.delete(`/api/tecnicos/${encodeURIComponent(matricula)}`);
            showToast(res.message || 'Técnico excluído com sucesso!', 'success');
            await loadTecnicos();
            await loadOrcamentos();
          } catch (err) {
            showToast(`Erro ao excluir técnico: ${err.message}`, 'error');
          }
        }
      });
    });
  }
}

// =====================================================================
// MODAL DEDICADO: ALTERAÇÃO DE CADASTRO (EXCLUSIVO CONSULTORA)
// =====================================================================
let currentEditType = null; // 'tecnico' | 'cliente' | 'usuario'
let currentEditId = null;

function setupEditCadastroModal() {
  const modal = document.getElementById('edit-cadastro-modal');
  const btnClose = document.getElementById('edit-cad-close-btn');
  const btnCancel = document.getElementById('edit-cad-cancel-btn');
  const form = document.getElementById('edit-cadastro-form');

  const closeEditModal = () => {
    if (modal) modal.classList.remove('active');
    currentEditType = null;
    currentEditId = null;
  };

  if (btnClose) btnClose.addEventListener('click', closeEditModal);
  if (btnCancel) btnCancel.addEventListener('click', closeEditModal);

  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      if (!auth.isConsultora(state.user)) {
        showToast('Apenas a Consultora possui permissão para alterar cadastros.', 'error');
        closeEditModal();
        return;
      }

      const saveBtn = document.getElementById('edit-cad-save-btn');
      saveBtn.disabled = true;
      saveBtn.innerHTML = '<i class="bi bi-arrow-repeat spin"></i> Salvando...';

      try {
        if (currentEditType === 'tecnico') {
          const matricula = currentEditId;
          const nova_matricula = document.getElementById('edit-tec-matricula').value.trim();
          const funcao = document.getElementById('edit-tec-funcao').value.trim();
          const nome_sobrenome = document.getElementById('edit-tec-nome').value.trim();
          const email = document.getElementById('edit-tec-email').value.trim();
          const telefone = document.getElementById('edit-tec-telefone').value.trim();

          const res = await api.put(`/api/tecnicos/${encodeURIComponent(matricula)}`, {
            nova_matricula,
            funcao,
            nome_sobrenome,
            email,
            telefone
          });

          showToast(res.message || 'Técnico alterado com sucesso!', 'success');
          closeEditModal();
          await loadTecnicos();
          await loadOrcamentos();
          if (state.activeTab === 'usuarios') await loadUsuarios();

        } else if (currentEditType === 'cliente') {
          const numero_contrato = currentEditId;
          const novo_contrato = document.getElementById('edit-cli-contrato').value.trim();
          const nome_cliente = document.getElementById('edit-cli-nome').value.trim();

          const res = await api.put(`/api/clientes/${encodeURIComponent(numero_contrato)}`, {
            novo_contrato,
            nome_cliente
          });

          showToast(res.message || 'Cliente alterado com sucesso!', 'success');
          closeEditModal();
          await loadClientes();
          await loadOrcamentos();

        } else if (currentEditType === 'usuario') {
          const id = currentEditId;
          const nome = document.getElementById('edit-usr-nome').value.trim();
          const email = document.getElementById('edit-usr-email').value.trim();
          const matricula = document.getElementById('edit-usr-matricula').value.trim();
          const perfil = document.getElementById('edit-usr-perfil').value;
          const grupo = document.getElementById('edit-usr-grupo').value;
          const ativo = document.getElementById('edit-usr-ativo').value === '1';

          const res = await api.put(`/api/usuarios/${id}`, {
            nome,
            email,
            matricula,
            perfil,
            grupo,
            ativo
          });

          showToast(res.message || 'Colaborador alterado com sucesso!', 'success');
          closeEditModal();
          await loadUsuarios();
          await loadTecnicos();
          await loadDashboardPremiacao();
        }
      } catch (err) {
        showToast(`Erro ao alterar cadastro: ${err.message}`, 'error');
      } finally {
        saveBtn.disabled = false;
        saveBtn.innerHTML = '<i class="bi bi-check2-circle"></i> <span>Salvar Alterações</span>';
      }
    });
  }
}

function openEditTecnicoModal(matricula) {
  if (!auth.isConsultora(state.user)) {
    showToast('Acesso negado. Apenas a Consultora pode alterar cadastros.', 'error');
    return;
  }

  const tec = state.tecnicos.find(t => String(t.matricula) === String(matricula));
  if (!tec) {
    showToast('Técnico não encontrado.', 'error');
    return;
  }

  currentEditType = 'tecnico';
  currentEditId = tec.matricula;

  document.getElementById('edit-cad-title').innerHTML = `
    <i class="bi bi-person-gear" style="color: var(--tke-purple);"></i>
    <span>Alterar Cadastro de Técnico</span>
  `;

  document.getElementById('edit-cad-notice').innerHTML = `
    Editando dados do técnico <strong>${escapeHtml(tec.nome_sobrenome)}</strong> (Matrícula: <code>${escapeHtml(tec.matricula)}</code>).
  `;

  const fieldsContainer = document.getElementById('edit-cad-dynamic-fields');
  fieldsContainer.innerHTML = `
    <div class="form-grid-2" style="margin-bottom: 1rem;">
      <div class="form-group">
        <label style="font-weight: 700; font-size: 0.85rem;">Matrícula *</label>
        <input type="text" id="edit-tec-matricula" class="form-control" value="${escapeHtml(tec.matricula)}" required>
      </div>
      <div class="form-group">
        <label style="font-weight: 700; font-size: 0.85rem;">Função / Cargo *</label>
        <input type="text" id="edit-tec-funcao" class="form-control" value="${escapeHtml(tec.funcao || 'Técnico de Manutenção')}" required>
      </div>
    </div>
    <div class="form-group" style="margin-bottom: 1rem;">
      <label style="font-weight: 700; font-size: 0.85rem;">Nome Completo *</label>
      <input type="text" id="edit-tec-nome" class="form-control" value="${escapeHtml(tec.nome_sobrenome)}" required>
    </div>
    <div class="form-grid-2" style="margin-bottom: 1rem;">
      <div class="form-group">
        <label style="font-weight: 700; font-size: 0.85rem;">E-mail Corporativo</label>
        <input type="email" id="edit-tec-email" class="form-control" value="${escapeHtml(tec.email || '')}" placeholder="ex: nome@tkelevator.com">
      </div>
      <div class="form-group">
        <label style="font-weight: 700; font-size: 0.85rem;">Telefone / Ramal</label>
        <input type="text" id="edit-tec-telefone" class="form-control" value="${escapeHtml(tec.telefone || '')}" placeholder="(11) 98765-4321">
      </div>
    </div>
  `;

  document.getElementById('edit-cadastro-modal').classList.add('active');
}

function openEditClienteModal(numeroContrato) {
  if (!auth.isConsultora(state.user)) {
    showToast('Acesso negado. Apenas a Consultora pode alterar cadastros.', 'error');
    return;
  }

  const cli = state.clientes.find(c => String(c.numero_contrato) === String(numeroContrato));
  if (!cli) {
    showToast('Cliente não encontrado.', 'error');
    return;
  }

  currentEditType = 'cliente';
  currentEditId = cli.numero_contrato;

  document.getElementById('edit-cad-title').innerHTML = `
    <i class="bi bi-buildings-fill" style="color: var(--tke-purple);"></i>
    <span>Alterar Cadastro de Cliente</span>
  `;

  document.getElementById('edit-cad-notice').innerHTML = `
    Editando cliente do contrato <code>${escapeHtml(cli.numero_contrato)}</code>.
  `;

  const fieldsContainer = document.getElementById('edit-cad-dynamic-fields');
  fieldsContainer.innerHTML = `
    <div class="form-group" style="margin-bottom: 1rem;">
      <label style="font-weight: 700; font-size: 0.85rem;">Nº Contrato / Elevador *</label>
      <input type="text" id="edit-cli-contrato" class="form-control" value="${escapeHtml(cli.numero_contrato)}" required>
    </div>
    <div class="form-group" style="margin-bottom: 1rem;">
      <label style="font-weight: 700; font-size: 0.85rem;">Nome do Cliente / Razão Social *</label>
      <input type="text" id="edit-cli-nome" class="form-control" value="${escapeHtml(cli.nome_cliente)}" required>
    </div>
  `;

  document.getElementById('edit-cadastro-modal').classList.add('active');
}

function openEditUsuarioModal(id) {
  if (!auth.isConsultora(state.user)) {
    showToast('Acesso negado. Apenas a Consultora pode alterar colaboradores.', 'error');
    return;
  }

  const user = state.usuarios.find(u => Number(u.id) === Number(id));
  if (!user) {
    showToast('Colaborador não encontrado.', 'error');
    return;
  }

  currentEditType = 'usuario';
  currentEditId = user.id;

  document.getElementById('edit-cad-title').innerHTML = `
    <i class="bi bi-person-badge-fill" style="color: var(--tke-purple);"></i>
    <span>Alterar Cadastro de Colaborador</span>
  `;

  document.getElementById('edit-cad-notice').innerHTML = `
    Editando dados de acesso do colaborador <strong>${escapeHtml(user.nome)}</strong>.
  `;

  const fieldsContainer = document.getElementById('edit-cad-dynamic-fields');
  fieldsContainer.innerHTML = `
    <div class="form-group" style="margin-bottom: 1rem;">
      <label style="font-weight: 700; font-size: 0.85rem;">Nome Completo *</label>
      <input type="text" id="edit-usr-nome" class="form-control" value="${escapeHtml(user.nome)}" required>
    </div>
    <div class="form-grid-2" style="margin-bottom: 1rem;">
      <div class="form-group">
        <label style="font-weight: 700; font-size: 0.85rem;">E-mail Corporativo / Login *</label>
        <input type="email" id="edit-usr-email" class="form-control" value="${escapeHtml(user.email)}" required>
      </div>
      <div class="form-group">
        <label style="font-weight: 700; font-size: 0.85rem;">Matrícula *</label>
        <input type="text" id="edit-usr-matricula" class="form-control" value="${escapeHtml(user.matricula || '')}" required>
      </div>
    </div>
    <div class="form-grid-3" style="margin-bottom: 1rem;">
      <div class="form-group">
        <label style="font-weight: 700; font-size: 0.85rem;">Perfil *</label>
        <select id="edit-usr-perfil" class="form-control" required style="font-weight: 700;">
          <option value="TECNICO" ${user.perfil === 'TECNICO' ? 'selected' : ''}>Técnico</option>
          <option value="SUPERVISOR" ${user.perfil === 'SUPERVISOR' ? 'selected' : ''}>Supervisor</option>
          <option value="CONSULTORA" ${user.perfil === 'CONSULTORA' ? 'selected' : ''}>Consultora (Admin)</option>
        </select>
      </div>
      <div class="form-group">
        <label style="font-weight: 700; font-size: 0.85rem;">Grupo *</label>
        <select id="edit-usr-grupo" class="form-control" required style="font-weight: 700;">
          <option value="G11" ${(user.grupo || 'G11') === 'G11' ? 'selected' : ''}>G11</option>
          <option value="G06" ${user.grupo === 'G06' ? 'selected' : ''}>G06</option>
          <option value="G05" ${user.grupo === 'G05' ? 'selected' : ''}>G05</option>
        </select>
      </div>
      <div class="form-group">
        <label style="font-weight: 700; font-size: 0.85rem;">Status *</label>
        <select id="edit-usr-ativo" class="form-control" required style="font-weight: 700;">
          <option value="1" ${user.ativo ? 'selected' : ''}>Ativo</option>
          <option value="0" ${!user.ativo ? 'selected' : ''}>Inativo</option>
        </select>
      </div>
    </div>
  `;

  document.getElementById('edit-cadastro-modal').classList.add('active');
}

// =====================================================================
// EXPORTAÇÃO CSV (Apenas Consultora e Supervisor)
// =====================================================================
function exportToCSV() {
  if (state.user?.perfil === 'TECNICO') {
    showToast('Acesso negado. Apenas Consultora e Supervisor podem exportar relatórios.', 'error');
    return;
  }

  const items = state.orcamentos;
  if (!items || items.length === 0) {
    showToast('Não há dados para exportar.', 'info');
    return;
  }

  const headers = ['ID', 'Nº PGO', 'G Origem', 'Tipo Servico', 'Contrato', 'Cliente', 'Matricula Tecnico', 'Nome Tecnico', 'Numero Orcamento', 'Descricao Servico', 'Data Liberacao', 'GEOR Liberou', 'Data Envio Cliente', 'Status'];
  const rows = items.map(o => [
    o.id,
    `"${o.numero_pgo}"`,
    `"${o.g_origem || 'G11'}"`,
    `"${o.tipo_servico}"`,
    `"${o.numero_contrato}"`,
    `"${o.nome_cliente.replace(/"/g, '""')}"`,
    `"${o.matricula_tecnico}"`,
    `"${o.nome_tecnico.replace(/"/g, '""')}"`,
    `"${o.numero_orcamento}"`,
    `"${(o.descricao_servico || '').replace(/"/g, '""')}"`,
    `"${o.data_liberacao || ''}"`,
    `"${o.geor_liberou}"`,
    `"${o.data_envio_cliente || ''}"`,
    `"${o.status}"`
  ]);

  const csvContent = '\uFEFF' + [headers.join(';'), ...rows.map(r => r.join(';'))].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `relatorio_orcamentos_${new Date().toISOString().split('T')[0]}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  showToast('Relatório CSV exportado com sucesso!', 'success');
}

function escapeHtml(text) {
  if (!text) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// =====================================================================
// NAVEGAÇÃO DE ABAS PRINCIPAIS (ORÇAMENTOS vs. DASHBOARD vs. USUÁRIOS)
// =====================================================================
function setupMainTabs() {
  const tabBtnOrcamentos = document.getElementById('tab-nav-orcamentos');
  const tabBtnPremiacao = document.getElementById('tab-nav-premiacao');
  const tabBtnUsuarios = document.getElementById('tab-nav-usuarios');

  const viewOrcamentos = document.getElementById('view-orcamentos');
  const viewPremiacao = document.getElementById('view-dashboard-premiacao');
  const viewUsuarios = document.getElementById('view-usuarios');

  const switchTab = (activeTab) => {
    state.activeTab = activeTab;
    if (window.location.hash !== `#${activeTab}`) {
      try {
        history.replaceState(null, '', `#${activeTab}`);
      } catch (e) {}
    }

    if (tabBtnOrcamentos) tabBtnOrcamentos.classList.toggle('active', activeTab === 'orcamentos');
    if (tabBtnPremiacao) tabBtnPremiacao.classList.toggle('active', activeTab === 'premiacao');
    if (tabBtnUsuarios) tabBtnUsuarios.classList.toggle('active', activeTab === 'usuarios');

    if (viewOrcamentos) viewOrcamentos.style.display = activeTab === 'orcamentos' ? 'block' : 'none';
    if (viewPremiacao) viewPremiacao.style.display = activeTab === 'premiacao' ? 'block' : 'none';
    if (viewUsuarios) viewUsuarios.style.display = activeTab === 'usuarios' ? 'block' : 'none';
  };

  if (tabBtnOrcamentos) {
    tabBtnOrcamentos.addEventListener('click', async (e) => {
      e.preventDefault();
      switchTab('orcamentos');
      await loadOrcamentos();
    });
  }

  if (tabBtnPremiacao) {
    tabBtnPremiacao.addEventListener('click', async (e) => {
      e.preventDefault();
      switchTab('premiacao');
      await loadDashboardPremiacao();
    });
  }

  if (tabBtnUsuarios) {
    tabBtnUsuarios.addEventListener('click', async (e) => {
      e.preventDefault();
      switchTab('usuarios');
      await loadUsuarios();
    });
  }

  // Verifica se a URL solicita abertura direta de uma aba (#acesso, #usuarios, #premiacao)
  const urlParams = new URLSearchParams(window.location.search);
  const requestedTab = (urlParams.get('tab') || window.location.hash.replace('#', '')).toLowerCase();
  if (requestedTab === 'acesso' || requestedTab === 'usuarios') {
    switchTab('usuarios');
    loadUsuarios();
  } else if (requestedTab === 'premiacao' || requestedTab === 'resultado') {
    switchTab('premiacao');
    loadDashboardPremiacao();
  }

  // Setup dos Controles do Dashboard de Premiação
  setupPremiacaoEventListeners();
}

// =====================================================================
// SINCRONIZAÇÃO EM TEMPO REAL ENTRE PERFIS (LIVE SYNC & AUTO-REFRESH)
// =====================================================================
let syncInProgress = false;
async function syncAllData(isSilent = false) {
  if (syncInProgress) return;
  syncInProgress = true;

  const syncIcon = document.getElementById('icon-sync-data');
  if (syncIcon) syncIcon.classList.add('spin');

  try {
    if (state.activeTab === 'premiacao') {
      await loadDashboardPremiacao();
    } else if (state.activeTab === 'usuarios') {
      await loadUsuarios();
    } else {
      await loadOrcamentos();
    }

    // Atualiza base de clientes e técnicos em segundo plano
    await Promise.allSettled([
      loadClientes(),
      loadTecnicos()
    ]);

    if (!isSilent) {
      showToast('Dados sincronizados com o servidor!', 'success');
    }
  } catch (err) {
    if (!isSilent) {
      showToast(`Erro na sincronização: ${err.message}`, 'error');
    }
  } finally {
    if (syncIcon) syncIcon.classList.remove('spin');
    syncInProgress = false;
  }
}

function setupAutoSync() {
  // 1. Botão manual de sincronização
  const btnSync = document.getElementById('btn-sync-data');
  if (btnSync) {
    btnSync.addEventListener('click', () => syncAllData(false));
  }

  // 2. Sincronização ao focar a aba/janela do navegador
  window.addEventListener('focus', () => syncAllData(true));
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      syncAllData(true);
    }
  });

  // 3. Polling em segundo plano a cada 5 segundos para sincronização contínua
  setInterval(() => {
    if (document.visibilityState === 'visible' && !document.querySelector('.modal-backdrop.active')) {
      syncAllData(true);
    }
  }, 5000);
}

// =====================================================================
// MÓDULO DE DASHBOARD & APURAÇÃO PARA PREMIAÇÃO
// =====================================================================
function setupPremiacaoEventListeners() {
  const selectCiclo = document.getElementById('prem-select-ciclo');
  const selectMes = document.getElementById('prem-select-mes');
  const selectG = document.getElementById('prem-select-g');
  const btnFiltrar = document.getElementById('btn-prem-filtrar');
  const btnRefresh = document.getElementById('btn-refresh-premiacao');
  const btnExportExcel = document.getElementById('btn-export-excel-prem');

  if (btnFiltrar) {
    btnFiltrar.addEventListener('click', () => {
      state.premiacao.ciclo = selectCiclo.value;
      state.premiacao.mes = selectMes.value;
      state.premiacao.g_origem = selectG.value;
      loadDashboardPremiacao();
    });
  }

  if (selectCiclo) {
    selectCiclo.addEventListener('change', () => {
      state.premiacao.ciclo = selectCiclo.value;
      loadDashboardPremiacao();
    });
  }

  if (selectMes) {
    selectMes.addEventListener('change', () => {
      state.premiacao.mes = selectMes.value;
      loadDashboardPremiacao();
    });
  }

  if (selectG) {
    selectG.addEventListener('change', () => {
      state.premiacao.g_origem = selectG.value;
      loadDashboardPremiacao();
    });
  }

  if (btnRefresh) {
    btnRefresh.addEventListener('click', () => {
      loadDashboardPremiacao();
      showToast('Dados de premiação atualizados.', 'info');
    });
  }

  if (btnExportExcel) {
    btnExportExcel.addEventListener('click', () => {
      if (state.user?.perfil === 'TECNICO') {
        showToast('Acesso negado. Apenas Consultora e Supervisor podem exportar planilhas.', 'error');
        return;
      }
      const ciclo = encodeURIComponent(state.premiacao.ciclo || '2025/2026');
      const mes = encodeURIComponent(state.premiacao.mes || 'acumulado');
      const g = encodeURIComponent(state.premiacao.g_origem || '');
      
      showToast('Gerando planilha de premiação...', 'info');
      window.location.href = `/api/relatorios/premiacao/export?ciclo=${ciclo}&mes=${mes}&g_origem=${g}`;
    });
  }
}

async function loadDashboardPremiacao() {
  try {
    const ciclo = state.premiacao.ciclo || '2025/2026';
    const mes = state.premiacao.mes || 'acumulado';
    const g_origem = state.premiacao.g_origem || '';

    let url = `/api/relatorios/premiacao?ciclo=${encodeURIComponent(ciclo)}&mes=${encodeURIComponent(mes)}`;
    if (g_origem) {
      url += `&g_origem=${encodeURIComponent(g_origem)}`;
    }

    const res = await api.get(url);
    if (res && res.success) {
      state.premiacao.data = res;
      renderDashboardPremiacao(res);
    }
  } catch (error) {
    console.error('❌ [Dashboard Premiação] Erro ao carregar apuração:', error);
    showToast('Erro ao carregar dados de apuração para premiação.', 'error');
  }
}

function renderDashboardPremiacao(res) {
  const { periodo, kpis, ranking_preventivo, ranking_corretivo } = res;

  // 1. Atualiza Badge do Período
  const periodoBadgeText = document.getElementById('prem-periodo-texto');
  if (periodoBadgeText) {
    periodoBadgeText.textContent = periodo.descricaoPeriodo || `${periodo.ciclo} (${periodo.dataInicio} a ${periodo.dataFim})`;
  }

  // 2. Atualiza Cards de KPIs
  const elTotalQtd = document.getElementById('prem-kpi-total-qtd');
  const elTotalVal = document.getElementById('prem-kpi-total-valor');
  const elPrevQtd = document.getElementById('prem-kpi-prev-qtd');
  const elPrevVal = document.getElementById('prem-kpi-prev-valor');
  const elCorrQtd = document.getElementById('prem-kpi-corr-qtd');
  const elCorrVal = document.getElementById('prem-kpi-corr-valor');
  const elTecAtivos = document.getElementById('prem-kpi-tecnicos-ativos');
  const elTaxaPart = document.getElementById('prem-kpi-taxa-part');

  if (elTotalQtd) elTotalQtd.textContent = `${kpis.total_geral_qtd} ${kpis.total_geral_qtd === 1 ? 'PGO' : 'PGOs'}`;
  if (elTotalVal) elTotalVal.textContent = formatCurrency(kpis.total_geral_valor);

  if (elPrevQtd) elPrevQtd.textContent = `${kpis.total_preventivo_qtd} ${kpis.total_preventivo_qtd === 1 ? 'PGO' : 'PGOs'}`;
  if (elPrevVal) elPrevVal.textContent = formatCurrency(kpis.total_preventivo_valor);

  if (elCorrQtd) elCorrQtd.textContent = `${kpis.total_corretivo_qtd} ${kpis.total_corretivo_qtd === 1 ? 'PGO' : 'PGOs'}`;
  if (elCorrVal) elCorrVal.textContent = formatCurrency(kpis.total_corretivo_valor);

  if (elTecAtivos) elTecAtivos.textContent = `${kpis.total_tecnicos_ativos} / ${kpis.total_tecnicos_cadastrados}`;
  if (elTaxaPart) elTaxaPart.textContent = `${kpis.taxa_participacao}% com orçamentos aprovados`;

  // 3. Renderiza Tabela Parte 1: Ranking Preventivo (Hierarquia em 2 Camadas)
  const tbodyPrev = document.getElementById('tbody-ranking-preventivo');
  if (tbodyPrev) {
    if (!ranking_preventivo || ranking_preventivo.length === 0) {
      tbodyPrev.innerHTML = `
        <tr>
          <td colspan="6" style="text-align: center; padding: 2rem; color: var(--text-muted);">
            Nenhum técnico cadastrado na base.
          </td>
        </tr>
      `;
    } else {
      tbodyPrev.innerHTML = ranking_preventivo.map((t, idx) => {
        const pos = idx + 1;
        let podiumClass = 'podium-rest';
        let podiumIcon = `${pos}º`;
        if (pos === 1) { podiumClass = 'podium-1'; podiumIcon = '🥇'; }
        else if (pos === 2) { podiumClass = 'podium-2'; podiumIcon = '🥈'; }
        else if (pos === 3) { podiumClass = 'podium-3'; podiumIcon = '🥉'; }

        const isZero = t.qtd_aprovados === 0;
        const atingiuMeta = t.atingiu_meta || t.qtd_aprovados >= 7;
        let rowClass = '';
        if (atingiuMeta) rowClass = 'row-meta-atingida';
        else if (isZero) rowClass = 'row-zero-vendas';

        const badgeStatusClass = atingiuMeta ? 'badge-meta-atingida' : 'badge-abaixo-meta';
        const badgeStatusIcon = atingiuMeta ? 'bi-bullseye' : 'bi-hourglass-split';
        const badgeStatusText = atingiuMeta ? 'Meta Atingida (≥ 7)' : 'Abaixo da Meta (< 7)';

        return `
          <tr class="${rowClass}">
            <td style="text-align: center;">
              <span class="podium-badge ${podiumClass}" title="${pos}º Lugar">${podiumIcon}</span>
            </td>
            <td>
              <div style="display: flex; align-items: center;">
                <span class="tecnico-row-avatar">${escapeHtml((t.nome_tecnico || 'T').charAt(0).toUpperCase())}</span>
                <div>
                  <div style="font-weight: 700; color: var(--text-primary); font-size: 0.88rem;">${escapeHtml(t.nome_tecnico)}</div>
                  <div style="font-size: 0.72rem; color: var(--text-muted);">Mat: ${escapeHtml(t.matricula)} • ${escapeHtml(t.funcao || 'Técnico de Manutenção')}</div>
                </div>
              </div>
            </td>
            <td style="text-align: center;">
              <span class="badge-tag badge-grupo">${escapeHtml(t.grupo || 'G11')}</span>
            </td>
            <td style="text-align: center; font-weight: 800; font-size: 0.95rem; color: ${atingiuMeta ? '#059669' : (isZero ? 'var(--text-muted)' : '#10B981')};">
              ${t.qtd_aprovados}
            </td>
            <td style="text-align: right; font-weight: 800; font-size: 0.92rem; color: ${atingiuMeta ? '#059669' : (isZero ? 'var(--text-muted)' : '#10B981')};">
              ${formatCurrency(t.valor_total)}
            </td>
            <td style="text-align: center;">
              <span class="badge-tag ${badgeStatusClass}" style="font-size: 0.72rem;">
                <i class="bi ${badgeStatusIcon}"></i> ${badgeStatusText}
              </span>
            </td>
          </tr>
        `;
      }).join('');
    }
  }

  // Totalizadores no Footer do Ranking Preventivo
  const tfootPrevQtd = document.getElementById('tfoot-prev-qtd');
  const tfootPrevVal = document.getElementById('tfoot-prev-valor');
  if (tfootPrevQtd) tfootPrevQtd.textContent = kpis.total_preventivo_qtd;
  if (tfootPrevVal) tfootPrevVal.textContent = formatCurrency(kpis.total_preventivo_valor);

  // 4. Renderiza Tabela Parte 2: Ranking Corretivo (Hierarquia em 2 Camadas)
  const tbodyCorr = document.getElementById('tbody-ranking-corretivo');
  if (tbodyCorr) {
    if (!ranking_corretivo || ranking_corretivo.length === 0) {
      tbodyCorr.innerHTML = `
        <tr>
          <td colspan="6" style="text-align: center; padding: 2rem; color: var(--text-muted);">
            Nenhum técnico cadastrado na base.
          </td>
        </tr>
      `;
    } else {
      tbodyCorr.innerHTML = ranking_corretivo.map((t, idx) => {
        const pos = idx + 1;
        let podiumClass = 'podium-rest';
        let podiumIcon = `${pos}º`;
        if (pos === 1) { podiumClass = 'podium-1'; podiumIcon = '🥇'; }
        else if (pos === 2) { podiumClass = 'podium-2'; podiumIcon = '🥈'; }
        else if (pos === 3) { podiumClass = 'podium-3'; podiumIcon = '🥉'; }

        const isZero = t.qtd_aprovados === 0;
        const atingiuMeta = t.atingiu_meta || t.qtd_aprovados >= 7;
        let rowClass = '';
        if (atingiuMeta) rowClass = 'row-meta-atingida';
        else if (isZero) rowClass = 'row-zero-vendas';

        const badgeStatusClass = atingiuMeta ? 'badge-meta-atingida' : 'badge-abaixo-meta';
        const badgeStatusIcon = atingiuMeta ? 'bi-bullseye' : 'bi-hourglass-split';
        const badgeStatusText = atingiuMeta ? 'Meta Atingida (≥ 7)' : 'Abaixo da Meta (< 7)';

        return `
          <tr class="${rowClass}">
            <td style="text-align: center;">
              <span class="podium-badge ${podiumClass}" title="${pos}º Lugar">${podiumIcon}</span>
            </td>
            <td>
              <div style="display: flex; align-items: center;">
                <span class="tecnico-row-avatar" style="background: rgba(255, 85, 0, 0.1); color: var(--tke-orange);">${escapeHtml((t.nome_tecnico || 'T').charAt(0).toUpperCase())}</span>
                <div>
                  <div style="font-weight: 700; color: var(--text-primary); font-size: 0.88rem;">${escapeHtml(t.nome_tecnico)}</div>
                  <div style="font-size: 0.72rem; color: var(--text-muted);">Mat: ${escapeHtml(t.matricula)} • ${escapeHtml(t.funcao || 'Técnico de Manutenção')}</div>
                </div>
              </div>
            </td>
            <td style="text-align: center;">
              <span class="badge-tag badge-grupo">${escapeHtml(t.grupo || 'G11')}</span>
            </td>
            <td style="text-align: center; font-weight: 800; font-size: 0.95rem; color: ${atingiuMeta ? '#059669' : (isZero ? 'var(--text-muted)' : 'var(--tke-orange)')};">
              ${t.qtd_aprovados}
            </td>
            <td style="text-align: right; font-weight: 800; font-size: 0.92rem; color: ${atingiuMeta ? '#059669' : (isZero ? 'var(--text-muted)' : 'var(--tke-orange)')};">
              ${formatCurrency(t.valor_total)}
            </td>
            <td style="text-align: center;">
              <span class="badge-tag ${badgeStatusClass}" style="font-size: 0.72rem;">
                <i class="bi ${badgeStatusIcon}"></i> ${badgeStatusText}
              </span>
            </td>
          </tr>
        `;
      }).join('');
    }
  }

  // Totalizadores no Footer do Ranking Corretivo
  const tfootCorrQtd = document.getElementById('tfoot-corr-qtd');
  const tfootCorrVal = document.getElementById('tfoot-corr-valor');
  if (tfootCorrQtd) tfootCorrQtd.textContent = kpis.total_corretivo_qtd;
  if (tfootCorrVal) tfootCorrVal.textContent = formatCurrency(kpis.total_corretivo_valor);
}

// =====================================================================
// MÓDULO DE GESTÃO DE USUÁRIOS & ACESSOS (EXCLUSIVO CONSULTORA)
// =====================================================================
async function loadUsuarios() {
  const tbody = document.getElementById('tbody-usuarios-list');
  if (!tbody) return;

  try {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" style="text-align: center; padding: 2rem; color: var(--text-muted);">
          <i class="bi bi-arrow-repeat spin"></i> Carregando colaboradores...
        </td>
      </tr>
    `;

    const res = await api.get('/api/usuarios');
    state.usuarios = res.data || [];
    renderUsuariosTable();
  } catch (err) {
    console.error('Erro ao carregar usuários:', err);
    tbody.innerHTML = `
      <tr>
        <td colspan="8" style="text-align: center; color: #ef4444; padding: 2rem;">
          <i class="bi bi-exclamation-octagon-fill"></i> Falha ao carregar colaboradores: ${err.message}
        </td>
      </tr>
    `;
  }
}

function renderUsuariosTable() {
  const tbody = document.getElementById('tbody-usuarios-list');
  if (!tbody) return;

  const rawUsers = state.usuarios || [];
  const { q, perfil, grupo, status } = state.userFilters || {};
  const query = (q || '').trim().toLowerCase();

  const users = rawUsers.filter((u) => {
    if (query) {
      const matchNome = (u.nome || '').toLowerCase().includes(query);
      const matchEmail = (u.email || '').toLowerCase().includes(query);
      const matchMatricula = (u.matricula || '').toLowerCase().includes(query);
      const matchPerfil = (u.perfil || '').toLowerCase().includes(query);
      const matchGrupo = (u.grupo || '').toLowerCase().includes(query);
      if (!matchNome && !matchEmail && !matchMatricula && !matchPerfil && !matchGrupo) {
        return false;
      }
    }

    if (perfil && u.perfil !== perfil) {
      return false;
    }

    if (grupo && (u.grupo || 'G11') !== grupo) {
      return false;
    }

    if (status) {
      if (status === 'ativo' && !u.ativo) return false;
      if (status === 'inativo' && u.ativo) return false;
      if (status === 'pendente' && !u.primeiro_acesso) return false;
      if (status === 'concluido' && u.primeiro_acesso) return false;
    }

    return true;
  });

  const badgeCount = document.getElementById('badge-usuarios-count');
  if (badgeCount) {
    if (query || perfil || grupo || status) {
      badgeCount.textContent = `${users.length} de ${rawUsers.length} Colaboradores`;
    } else {
      badgeCount.textContent = `${rawUsers.length} Colaboradores`;
    }
  }

  if (users.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" style="text-align: center; padding: 3rem; color: var(--text-muted);">
          <i class="bi bi-search" style="font-size: 2rem; display: block; margin-bottom: 0.5rem; color: var(--tke-purple);"></i>
          ${rawUsers.length === 0 ? 'Nenhum colaborador cadastrado.' : 'Nenhum colaborador encontrado para os filtros selecionados.'}
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = users.map((u) => {
    let roleClass = 'role-tecnico';
    let roleLabel = 'Técnico';
    if (u.perfil === 'CONSULTORA') {
      roleClass = 'role-consultora';
      roleLabel = 'Consultora (Admin)';
    } else if (u.perfil === 'SUPERVISOR') {
      roleClass = 'role-supervisor';
      roleLabel = 'Supervisor';
    }

    const isPrimeiroAcesso = Boolean(u.primeiro_acesso);
    const isAtivo = Boolean(u.ativo);

    const firstAccessBadge = isPrimeiroAcesso 
      ? '<span class="badge-tag" style="background: rgba(239, 68, 68, 0.1); color: #DC2626; border: 1px solid rgba(239, 68, 68, 0.2); font-weight: 700;"><i class="bi bi-clock-history"></i> Pendente</span>'
      : '<span class="badge-tag badge-pill-yes" style="font-weight: 700;"><i class="bi bi-check-circle-fill"></i> Concluído</span>';

    const statusBadge = isAtivo
      ? '<span class="badge-tag badge-pill-yes">Ativo</span>'
      : '<span class="badge-tag badge-pill-no">Inativo</span>';

    const isCurrentLoggedInUser = state.user?.id === u.id;

    return `
      <tr style="${!isAtivo ? 'opacity: 0.6; background: rgba(0,0,0,0.02);' : ''}">
        <td>
          <div>
            <div style="font-weight: 700; color: var(--text-primary); font-size: 0.88rem;">${escapeHtml(u.nome)}</div>
            ${isCurrentLoggedInUser ? '<span style="font-size: 0.72rem; color: var(--tke-purple); font-weight: 700;">(Você)</span>' : ''}
          </div>
        </td>
        <td style="font-weight: 600; color: var(--text-secondary); font-size: 0.85rem;">
          ${escapeHtml(u.email)}
        </td>
        <td style="font-family: monospace; font-weight: 700; color: var(--text-primary); font-size: 0.85rem;">
          ${escapeHtml(u.matricula || '-')}
        </td>
        <td style="text-align: center;">
          <span class="badge-tag ${roleClass}" style="font-size: 0.75rem;">${roleLabel}</span>
        </td>
        <td style="text-align: center;">
          ${auth.isConsultora(state.user) ? `
            <select 
              class="user-inline-grupo-select" 
              data-id="${u.id}" 
              data-name="${escapeHtml(u.nome)}"
              title="Clique para alterar o Grupo / Nível instantaneamente (Exclusivo Consultora)"
              style="cursor: pointer; border: 1.5px solid rgba(98, 0, 234, 0.35); padding: 0.2rem 0.45rem; font-weight: 800; font-size: 0.78rem; background: rgba(98, 0, 234, 0.08); color: var(--tke-purple); outline: none; border-radius: 8px; transition: all 0.2s ease;"
            >
              <option value="G11" ${(u.grupo || 'G11') === 'G11' ? 'selected' : ''}>G11</option>
              <option value="G06" ${u.grupo === 'G06' ? 'selected' : ''}>G06</option>
              <option value="G05" ${u.grupo === 'G05' ? 'selected' : ''}>G05</option>
            </select>
          ` : `
            <span class="badge-tag badge-grupo">${escapeHtml(u.grupo || 'G11')}</span>
          `}
        </td>
        <td style="text-align: center;">
          ${firstAccessBadge}
        </td>
        <td style="text-align: center;">
          ${statusBadge}
        </td>
        <td style="text-align: center; white-space: nowrap;">
          <div style="display: flex; gap: 0.4rem; justify-content: center;">
            <button 
              type="button" 
              class="btn btn-secondary btn-sm btn-edit-user" 
              data-id="${u.id}" 
              title="Alterar Cadastro de Colaborador (Exclusivo Consultora)"
              style="padding: 0.25rem 0.55rem; font-size: 0.75rem;"
            >
              <i class="bi bi-pencil-square" style="color: var(--tke-purple);"></i>
              <span>Editar</span>
            </button>
            <button 
              type="button" 
              class="btn btn-secondary btn-sm btn-reset-user-pass" 
              data-id="${u.id}" 
              data-name="${escapeHtml(u.nome)}"
              title="Resetar senha para padrão (Tke@1234) e exigir 1º Acesso"
              style="padding: 0.25rem 0.55rem; font-size: 0.75rem;"
            >
              <i class="bi bi-key-fill" style="color: var(--tke-purple);"></i>
              <span>Resetar Senha</span>
            </button>
            ${!isCurrentLoggedInUser ? `
              <button 
                type="button" 
                class="btn btn-secondary btn-sm btn-toggle-user-status" 
                data-id="${u.id}" 
                data-ativo="${isAtivo ? '1' : '0'}"
                data-name="${escapeHtml(u.nome)}"
                title="${isAtivo ? 'Desativar usuário' : 'Ativar usuário'}"
                style="padding: 0.25rem 0.55rem; font-size: 0.75rem; color: ${isAtivo ? '#D97706' : '#10B981'};"
              >
                <i class="bi ${isAtivo ? 'bi-person-x-fill' : 'bi-person-check-fill'}"></i>
                <span>${isAtivo ? 'Desativar' : 'Ativar'}</span>
              </button>
              <button 
                type="button" 
                class="btn btn-secondary btn-sm btn-delete-user" 
                data-id="${u.id}" 
                data-name="${escapeHtml(u.nome)}"
                title="Excluir Colaborador permanentemente"
                style="padding: 0.25rem 0.55rem; font-size: 0.75rem; color: #EF4444;"
              >
                <i class="bi bi-trash3-fill"></i>
                <span>Excluir</span>
              </button>
            ` : ''}
          </div>
        </td>
      </tr>
    `;
  }).join('');

  // Ações nos botões da tabela de usuários
  document.querySelectorAll('.user-inline-grupo-select').forEach(sel => {
    sel.addEventListener('change', async (e) => {
      const id = sel.getAttribute('data-id');
      const name = sel.getAttribute('data-name');
      const newGrupo = e.target.value;

      try {
        const res = await api.patch(`/api/usuarios/${id}/grupo`, { grupo: newGrupo });
        showToast(res.message || `Grupo de ${name} alterado para ${newGrupo}!`, 'success');
        
        const userObj = state.usuarios.find(u => Number(u.id) === Number(id));
        if (userObj) userObj.grupo = newGrupo;

        // Atualiza também os dados de técnicos e premiação automaticamente
        await loadTecnicos();
        await loadDashboardPremiacao();
      } catch (err) {
        showToast(`Erro ao alterar grupo: ${err.message}`, 'error');
        await loadUsuarios();
      }
    });
  });

  document.querySelectorAll('.btn-edit-user').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-id');
      openEditUsuarioModal(id);
    });
  });

  document.querySelectorAll('.btn-reset-user-pass').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.getAttribute('data-id');
      const name = btn.getAttribute('data-name');
      if (confirm(`Confirma o reset de senha para o colaborador ${name}?\n\nA senha provisória será definida como 'Tke@1234' e a flag de Primeiro Acesso Obrigatório será reativada.`)) {
        try {
          const res = await api.patch(`/api/usuarios/${id}/reset-password`);
          showToast(res.message || 'Senha resetada para Tke@1234 com sucesso!', 'success');
          await loadUsuarios();
        } catch (err) {
          showToast(`Erro ao resetar senha: ${err.message}`, 'error');
        }
      }
    });
  });

  document.querySelectorAll('.btn-toggle-user-status').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.getAttribute('data-id');
      const currentAtivo = btn.getAttribute('data-ativo') === '1';
      const name = btn.getAttribute('data-name');
      const action = currentAtivo ? 'desativar' : 'ativar';

      if (confirm(`Deseja realmente ${action} o acesso de ${name}?`)) {
        try {
          const res = await api.patch(`/api/usuarios/${id}/toggle-status`, { ativo: !currentAtivo });
          showToast(res.message || `Usuário ${action}do com sucesso!`, 'success');
          await loadUsuarios();
        } catch (err) {
          showToast(`Erro: ${err.message}`, 'error');
        }
      }
    });
  });

  document.querySelectorAll('.btn-delete-user').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.getAttribute('data-id');
      const name = btn.getAttribute('data-name');

      if (confirm(`⚠️ ATENÇÃO: Tem certeza que deseja EXCLUIR permanentemente o colaborador "${name}"?\n\nEsta ação removerá o acesso do usuário ao sistema.`)) {
        try {
          const res = await api.delete(`/api/usuarios/${id}`);
          showToast(res.message || 'Colaborador excluído com sucesso!', 'success');
          await loadUsuarios();
        } catch (err) {
          showToast(`Erro ao excluir colaborador: ${err.message}`, 'error');
        }
      }
    });
  });
}

function setupUsuariosEventListeners() {
  const modal = document.getElementById('usuario-modal');
  const btnOpen = document.getElementById('btn-open-new-user');
  const btnClose = document.getElementById('user-modal-close-btn');
  const btnCancel = document.getElementById('user-modal-cancel-btn');
  const btnGenPass = document.getElementById('btn-generate-default-pass');
  const form = document.getElementById('usuario-form');
  const btnRefresh = document.getElementById('btn-refresh-usuarios');

  // Setup do Módulo de Importação de Usuários (.xlsx / .csv)
  setupInlineUploader({
    type: 'usr',
    endpoint: '/api/usuarios/import',
    refreshFn: async () => {
      await loadUsuarios();
      await loadTecnicos();
    }
  });

  if (btnOpen && modal) {
    btnOpen.addEventListener('click', () => {
      if (form) form.reset();
      const inputSenha = document.getElementById('user-form-senha');
      if (inputSenha) inputSenha.value = 'Tke@1234';
      modal.classList.add('active');
    });
  }

  const closeUserModal = () => {
    if (modal) modal.classList.remove('active');
  };

  if (btnClose) btnClose.addEventListener('click', closeUserModal);
  if (btnCancel) btnCancel.addEventListener('click', closeUserModal);

  if (btnGenPass) {
    btnGenPass.addEventListener('click', () => {
      const inputSenha = document.getElementById('user-form-senha');
      if (inputSenha) {
        inputSenha.value = 'Tke@1234';
        showToast('Senha padrão definida como Tke@1234', 'info');
      }
    });
  }

  if (btnRefresh) {
    btnRefresh.addEventListener('click', async () => {
      await loadUsuarios();
      showToast('Lista de colaboradores atualizada.', 'info');
    });
  }

  // Eventos de Busca Rápida e Filtros de Colaboradores
  const searchInputUsr = document.getElementById('filter-search-usr');
  const perfilSelectUsr = document.getElementById('filter-perfil-usr');
  const grupoSelectUsr = document.getElementById('filter-grupo-usr');
  const statusSelectUsr = document.getElementById('filter-status-usr');
  const btnClearFiltersUsr = document.getElementById('btn-clear-filters-usr');

  if (searchInputUsr) {
    searchInputUsr.addEventListener('input', (e) => {
      state.userFilters.q = e.target.value;
      renderUsuariosTable();
    });
  }

  if (perfilSelectUsr) {
    perfilSelectUsr.addEventListener('change', (e) => {
      state.userFilters.perfil = e.target.value;
      renderUsuariosTable();
    });
  }

  if (grupoSelectUsr) {
    grupoSelectUsr.addEventListener('change', (e) => {
      state.userFilters.grupo = e.target.value;
      renderUsuariosTable();
    });
  }

  if (statusSelectUsr) {
    statusSelectUsr.addEventListener('change', (e) => {
      state.userFilters.status = e.target.value;
      renderUsuariosTable();
    });
  }

  if (btnClearFiltersUsr) {
    btnClearFiltersUsr.addEventListener('click', () => {
      state.userFilters = { q: '', perfil: '', grupo: '', status: '' };
      if (searchInputUsr) searchInputUsr.value = '';
      if (perfilSelectUsr) perfilSelectUsr.value = '';
      if (grupoSelectUsr) grupoSelectUsr.value = '';
      if (statusSelectUsr) statusSelectUsr.value = '';
      renderUsuariosTable();
      showToast('Filtros de colaboradores resetados.', 'info');
    });
  }

  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      const btnSave = document.getElementById('user-modal-save-btn');
      btnSave.disabled = true;
      btnSave.innerHTML = '<i class="bi bi-arrow-repeat spin"></i> Salvando...';

      try {
        const payload = {
          nome: document.getElementById('user-form-nome').value.trim(),
          email: document.getElementById('user-form-email').value.trim(),
          matricula: document.getElementById('user-form-matricula').value.trim() || undefined,
          perfil: document.getElementById('user-form-perfil').value,
          grupo: document.getElementById('user-form-grupo').value,
          senha_padrao: document.getElementById('user-form-senha').value.trim()
        };

        const res = await api.post('/api/usuarios', payload);
        showToast(res.message || 'Colaborador cadastrado com sucesso!', 'success');
        closeUserModal();

        await loadUsuarios();
        await loadTecnicos(); // Recarrega lista de técnicos de apoio caso tenha sido cadastrado perfil TECNICO
        await loadDashboardPremiacao();
      } catch (err) {
        showToast(`Erro ao cadastrar: ${err.message}`, 'error');
      } finally {
        btnSave.disabled = false;
        btnSave.innerHTML = '<i class="bi bi-check2-circle"></i> <span>Salvar e Cadastrar</span>';
      }
    });
  }
}

// =====================================================================
// FORMULÁRIO DE PRIMEIRO ACESSO (INTERCEPTAÇÃO NO DASHBOARD)
// =====================================================================
function setupDashboardFirstAccessListener() {
  const dashForm = document.getElementById('dash-first-access-form');
  const dashModal = document.getElementById('dashboard-primeiro-acesso-modal');
  const errorAlert = document.getElementById('dash-first-access-error-alert');
  const errorMsg = document.getElementById('dash-first-access-error-msg');
  const submitBtn = document.getElementById('dash-btn-submit-first-access');

  if (!dashForm) return;

  dashForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    if (errorAlert) errorAlert.style.display = 'none';

    const novaSenha = document.getElementById('dash-nova-senha').value;
    const confirmarNovaSenha = document.getElementById('dash-confirmar-nova-senha').value;

    if (!novaSenha || !confirmarNovaSenha) {
      if (errorAlert && errorMsg) {
        errorMsg.textContent = 'Por favor, preencha ambos os campos de senha.';
        errorAlert.style.display = 'block';
      }
      return;
    }

    if (novaSenha !== confirmarNovaSenha) {
      if (errorAlert && errorMsg) {
        errorMsg.textContent = 'A nova senha e a confirmação não coincidem.';
        errorAlert.style.display = 'block';
      }
      return;
    }

    if (novaSenha.length < 6) {
      if (errorAlert && errorMsg) {
        errorMsg.textContent = 'A nova senha deve ter no mínimo 6 caracteres.';
        errorAlert.style.display = 'block';
      }
      return;
    }

    if (!/[A-Za-z]/.test(novaSenha) || !/[0-9]/.test(novaSenha)) {
      if (errorAlert && errorMsg) {
        errorMsg.textContent = 'A senha deve conter ao menos uma letra e um número.';
        errorAlert.style.display = 'block';
      }
      return;
    }

    if (novaSenha === 'Tke@1234') {
      if (errorAlert && errorMsg) {
        errorMsg.textContent = 'A nova senha não pode ser idêntica à senha padrão.';
        errorAlert.style.display = 'block';
      }
      return;
    }

    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="bi bi-arrow-repeat spin"></i> Salvando nova senha...';

    try {
      const res = await auth.redefinirPrimeiroAcesso(novaSenha, confirmarNovaSenha);
      showToast('Senha atualizada com sucesso! Acesso liberado.', 'success');
      
      // Atualiza o estado da sessão local
      state.user.primeiro_acesso = false;

      if (dashModal) {
        dashModal.classList.remove('active');
      }
    } catch (err) {
      if (errorAlert && errorMsg) {
        errorMsg.textContent = err.message || 'Erro ao redefinir senha.';
        errorAlert.style.display = 'block';
      }
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerHTML = '<span>Salvar Nova Senha e Concluir Acesso</span>';
    }
  });
}


