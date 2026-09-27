import { Router } from 'express';
import { authController } from '../controllers/authController.js';
import { authenticate } from '../middleware/auth.js';
import { loginRateLimiter, forgotPasswordRateLimiter, verifyOtpRateLimiter } from '../middleware/rateLimiter.js';

const router = Router();

// Rota de Login com proteção contra força bruta
router.post('/login', loginRateLimiter, authController.login);

// Rota de redefinição de senha no Primeiro Acesso
router.post('/primeiro-acesso', authController.primeiroAcesso);

// 1. Rota de solicitação de código SMS de redefinição (máx 3/hora)
router.post('/forgot-password', forgotPasswordRateLimiter, authController.forgotPassword);

// 2. Rota de validação do código OTP de 6 dígitos recebido por SMS
router.post('/verify-token', verifyOtpRateLimiter, authController.verifyToken);

// 3. Rota de execução da redefinição com a nova senha
router.post('/reset-password', authController.resetPassword);

// Rota legada de validação de link de e-mail
router.get('/validate-reset-token', authController.validateResetToken);

// Rota de verificação do usuário atual autenticado
router.get('/me', authenticate, authController.me);

// Rota de obtenção/renovação do token CSRF
router.get('/csrf', authController.getCsrf);

// Rota de monitoramento da conexão do WhatsApp
router.get('/whatsapp-status', authController.getWhatsAppStatus);

// Rota de Logout seguro
router.post('/logout', authController.logout);

export default router;
