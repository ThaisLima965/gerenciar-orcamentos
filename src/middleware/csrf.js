import crypto from 'crypto';
import { SECURITY_CONFIG } from '../config/security.js';

export function csrfProtection(req, res, next) {
  // Gera token CSRF se não existir no cookie
  let csrfToken = req.cookies?.[SECURITY_CONFIG.csrfCookieName];
  if (!csrfToken) {
    csrfToken = crypto.randomBytes(32).toString('hex');
    res.cookie(SECURITY_CONFIG.csrfCookieName, csrfToken, SECURITY_CONFIG.csrfCookieOptions);
  }

  // Métodos seguros (idempotentes) apenas passam
  const safeMethods = ['GET', 'HEAD', 'OPTIONS'];
  if (safeMethods.includes(req.method)) {
    return next();
  }

  // Requisições de login e recuperação de senha públicas podem gerar novo CSRF e passar se ainda não autenticadas
  if (req.path === '/api/auth/login' || req.path === '/api/auth/csrf' || req.path === '/api/auth/forgot-password') {
    return next();
  }

  // Validação do token CSRF nos métodos que alteram estado (POST, PUT, PATCH, DELETE)
  const headerToken = req.headers['x-csrf-token'];

  if (!headerToken || !csrfToken || headerToken !== csrfToken) {
    return res.status(403).json({
      success: false,
      error: 'Falha na validação de segurança CSRF. Requisição rejeitada.'
    });
  }

  next();
}

export function generateCsrfToken() {
  return crypto.randomBytes(32).toString('hex');
}
