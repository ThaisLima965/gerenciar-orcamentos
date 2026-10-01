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

  // =========================================================================
  // MODAL DE RECUPERAÇÃO DE SENHA COM TOKEN NEON (ETAPAS 1 E 2)
  // =========================================================================
  const linkForgotPassword = document.getElementById('link-forgot-password');
  const modalRecuperarSenha = document.getElementById('modal-recuperar-senha');
  const forgotSubtitle = document.getElementById('forgot-modal-subtitle');
  const forgotStep1Form = document.getElementById('forgot-step1-form');
  const forgotStep2Form = document.getElementById('forgot-step2-form');
  const forgotIdentificadorInput = document.getElementById('forgot-identificador');
  const forgotErrorAlert = document.getElementById('forgot-error-alert');
  const forgotErrorMsg = document.getElementById('forgot-error-msg');
  const forgotSuccessAlert = document.getElementById('forgot-success-alert');
  const forgotSuccessMsg = document.getElementById('forgot-success-msg');
  const btnSubmitForgot = document.getElementById('btn-submit-forgot');
  const btnCancelForgot = document.getElementById('btn-cancel-forgot');
  const btnBackToStep1 = document.getElementById('btn-back-to-step1');
  const btnSubmitReset = document.getElementById('btn-submit-reset');
  const forgotBackToLogin = document.getElementById('forgot-back-to-login');
  const btnProceedToLogin = document.getElementById('btn-proceed-to-login');

  const badgeUserName = document.getElementById('badge-user-name');
  const badgeUserEmail = document.getElementById('badge-user-email');
  const resetTokenInput = document.getElementById('reset-token-input');
  const resetNovaSenhaInput = document.getElementById('reset-nova-senha');
  const resetConfirmarSenhaInput = document.getElementById('reset-confirmar-senha');
  const toggleResetSenha = document.getElementById('toggle-reset-senha');
  const toggleResetConfirmar = document.getElementById('toggle-reset-confirmar');

  let currentResetUser = { email: '', nome: '', matricula: '' };

  // Alternar visualização de senha no modal de redefinição
  if (toggleResetSenha && resetNovaSenhaInput) {
    toggleResetSenha.addEventListener('click', () => {
      const isPass = resetNovaSenhaInput.type === 'password';
      resetNovaSenhaInput.type = isPass ? 'text' : 'password';
      toggleResetSenha.innerHTML = isPass ? '<i class="bi bi-eye-slash"></i>' : '<i class="bi bi-eye"></i>';
    });
  }

  if (toggleResetConfirmar && resetConfirmarSenhaInput) {
    toggleResetConfirmar.addEventListener('click', () => {
      const isPass = resetConfirmarSenhaInput.type === 'password';
      resetConfirmarSenhaInput.type = isPass ? 'text' : 'password';
      toggleResetConfirmar.innerHTML = isPass ? '<i class="bi bi-eye-slash"></i>' : '<i class="bi bi-eye"></i>';
    });
  }

  const tokenHelperCard = document.getElementById('token-helper-card');
  const badgeDevCode = document.getElementById('badge-dev-code');

  const showStep1 = () => {
    forgotErrorAlert.style.display = 'none';
    forgotSuccessAlert.style.display = 'none';
    forgotStep1Form.style.display = 'block';
    forgotStep2Form.style.display = 'none';
    forgotBackToLogin.style.display = 'none';
    if (tokenHelperCard) tokenHelperCard.style.display = 'none';
    forgotSubtitle.textContent = 'Gere um token de confirmação e receba via Neon para redefinir sua senha com total segurança.';
    forgotIdentificadorInput.value = identificadorInput.value.trim() || currentResetUser.email || '';
    forgotIdentificadorInput.focus();
  };

  const showStep2 = (userData = null, tokenVal = '') => {
    forgotErrorAlert.style.display = 'none';
    forgotSuccessAlert.style.display = 'none';
    forgotStep1Form.style.display = 'none';
    forgotStep2Form.style.display = 'block';
    forgotBackToLogin.style.display = 'none';
    forgotSubtitle.textContent = 'Insira o token/código recebido por e-mail e defina sua nova senha pessoal.';

    if (userData) {
      currentResetUser = userData;
      badgeUserName.textContent = userData.nome || 'Colaborador';
      badgeUserEmail.textContent = userData.email || '';
    }

    if (tokenVal) {
      resetTokenInput.value = tokenVal;
      if (tokenHelperCard && badgeDevCode) {
        badgeDevCode.textContent = tokenVal;
        tokenHelperCard.style.display = 'block';
      }
      resetNovaSenhaInput.focus();
    } else {
      if (tokenHelperCard) tokenHelperCard.style.display = 'none';
      resetTokenInput.focus();
    }
  };


  if (linkForgotPassword && modalRecuperarSenha) {
    linkForgotPassword.addEventListener('click', () => {
      showStep1();
      modalRecuperarSenha.style.display = 'flex';
    });

    if (btnCancelForgot) {
      btnCancelForgot.addEventListener('click', () => {
        modalRecuperarSenha.style.display = 'none';
      });
    }

    if (btnBackToStep1) {
      btnBackToStep1.addEventListener('click', () => {
        showStep1();
      });
    }

    // PASSO 1: Envio do formulário de solicitação de Token
    if (forgotStep1Form) {
      forgotStep1Form.addEventListener('submit', async (e) => {
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
        btnSubmitForgot.innerHTML = '<i class="bi bi-arrow-repeat spin"></i> <span>Gerando Token Neon...</span>';

        try {
          const res = await auth.forgotPassword(ident);
          currentResetUser = {
            email: res.email || ident,
            nome: res.nome || 'Colaborador'
          };

          forgotSuccessMsg.innerHTML = `
            Token de confirmação gerado com sucesso pelo <strong>Neon Auth</strong> e enviado para o e-mail: <br>
            <strong style="color: #065F46;">${currentResetUser.email}</strong>
          `;
          forgotSuccessAlert.style.display = 'block';

          // Avança para o Passo 2 com o e-mail preenchido
          setTimeout(() => {
            showStep2(currentResetUser, res.dev_otp || res.dev_token || '');
            if (res.dev_otp || res.dev_token) {
              forgotSuccessAlert.style.display = 'block';
            }
          }, 1000);

        } catch (err) {
          forgotErrorMsg.textContent = err.message || 'Erro ao gerar token de confirmação via Neon.';
          forgotErrorAlert.style.display = 'block';
        } finally {
          btnSubmitForgot.disabled = false;
          btnSubmitForgot.innerHTML = '<i class="bi bi-send-fill" style="margin-right: 0.3rem;"></i> <span>Gerar Token Neon</span>';
        }
      });
    }

    // PASSO 2: Validação do Token e Salvamento da Nova Senha
    if (forgotStep2Form) {
      forgotStep2Form.addEventListener('submit', async (e) => {
        e.preventDefault();
        forgotErrorAlert.style.display = 'none';
        forgotSuccessAlert.style.display = 'none';

        const token = resetTokenInput.value.trim();
        const novaSenha = resetNovaSenhaInput.value;
        const confirmarSenha = resetConfirmarSenhaInput.value;

        if (!token) {
          forgotErrorMsg.textContent = 'Por favor, informe o token ou código OTP recebido.';
          forgotErrorAlert.style.display = 'block';
          return;
        }

        if (novaSenha.length < 6) {
          forgotErrorMsg.textContent = 'A nova senha deve ter no mínimo 6 caracteres.';
          forgotErrorAlert.style.display = 'block';
          return;
        }

        const hasLetter = /[a-zA-Z]/.test(novaSenha);
        const hasNumber = /[0-9]/.test(novaSenha);
        if (!hasLetter || !hasNumber) {
          forgotErrorMsg.textContent = 'A nova senha deve conter pelo menos uma letra e um número.';
          forgotErrorAlert.style.display = 'block';
          return;
        }

        if (novaSenha !== confirmarSenha) {
          forgotErrorMsg.textContent = 'A nova senha e a confirmação não coincidem.';
          forgotErrorAlert.style.display = 'block';
          return;
        }

        btnSubmitReset.disabled = true;
        btnSubmitReset.innerHTML = '<i class="bi bi-arrow-repeat spin"></i> <span>Validando Token Neon...</span>';

        try {
          const res = await auth.resetPassword({
            token: token.length > 10 ? token : null,
            otp: token.length <= 10 ? token : null,
            email: currentResetUser.email,
            identificador: currentResetUser.email,
            novaSenha,
            confirmarNovaSenha: confirmarSenha
          });

          forgotStep2Form.style.display = 'none';
          forgotSuccessMsg.innerHTML = `
            <div style="font-weight: 700; font-size: 0.95rem; margin-bottom: 0.25rem;">Senha Redefinida com Sucesso!</div>
            <div>Sua nova senha foi gravada e validada pelo <strong>Neon Auth</strong>. Você já pode fazer login.</div>
          `;
          forgotSuccessAlert.style.display = 'block';
          forgotBackToLogin.style.display = 'block';

        } catch (err) {
          forgotErrorMsg.textContent = err.message || 'Falha ao validar token e redefinir senha.';
          forgotErrorAlert.style.display = 'block';
        } finally {
          btnSubmitReset.disabled = false;
          btnSubmitReset.innerHTML = '<i class="bi bi-check2-circle" style="margin-right: 0.3rem;"></i> <span>Redefinir com Token</span>';
        }
      });
    }

    if (btnProceedToLogin) {
      btnProceedToLogin.addEventListener('click', () => {
        modalRecuperarSenha.style.display = 'none';
        identificadorInput.value = currentResetUser.email || '';
        senhaInput.value = '';
        senhaInput.focus();
      });
    }

    // Verificação de token vindo pela URL (?token=... ou ?reset_token=...)
    const urlParams = new URLSearchParams(window.location.search);
    const urlToken = urlParams.get('token') || urlParams.get('reset_token');
    if (urlToken) {
      modalRecuperarSenha.style.display = 'flex';
      showStep2(null, urlToken);
      auth.verifyResetToken(urlToken).then((res) => {
        if (res.valid) {
          showStep2(res, urlToken);
        }
      }).catch(() => {});
    }
  }
});

