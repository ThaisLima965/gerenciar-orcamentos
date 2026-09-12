/**
 * Middleware RBAC (Role-Based Access Control)
 * Gerencia autorizações com base nos perfis: TECNICO, SUPERVISOR, CONSULTORA
 */

export function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Acesso não autenticado.'
      });
    }

    if (!allowedRoles.includes(req.user.perfil)) {
      return res.status(403).json({
        success: false,
        error: `Acesso negado. Ação permitida apenas para os perfis: ${allowedRoles.join(', ')}. Seu perfil atual é: ${req.user.perfil}.`
      });
    }

    next();
  };
}

/**
 * Matriz de Permissões para campos específicos
 */
export const PERMISSIONS = {
  // Apenas a Consultora (Admin) pode aprovar GEOR
  canLiberateGEOR: (user) => user && user.perfil === 'CONSULTORA',
  
  // Apenas a Consultora pode definir data de envio final ao cliente
  canSetDataEnvioCliente: (user) => user && user.perfil === 'CONSULTORA',
  
  // Supervisor e Consultora podem alterar técnico do chamado
  canReassignTecnico: (user) => user && ['SUPERVISOR', 'CONSULTORA'].includes(user.perfil),
  
  // Apenas Consultora pode deletar registros
  canDeleteRecord: (user) => user && user.perfil === 'CONSULTORA',
  
  // Gestão e importação de clientes e técnicos (Consultora e Supervisor)
  canManageCadastros: (user) => user && ['CONSULTORA', 'SUPERVISOR'].includes(user.perfil),

  // Exportação de relatórios e dados (Consultora e Supervisor)
  canExportData: (user) => user && ['CONSULTORA', 'SUPERVISOR'].includes(user.perfil)
};
