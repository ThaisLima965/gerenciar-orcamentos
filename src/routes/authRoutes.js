import { Router } from 'express';
import { authController } from '../controllers/authController.js';
import { authenticate } from '../middleware/auth.js';
import { loginRateLimiter } from '../middleware/rateLimiter.js';

const router = Router();

// Rota de Login com proteção contra força bruta
router.post('/login', loginRateLimiter, authController.login);

// Rota de redefinição de senha no Primeiro Acesso
router.post('/primeiro-acesso', authController.primeiroAcesso);

// Rota de recuperação de senha (Esqueci minha senha - Geração e envio de Token via Neon)
router.post('/forgot-password', authController.forgotPassword);

// Rota de validação de token e redefinição de senha com Token / OTP via Neon
router.post('/reset-password', authController.resetPassword);

// Rota de verificação de token de redefinição
router.get('/verify-token', authController.verifyResetToken);

// Rota de verificação do usuário atual autenticado
router.get('/me', authenticate, authController.me);

// Rota de obtenção/renovação do token CSRF
router.get('/csrf', authController.getCsrf);

// Rota de Logout seguro
router.post('/logout', authController.logout);

export default router;
