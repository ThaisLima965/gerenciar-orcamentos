import rateLimit from 'express-rate-limit';

// Limiter para tentativas de login: máximo 15 tentativas a cada 15 minutos por IP
export const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15,
  message: {
    success: false,
    error: 'Muitas tentativas de login a partir deste endereço IP. Aguarde 15 minutos e tente novamente.'
  },
  standardHeaders: true,
  legacyHeaders: false
});

// Limiter geral para endpoints de API: máximo 300 requisições a cada 1 minuto por IP
export const apiGeneralRateLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 300,
  message: {
    success: false,
    error: 'Limite de requisições excedido. Reduza a frequência de solicitações.'
  },
  standardHeaders: true,
  legacyHeaders: false
});
