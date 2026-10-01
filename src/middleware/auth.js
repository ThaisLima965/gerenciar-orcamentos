import jwt from 'jsonwebtoken';
import { SECURITY_CONFIG } from '../config/security.js';
import db from '../config/database.js';

export function authenticate(req, res, next) {
  try {
    let token = req.cookies?.[SECURITY_CONFIG.authCookieName];

    // Fallback: Authorization header Bearer token se necessário
    if (!token && req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'Sessão não autenticada. Por favor, realize login.'
      });
    }

    const decoded = jwt.verify(token, SECURITY_CONFIG.jwtSecret);

    // Consulta no banco para verificar se o usuário ainda existe e está ativo
    const user = db.prepare('SELECT id, nome, email, matricula, perfil, grupo, primeiro_acesso, ativo FROM usuarios WHERE id = ?').get(decoded.id);

    if (!user || user.ativo !== 1) {
      // Limpa cookie inválido
      res.clearCookie(SECURITY_CONFIG.authCookieName, { path: '/' });
      return res.status(401).json({
        success: false,
        error: 'Usuário inativo ou inexistente. Acesso negado.'
      });
    }

    // Injeta os dados do usuário autenticado na requisição
    req.user = {
      id: user.id,
      nome: user.nome,
      email: user.email,
      matricula: user.matricula,
      perfil: user.perfil,
      grupo: user.grupo || 'G11',
      primeiro_acesso: Boolean(user.primeiro_acesso)
    };

    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      res.clearCookie(SECURITY_CONFIG.authCookieName, { path: '/' });
      return res.status(401).json({
        success: false,
        error: 'Sessão expirada. Por favor, faça login novamente.'
      });
    }

    return res.status(401).json({
      success: false,
      error: 'Token de autenticação inválido.'
    });
  }
}
