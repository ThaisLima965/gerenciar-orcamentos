import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

import { SECURITY_CONFIG } from './config/security.js';
import { csrfProtection } from './middleware/csrf.js';
import { apiGeneralRateLimiter } from './middleware/rateLimiter.js';

import authRoutes from './routes/authRoutes.js';
import orcamentoRoutes from './routes/orcamentoRoutes.js';
import clienteRoutes from './routes/clienteRoutes.js';
import tecnicoRoutes from './routes/tecnicoRoutes.js';
import usuarioRoutes from './routes/usuarioRoutes.js';
import relatorioRoutes from './routes/relatorioRoutes.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// 1. Segurança com Helmet (Headers HTTP Seguros & Content Security Policy)
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://cdn.jsdelivr.net"],
        fontSrc: ["'self'", "https://fonts.gstatic.com", "https://cdn.jsdelivr.net"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'"]
      }
    },
    crossOriginEmbedderPolicy: false
  })
);

// 2. CORS configurado para permitir credenciais (Cookies)
app.use(
  cors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token']
  })
);

// 3. Parsers de Cookies e Body
app.use(cookieParser(process.env.COOKIE_SECRET || 'cookie_secret_fallback'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 4. Proteção CSRF
app.use(csrfProtection);

// 5. Rate Limiter geral nas rotas da API e desativação de cache para sincronização em tempo real
app.use('/api/', (req, res, next) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  res.set('Surrogate-Control', 'no-store');
  next();
});
app.use('/api/', apiGeneralRateLimiter);

// 6. Rotas da API
app.use('/api/auth', authRoutes);
app.use('/api/orcamentos', orcamentoRoutes);
app.use('/api/clientes', clienteRoutes);
app.use('/api/tecnicos', tecnicoRoutes);
app.use('/api/usuarios', usuarioRoutes);
app.use('/api/relatorios', relatorioRoutes);

// 7. Servir Arquivos Estáticos do Frontend
const publicPath = path.resolve(__dirname, '../public');
app.use(express.static(publicPath));

// 8. Rota de Fallback para SPA / Home
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ success: false, error: 'Endpoint da API não encontrado.' });
  }
  res.sendFile(path.join(publicPath, 'index.html'));
});

// 9. Middleware Global de Tratamento de Erros
app.use((err, req, res, next) => {
  console.error('❌ [Server Error]:', err);
  res.status(err.status || 500).json({
    success: false,
    error: err.message || 'Ocorreu um erro interno no servidor.'
  });
});

export default app;
