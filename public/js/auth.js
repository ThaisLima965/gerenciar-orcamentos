import { api } from './api.js';

export const auth = {
  // Retorna usuário salvo localmente
  getUser() {
    try {
      const data = localStorage.getItem('user_data');
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  },

  // Verifica sessão ativa no backend
  async checkSession() {
    try {
      const res = await api.get('/api/auth/me');
      if (res.success && res.user) {
        localStorage.setItem('user_data', JSON.stringify(res.user));
        return res.user;
      }
      return null;
    } catch {
      localStorage.removeItem('user_data');
      return null;
    }
  },

  // Efetua login seguro
  async login(identificador, senha) {
    const res = await api.post('/api/auth/login', { identificador, senha });
    if (res.success && res.user) {
      localStorage.setItem('user_data', JSON.stringify(res.user));
      if (res.csrfToken) {
        localStorage.setItem('csrf_token', res.csrfToken);
      }
      return {
        user: res.user,
        primeiro_acesso: Boolean(res.primeiro_acesso || res.user.primeiro_acesso)
      };
    }
    throw new Error(res.error || 'Falha na autenticação');
  },

  // Redefinição obrigatória de senha no Primeiro Acesso
  async redefinirPrimeiroAcesso(nova_senha, confirmar_nova_senha, identificador = null, senha_atual = null) {
    const res = await api.post('/api/auth/primeiro-acesso', {
      nova_senha,
      confirmar_nova_senha,
      identificador,
      senha_atual
    });
    if (res.success && res.user) {
      localStorage.setItem('user_data', JSON.stringify(res.user));
      return res;
    }
    throw new Error(res.error || 'Falha ao redefinir senha.');
  },

  // Recuperação de acesso via SMS (Solicita código OTP de 6 dígitos)
  async forgotPassword(identificador) {
    const res = await api.post('/api/auth/forgot-password', { identificador });
    if (res.success) {
      return res;
    }
    throw new Error(res.error || 'Falha ao solicitar código de verificação via SMS.');
  },

  // Validação do Token de 6 Dígitos recebido por SMS
  async verifyToken(identificador, token) {
    const res = await api.post('/api/auth/verify-token', { identificador, token });
    if (res.success) {
      return res;
    }
    const err = new Error(res.error || 'Código de verificação incorreto ou expirado.');
    err.attempts_remaining = res.attempts_remaining;
    throw err;
  },

  // Redefinição efetiva da senha (com reset_ticket JWT ou token)
  async resetPassword(args, maybeNovaSenha, maybeConfirmar) {
    let payload = {};
    if (typeof args === 'object' && args !== null) {
      payload = args;
    } else {
      payload = {
        token: args,
        nova_senha: maybeNovaSenha,
        confirmar_nova_senha: maybeConfirmar
      };
    }
    const res = await api.post('/api/auth/reset-password', payload);
    if (res.success) {
      return res;
    }
    throw new Error(res.error || 'Falha ao redefinir a nova senha.');
  },

  // Validação legada de link de e-mail
  async validateResetToken(token) {
    const res = await api.get(`/api/auth/validate-reset-token?token=${encodeURIComponent(token)}`);
    if (res.success) {
      return res;
    }
    throw new Error(res.error || 'Token de redefinição inválido ou expirado.');
  },

  // Iniciar pareamento de autenticador TOTP (QR Code + Manual Key)
  async setupTotp() {
    const res = await api.post('/api/auth/totp/setup', {});
    if (res.success) {
      return res;
    }
    throw new Error(res.error || 'Falha ao gerar QR Code de configuração TOTP.');
  },

  // Confirmar pareamento de autenticador com 1º código de 6 dígitos
  async confirmTotp(code) {
    const res = await api.post('/api/auth/totp/confirm', { code });
    if (res.success) {
      return res;
    }
    throw new Error(res.error || 'Código incorreto ou inválido.');
  },

  // Obter status de ativação TOTP e códigos de backup restantes
  async getTotpStatus() {
    const res = await api.get('/api/auth/totp/status');
    if (res.success) {
      return res;
    }
    throw new Error(res.error || 'Falha ao consultar status TOTP.');
  },

  // Efetua logout seguro
  async logout() {
    try {
      await api.post('/api/auth/logout', {});
    } finally {
      localStorage.removeItem('user_data');
      localStorage.removeItem('csrf_token');
      window.location.href = '/login.html';
    }
  },

  // Helpers RBAC
  isConsultora(user = this.getUser()) {
    return user && user.perfil === 'CONSULTORA';
  },

  isSupervisor(user = this.getUser()) {
    return user && user.perfil === 'SUPERVISOR';
  },

  isTecnico(user = this.getUser()) {
    return user && user.perfil === 'TECNICO';
  },

  canEditGEOR(user = this.getUser()) {
    return this.isConsultora(user);
  },

  canReassignTecnico(user = this.getUser()) {
    return this.isConsultora(user) || this.isSupervisor(user);
  }
};
