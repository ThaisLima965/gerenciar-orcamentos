import { auth } from './auth.js';

document.addEventListener('DOMContentLoaded', async () => {
  // Se já estiver logado e não tiver primeiro_acesso pendente, redireciona para o painel
  const activeUser = await auth.checkSession();
  if (activeUser && !activeUser.primeiro_acesso) {
    window.location.href = '/';
    return;
  }

  const loginForm = document.getElementById('login-form');
  const identificadorInput = document.getElementById('identificador');
  const senhaInput = document.getElementById('senha');
  const togglePasswordBtn = document.getElementById('toggle-password');
  const errorAlert = document.getElementById('login-error-alert');
  const errorMsg = document.getElementById('login-error-msg');
  const submitBtn = document.getElementById('btn-submit');

  // Elementos do Modal de Primeiro Acesso
  const modalPrimeiroAcesso = document.getElementById('modal-primeiro-acesso');
  const firstAccessForm = document.getElementById('first-access-form');
  const novaSenhaInput = document.getElementById('nova-senha');
  const confirmarNovaSenhaInput = document.getElementById('confirmar-nova-senha');
  const toggleNovaSenhaBtn = document.getElementById('toggle-nova-senha');
  const toggleConfirmarSenhaBtn = document.getElementById('toggle-confirmar-senha');
  const firstAccessErrorAlert = document.getElementById('first-access-error-alert');
  const firstAccessErrorMsg = document.getElementById('first-access-error-msg');
  const btnSubmitFirstAccess = document.getElementById('btn-submit-first-access');
  const firstAccessUserName = document.getElementById('first-access-user-name');
  const firstAccessUserDetails = document.getElementById('first-access-user-details');

  let pendingCredentials = {
    identificador: '',
    senha_atual: '',
    user: null
  };

  // Se o usuário já estiver na sessão mas com primeiro_acesso = true, abre o modal direto
  if (activeUser && activeUser.primeiro_acesso) {
    pendingCredentials.user = activeUser;
    firstAccessUserName.textContent = activeUser.nome || 'Colaborador';
    firstAccessUserDetails.textContent = `Perfil: ${activeUser.perfil} • ${activeUser.email || activeUser.matricula}`;
    modalPrimeiroAcesso.style.display = 'flex';
  }

  // Toggle visualização de senha do Login
  if (togglePasswordBtn) {
    togglePasswordBtn.addEventListener('click', () => {
      const isPassword = senhaInput.type === 'password';
      senhaInput.type = isPassword ? 'text' : 'password';
      togglePasswordBtn.innerHTML = isPassword 
        ? '<i class="bi bi-eye-slash"></i>' 
        : '<i class="bi bi-eye"></i>';
    });
  }

  // Toggle visualização da Nova Senha
  if (toggleNovaSenhaBtn) {
    toggleNovaSenhaBtn.addEventListener('click', () => {
      const isPassword = novaSenhaInput.type === 'password';
      novaSenhaInput.type = isPassword ? 'text' : 'password';
      toggleNovaSenhaBtn.innerHTML = isPassword ? '<i class="bi bi-eye-slash"></i>' : '<i class="bi bi-eye"></i>';
    });
  }

  if (toggleConfirmarSenhaBtn) {
    toggleConfirmarSenhaBtn.addEventListener('click', () => {
      const isPassword = confirmarNovaSenhaInput.type === 'password';
      confirmarNovaSenhaInput.type = isPassword ? 'text' : 'password';
      toggleConfirmarSenhaBtn.innerHTML = isPassword ? '<i class="bi bi-eye-slash"></i>' : '<i class="bi bi-eye"></i>';
    });
  }

  // Submissão do formulário de login
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorAlert.style.display = 'none';
    
    const identificador = identificadorInput.value.trim();
    const senha = senhaInput.value;

    if (!identificador || !senha) return;

    // Feedback de carregamento
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="bi bi-arrow-repeat spin"></i> <span>Autenticando...</span>';

    try {
      const loginResult = await auth.login(identificador, senha);
      
      // CHECAGEM DE PRIMEIRO ACESSO / TROCA OBRIGATÓRIA DE SENHA
      if (loginResult.primeiro_acesso) {
        pendingCredentials = {
          identificador,
          senha_atual: senha,
          user: loginResult.user
        };

        firstAccessUserName.textContent = loginResult.user.nome || 'Colaborador';
        firstAccessUserDetails.textContent = `Perfil: ${loginResult.user.perfil} • ${loginResult.user.email || loginResult.user.matricula}`;
        
        // Abre modal de troca de senha com animação
        modalPrimeiroAcesso.style.display = 'flex';
        novaSenhaInput.focus();
        return;
      }

      // Redireciona diretamente para o painel
      window.location.href = '/';
    } catch (err) {
      errorMsg.textContent = err.message || 'Falha ao autenticar. Verifique suas credenciais.';
      errorAlert.style.display = 'block';
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerHTML = '<span>Entrar</span>';
    }
  });

  // Submissão da Troca Obrigatória de Senha (Primeiro Acesso)
  if (firstAccessForm) {
    firstAccessForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      firstAccessErrorAlert.style.display = 'none';

      const novaSenha = novaSenhaInput.value;
      const confirmarNovaSenha = confirmarNovaSenhaInput.value;

      if (!novaSenha || !confirmarNovaSenha) {
        firstAccessErrorMsg.textContent = 'Preencha todos os campos de senha.';
        firstAccessErrorAlert.style.display = 'block';
        return;
      }

      if (novaSenha !== confirmarNovaSenha) {
        firstAccessErrorMsg.textContent = 'A nova senha e a confirmação não coincidem.';
        firstAccessErrorAlert.style.display = 'block';
        return;
      }

      if (novaSenha.length < 6) {
        firstAccessErrorMsg.textContent = 'A nova senha deve ter no mínimo 6 caracteres.';
        firstAccessErrorAlert.style.display = 'block';
        return;
      }

      const hasLetter = /[a-zA-Z]/.test(novaSenha);
      const hasNumber = /[0-9]/.test(novaSenha);
      if (!hasLetter || !hasNumber) {
        firstAccessErrorMsg.textContent = 'A nova senha deve conter letras e números.';
        firstAccessErrorAlert.style.display = 'block';
        return;
      }

      btnSubmitFirstAccess.disabled = true;
      btnSubmitFirstAccess.innerHTML = '<i class="bi bi-arrow-repeat spin"></i> <span>Salvando nova senha...</span>';

      try {
        await auth.redefinirPrimeiroAcesso(
          novaSenha,
          confirmarNovaSenha,
          pendingCredentials.identificador,
          pendingCredentials.senha_atual
        );

        // Sucesso: Redireciona para o Dashboard
        window.location.href = '/';
      } catch (err) {
        firstAccessErrorMsg.textContent = err.message || 'Erro ao redefinir senha.';
        firstAccessErrorAlert.style.display = 'block';
      } finally {
        btnSubmitFirstAccess.disabled = false;
        btnSubmitFirstAccess.innerHTML = '<span>Salvar Nova Senha e Entrar</span>';
      }
    });
  }

  // Elementos do Modal de Recuperação de Senha (Esqueci minha senha)
  const linkForgotPassword = document.getElementById('link-forgot-password');
  const modalRecuperarSenha = document.getElementById('modal-recuperar-senha');
  const forgotPasswordForm = document.getElementById('forgot-password-form');
  const forgotIdentificadorInput = document.getElementById('forgot-identificador');
  const forgotErrorAlert = document.getElementById('forgot-error-alert');
  const forgotErrorMsg = document.getElementById('forgot-error-msg');
  const forgotSuccessAlert = document.getElementById('forgot-success-alert');
  const forgotSuccessMsg = document.getElementById('forgot-success-msg');
  const btnSubmitForgot = document.getElementById('btn-submit-forgot');
  const btnCancelForgot = document.getElementById('btn-cancel-forgot');
  const forgotBackToLogin = document.getElementById('forgot-back-to-login');
  const btnProceedToLogin = document.getElementById('btn-proceed-to-login');

  let recoveredUserEmail = '';

  if (linkForgotPassword && modalRecuperarSenha) {
    linkForgotPassword.addEventListener('click', () => {
      forgotErrorAlert.style.display = 'none';
      forgotSuccessAlert.style.display = 'none';
      forgotPasswordForm.style.display = 'block';
      forgotBackToLogin.style.display = 'none';
      forgotIdentificadorInput.value = identificadorInput.value.trim() || '';
      modalRecuperarSenha.style.display = 'flex';
      forgotIdentificadorInput.focus();
    });

    if (btnCancelForgot) {
      btnCancelForgot.addEventListener('click', () => {
        modalRecuperarSenha.style.display = 'none';
      });
    }

    if (forgotPasswordForm) {
      forgotPasswordForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        forgotErrorAlert.style.display = 'none';
        forgotSuccessAlert.style.display = 'none';

        const ident = forgotIdentificadorInput.value.trim();
        if (!ident) {
          forgotErrorMsg.textContent = 'Por favor, digite seu e-mail ou matrícula.';
          forgotErrorAlert.style.display = 'block';
          return;
        }

        btnSubmitForgot.disabled = true;
        btnSubmitForgot.innerHTML = '<i class="bi bi-arrow-repeat spin"></i> <span>Verificando...</span>';

        try {
          const res = await auth.forgotPassword(ident);
          recoveredUserEmail = res.email || ident;
          forgotSuccessMsg.textContent = `Identificamos o cadastro de ${res.nome || 'colaborador'}. A senha foi redefinida provisoriamente.`;
          forgotSuccessAlert.style.display = 'block';
          forgotPasswordForm.style.display = 'none';
          forgotBackToLogin.style.display = 'block';
        } catch (err) {
          forgotErrorMsg.textContent = err.message || 'Erro ao processar recuperação de senha.';
          forgotErrorAlert.style.display = 'block';
        } finally {
          btnSubmitForgot.disabled = false;
          btnSubmitForgot.innerHTML = '<span>Redefinir Senha</span>';
        }
      });
    }

    if (btnProceedToLogin) {
      btnProceedToLogin.addEventListener('click', () => {
        modalRecuperarSenha.style.display = 'none';
        identificadorInput.value = recoveredUserEmail;
        senhaInput.value = 'Tke@1234';
        // Foco e destaque
        senhaInput.focus();
      });
    }
  }
});
