import dotenv from 'dotenv';
dotenv.config();

const NEON_AUTH_URL = process.env.NEON_AUTH_URL || 'https://ep-flat-art-ac9238wc.neonauth.sa-east-1.aws.neon.tech/neondb/auth';
const APP_ORIGIN = process.env.APP_BASE_URL || 'http://localhost:3000';

export const neonAuthService = {
  /**
   * Garante que o usuário existe no Neon Auth (Better Auth) para envio de e-mails e tokens
   */
  async ensureNeonUser(name, email, tempPassword = 'TempPassword@12345') {
    try {
      const res = await fetch(`${NEON_AUTH_URL}/sign-up/email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Origin': APP_ORIGIN
        },
        body: JSON.stringify({
          name: name || 'Colaborador TKE',
          email: email.toLowerCase().trim(),
          password: tempPassword
        })
      });
      const data = await res.json().catch(() => ({}));
      // Status 200 (criado) ou 422 (já cadastrado)
      return { success: res.ok || res.status === 422, status: res.status, data };
    } catch (error) {
      console.warn('⚠️ [NeonAuthService] Falha ao sincronizar usuário no Neon Auth:', error.message);
      return { success: false, error: error.message };
    }
  },

  /**
   * Solicita token de redefinição e envio de link por e-mail gerenciado pelo Neon
   */
  async requestPasswordReset(email, redirectTo = `${APP_ORIGIN}/login.html`) {
    try {
      const cleanEmail = email.toLowerCase().trim();
      const res = await fetch(`${NEON_AUTH_URL}/request-password-reset`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Origin': APP_ORIGIN
        },
        body: JSON.stringify({
          email: cleanEmail,
          redirectTo
        })
      });
      const data = await res.json().catch(() => ({}));
      return { success: res.ok, status: res.status, data };
    } catch (error) {
      console.error('❌ [NeonAuthService] Erro ao solicitar token de redefinição via Neon:', error);
      return { success: false, error: error.message };
    }
  },

  /**
   * Solicita código OTP (6 dígitos) de confirmação por e-mail via Neon
   */
  async requestPasswordResetOTP(email) {
    try {
      const cleanEmail = email.toLowerCase().trim();
      const res = await fetch(`${NEON_AUTH_URL}/email-otp/request-password-reset`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Origin': APP_ORIGIN
        },
        body: JSON.stringify({
          email: cleanEmail
        })
      });
      const data = await res.json().catch(() => ({}));
      return { success: res.ok, status: res.status, data };
    } catch (error) {
      console.error('❌ [NeonAuthService] Erro ao solicitar OTP via Neon:', error);
      return { success: false, error: error.message };
    }
  },

  /**
   * Redefine a senha no Neon utilizando o Token de validação
   */
  async resetPasswordWithToken(token, newPassword) {
    try {
      const res = await fetch(`${NEON_AUTH_URL}/reset-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Origin': APP_ORIGIN
        },
        body: JSON.stringify({
          token: String(token).trim(),
          newPassword: String(newPassword)
        })
      });
      const data = await res.json().catch(() => ({}));
      return { success: res.ok, status: res.status, data };
    } catch (error) {
      console.error('❌ [NeonAuthService] Erro ao redefinir senha com token no Neon:', error);
      return { success: false, error: error.message };
    }
  },

  /**
   * Redefine a senha no Neon utilizando o código OTP
   */
  async resetPasswordWithOTP(email, otp, newPassword) {
    try {
      const res = await fetch(`${NEON_AUTH_URL}/email-otp/reset-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Origin': APP_ORIGIN
        },
        body: JSON.stringify({
          email: email.toLowerCase().trim(),
          otp: String(otp).trim(),
          password: String(newPassword)
        })
      });
      const data = await res.json().catch(() => ({}));
      return { success: res.ok, status: res.status, data };
    } catch (error) {
      console.error('❌ [NeonAuthService] Erro ao redefinir senha com OTP no Neon:', error);
      return { success: false, error: error.message };
    }
  }
};

export default neonAuthService;
