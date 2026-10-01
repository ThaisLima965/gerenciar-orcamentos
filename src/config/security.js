import dotenv from 'dotenv';
dotenv.config();

export const SECURITY_CONFIG = {
  jwtSecret: process.env.JWT_SECRET || 'fallback_secret_key_change_in_production_!',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '8h',
  authCookieName: 'auth_token',
  csrfCookieName: 'csrf_token',
  cookieOptions: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax', // 'lax' for corporate SPA local dev / strict for production
    maxAge: 8 * 60 * 60 * 1000, // 8 horas
    path: '/'
  },
  csrfCookieOptions: {
    httpOnly: false, // O cliente JavaScript precisa ler para enviar no header X-CSRF-Token (Double Submit)
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 8 * 60 * 60 * 1000,
    path: '/'
  }
};
