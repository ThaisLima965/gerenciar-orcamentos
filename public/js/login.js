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

  const EYE_OPEN_SVG = `
    <svg class="eye-icon" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
      <circle cx="12" cy="12" r="3"></circle>
    </svg>
  `;

  const EYE_SLASH_SVG = `
    <svg class="eye-icon-slash" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
      <line x1="1" y1="1" x2="23" y2="23"></line>
    </svg>
  `;

  function setupPasswordToggle(button, input) {
    if (!button || !input) return;
    button.addEventListener('click', (e) => {
      e.preventDefault();
      const isPassword = input.type === 'password';
      input.type = isPassword ? 'text' : 'password';
      button.innerHTML = isPassword ? EYE_SLASH_SVG : EYE_OPEN_SVG;
      button.setAttribute('title', isPassword ? 'Ocultar Senha' : 'Mostrar Senha');
      button.setAttribute('aria-label', isPassword ? 'Ocultar Senha' : 'Mostrar Senha');
    });
  }

  // Ativa os botões de visualização de senha
  setupPasswordToggle(togglePasswordBtn, senhaInput);
  setupPasswordToggle(toggleNovaSenhaBtn, novaSenhaInput);
  setupPasswordToggle(toggleConfirmarSenhaBtn, confirmarNovaSenhaInput);

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
  // CONTROLADOR DO MODAL DE RECUPERAÇÃO DE SENHA VIA SMS (OTP EM 4 ETAPAS)
  // =========================================================================
  const linkForgotPassword = document.getElementById('link-forgot-password');
  const modalRecuperarSenha = document.getElementById('modal-recuperar-senha');
  const forgotModalIcon = document.getElementById('forgot-modal-icon');
  const forgotModalTitle = document.getElementById('forgot-modal-title');
  const forgotModalSubtitle = document.getElementById('forgot-modal-subtitle');
  const forgotErrorAlert = document.getElementById('forgot-error-alert');
  const forgotErrorMsg = document.getElementById('forgot-error-msg');
  const forgotInfoAlert = document.getElementById('forgot-info-alert');
  const forgotInfoMsg = document.getElementById('forgot-info-msg');

  // Elementos da Etapa 1 (Solicitação de WhatsApp)
  const forgotStep1 = document.getElementById('forgot-step-1');
  const forgotStep1Form = document.getElementById('forgot-step1-form');
  const forgotIdentificadorInput = document.getElementById('forgot-identificador');
  const btnSubmitStep1 = document.getElementById('btn-submit-step1');
  const btnCancelForgot = document.getElementById('btn-cancel-forgot');

  // Elementos da Etapa 2 (Validação de Token OTP)
  const forgotStep2 = document.getElementById('forgot-step-2');
  const forgotStep2Form = document.getElementById('forgot-step2-form');
  const forgotOtpInput = document.getElementById('forgot-otp-input');
  const step2MaskedPhone = document.getElementById('step2-masked-phone');
  const step2OtpHelperCard = document.getElementById('step2-otp-helper-card');
  const step2OtpHelperCode = document.getElementById('step2-otp-helper-code');
  const btnAutofillOtp = document.getElementById('btn-autofill-otp');
  const step2AttemptsText = document.getElementById('step2-attempts-text');
  const step2TimerText = document.getElementById('step2-timer-text');
  const step2TimerCount = document.getElementById('step2-timer-count');
  const btnResendOtp = document.getElementById('btn-resend-otp');
  const btnBackToStep1 = document.getElementById('btn-back-to-step1');
  const btnSubmitStep2 = document.getElementById('btn-submit-step2');
  const btnOpenWaDirect = document.getElementById('btn-open-wa-direct');

  // Elementos da Etapa 3 (Definição de Nova Senha)
  const forgotStep3 = document.getElementById('forgot-step-3');
  const forgotStep3Form = document.getElementById('forgot-step3-form');
  const forgotNovaSenha = document.getElementById('forgot-nova-senha');
  const forgotConfirmarNovaSenha = document.getElementById('forgot-confirmar-nova-senha');
  const toggleForgotNovaSenha = document.getElementById('toggle-forgot-nova-senha');
  const toggleForgotConfirmarSenha = document.getElementById('toggle-forgot-confirmar-senha');
  const btnSubmitStep3 = document.getElementById('btn-submit-step3');

  // Elementos da Etapa 4 (Sucesso)
  const forgotStep4 = document.getElementById('forgot-step-4');
  const btnProceedToLogin = document.getElementById('btn-proceed-to-login');

  // Configura botões de visualização de senha no formulário de reset
  setupPasswordToggle(toggleForgotNovaSenha, forgotNovaSenha);
  setupPasswordToggle(toggleForgotConfirmarSenha, forgotConfirmarNovaSenha);

  // Estado da sessão de recuperação
  let recoveryState = {
    identificador: '',
    maskedPhone: '',
    resetTicket: '',
    waMeUrl: '',
    otp: '',
    timerInterval: null,
    timeLeft: 60
  };

  function hideAlerts() {
    if (forgotErrorAlert) forgotErrorAlert.style.display = 'none';
    if (forgotInfoAlert) forgotInfoAlert.style.display = 'none';
  }

  function showError(msg) {
    if (forgotErrorAlert && forgotErrorMsg) {
      forgotErrorMsg.textContent = msg;
      forgotErrorAlert.style.display = 'block';
    }
  }

  function showInfo(msg) {
    if (forgotInfoAlert && forgotInfoMsg) {
      forgotInfoMsg.textContent = msg;
      forgotInfoAlert.style.display = 'block';
    }
  }

  function startResendTimer() {
    if (recoveryState.timerInterval) {
      clearInterval(recoveryState.timerInterval);
    }
    recoveryState.timeLeft = 60;
    if (step2TimerText) step2TimerText.style.display = 'inline';
    if (btnResendOtp) btnResendOtp.style.display = 'none';
    if (step2TimerCount) step2TimerCount.textContent = `${recoveryState.timeLeft}s`;

    recoveryState.timerInterval = setInterval(() => {
      recoveryState.timeLeft -= 1;
      if (step2TimerCount) step2TimerCount.textContent = `${recoveryState.timeLeft}s`;

      if (recoveryState.timeLeft <= 0) {
        clearInterval(recoveryState.timerInterval);
        recoveryState.timerInterval = null;
        if (step2TimerText) step2TimerText.style.display = 'none';
        if (btnResendOtp) btnResendOtp.style.display = 'inline';
      }
    }, 1000);
  }

  function goToStep(step) {
    hideAlerts();
    if (forgotStep1) forgotStep1.style.display = step === 1 ? 'block' : 'none';
    if (forgotStep2) forgotStep2.style.display = step === 2 ? 'block' : 'none';
    if (forgotStep3) forgotStep3.style.display = step === 3 ? 'block' : 'none';
    if (forgotStep4) forgotStep4.style.display = step === 4 ? 'block' : 'none';

    if (step === 1) {
      if (forgotModalIcon) forgotModalIcon.className = 'bi bi-whatsapp';
      if (forgotModalTitle) forgotModalTitle.textContent = 'Recuperação via WhatsApp';
      if (forgotModalSubtitle) forgotModalSubtitle.textContent = 'Informe seu e-mail corporativo, matrícula ou celular para receber o código no seu WhatsApp.';
      if (forgotIdentificadorInput) {
        forgotIdentificadorInput.value = identificadorInput.value.trim() || '';
        setTimeout(() => forgotIdentificadorInput.focus(), 150);
      }
    } else if (step === 2) {
      if (forgotModalIcon) forgotModalIcon.className = 'bi bi-whatsapp';
      if (forgotModalTitle) forgotModalTitle.textContent = 'Código de Verificação WhatsApp';
      if (forgotModalSubtitle) forgotModalSubtitle.textContent = 'Digite o código de 6 dígitos que enviamos para o seu WhatsApp.';
      if (step2MaskedPhone) step2MaskedPhone.textContent = recoveryState.maskedPhone || 'WhatsApp cadastrado';
      if (step2AttemptsText) step2AttemptsText.innerHTML = '<i class="bi bi-shield-check"></i> 3 tentativas restantes';
      
      // Exibe Helper Card com código e botão de inserção rápida
      if (step2OtpHelperCard && step2OtpHelperCode) {
        if (recoveryState.otp) {
          step2OtpHelperCode.textContent = recoveryState.otp;
          step2OtpHelperCard.style.display = 'block';
          if (btnAutofillOtp) {
            btnAutofillOtp.onclick = (ev) => {
              ev.preventDefault();
              if (forgotOtpInput) {
                forgotOtpInput.value = recoveryState.otp;
                forgotOtpInput.focus();
              }
            };
          }
        } else {
          step2OtpHelperCard.style.display = 'none';
        }
      }

      // Exibe botão para abrir mensagem no WhatsApp se link estiver disponível
      if (btnOpenWaDirect) {
        if (recoveryState.waMeUrl) {
          btnOpenWaDirect.href = recoveryState.waMeUrl;
          btnOpenWaDirect.style.display = 'flex';
        } else {
          btnOpenWaDirect.style.display = 'none';
        }
      }

      if (forgotOtpInput) {
        forgotOtpInput.value = '';
        setTimeout(() => forgotOtpInput.focus(), 150);
      }
      startResendTimer();
    } else if (step === 3) {
      if (forgotModalIcon) forgotModalIcon.className = 'bi bi-key-fill';
      if (forgotModalTitle) forgotModalTitle.textContent = 'Cadastrar Nova Senha';
      if (forgotModalSubtitle) forgotModalSubtitle.textContent = 'Código WhatsApp validado! Cadastre agora sua nova senha pessoal.';
      if (forgotNovaSenha) forgotNovaSenha.value = '';
      if (forgotConfirmarNovaSenha) forgotConfirmarNovaSenha.value = '';
      setTimeout(() => forgotNovaSenha && forgotNovaSenha.focus(), 150);
    } else if (step === 4) {
      if (forgotModalIcon) forgotModalIcon.className = 'bi bi-check-circle-fill';
      if (forgotModalTitle) forgotModalTitle.textContent = 'Senha Alterada com Sucesso!';
      if (forgotModalSubtitle) forgotModalSubtitle.textContent = 'Tudo pronto! Sua nova senha foi sincronizada com segurança.';
    }
  }

  // Abertura do Modal a partir do Link "Esqueci minha senha"
  if (linkForgotPassword && modalRecuperarSenha) {
    linkForgotPassword.addEventListener('click', (e) => {
      e.preventDefault();
      modalRecuperarSenha.style.display = 'flex';
      goToStep(1);
    });

    if (btnCancelForgot) {
      btnCancelForgot.addEventListener('click', () => {
        if (recoveryState.timerInterval) clearInterval(recoveryState.timerInterval);
        modalRecuperarSenha.style.display = 'none';
      });
    }

    if (btnBackToStep1) {
      btnBackToStep1.addEventListener('click', () => {
        if (recoveryState.timerInterval) clearInterval(recoveryState.timerInterval);
        goToStep(1);
      });
    }

    // ETAPA 1: Envio do WhatsApp
    if (forgotStep1Form) {
      forgotStep1Form.addEventListener('submit', async (e) => {
        e.preventDefault();
        hideAlerts();

        const ident = forgotIdentificadorInput.value.trim();
        if (!ident) {
          showError('Por favor, informe seu e-mail, matrícula ou celular.');
          return;
        }

        btnSubmitStep1.disabled = true;
        btnSubmitStep1.innerHTML = '<i class="bi bi-arrow-repeat spin"></i> <span>Enviando no WhatsApp...</span>';

        try {
          const res = await auth.forgotPassword(ident);
          recoveryState.identificador = ident;
          recoveryState.maskedPhone = res.masked_phone || '(11) 9****-****';
          recoveryState.waMeUrl = res.wa_me_url || '';
          recoveryState.otp = res.dev_otp || '';
          goToStep(2);
        } catch (err) {
          showError(err.message || 'Falha ao solicitar código via WhatsApp.');
        } finally {
          btnSubmitStep1.disabled = false;
          btnSubmitStep1.innerHTML = '<i class="bi bi-whatsapp" style="margin-right: 0.35rem;"></i> <span>Enviar no WhatsApp</span>';
        }
      });
    }

    // ETAPA 2: Validação do Código OTP de 6 Dígitos
    if (forgotStep2Form) {
      // Formatação amigável: permite apenas números
      if (forgotOtpInput) {
        forgotOtpInput.addEventListener('input', (e) => {
          e.target.value = e.target.value.replace(/\D/g, '').slice(0, 6);
        });
      }

      forgotStep2Form.addEventListener('submit', async (e) => {
        e.preventDefault();
        hideAlerts();

        const otp = forgotOtpInput.value.trim();
        if (!otp || otp.length !== 6) {
          showError('Por favor, digite o código completo de 6 dígitos.');
          return;
        }

        btnSubmitStep2.disabled = true;
        btnSubmitStep2.innerHTML = '<i class="bi bi-arrow-repeat spin"></i> <span>Validando...</span>';

        try {
          const res = await auth.verifyToken(recoveryState.identificador, otp);
          recoveryState.resetTicket = res.reset_ticket;
          goToStep(3);
        } catch (err) {
          showError(err.message || 'Código de verificação inválido.');
          if (typeof err.attempts_remaining === 'number') {
            if (err.attempts_remaining === 0) {
              step2AttemptsText.innerHTML = '<span style="color: #DC2626; font-weight: 700;"><i class="bi bi-x-circle-fill"></i> Código bloqueado</span>';
            } else {
              step2AttemptsText.innerHTML = `<span style="color: #D97706;"><i class="bi bi-exclamation-circle-fill"></i> ${err.attempts_remaining} tentativa(s) restante(s)</span>`;
            }
          }
        } finally {
          btnSubmitStep2.disabled = false;
          btnSubmitStep2.innerHTML = '<span>Validar Código</span>';
        }
      });

      // Reenvio de WhatsApp
      if (btnResendOtp) {
        btnResendOtp.addEventListener('click', async () => {
          hideAlerts();
          btnResendOtp.disabled = true;
          btnResendOtp.textContent = 'Enviando...';

          try {
            const res = await auth.forgotPassword(recoveryState.identificador);
            recoveryState.maskedPhone = res.masked_phone || recoveryState.maskedPhone;
            recoveryState.waMeUrl = res.wa_me_url || recoveryState.waMeUrl;
            recoveryState.otp = res.dev_otp || '';
            if (step2OtpHelperCard && step2OtpHelperCode && recoveryState.otp) {
              step2OtpHelperCode.textContent = recoveryState.otp;
              step2OtpHelperCard.style.display = 'block';
            }
            showInfo(`Novo código enviado para o WhatsApp ${recoveryState.maskedPhone}.`);
            if (btnOpenWaDirect && recoveryState.waMeUrl) {
              btnOpenWaDirect.href = recoveryState.waMeUrl;
              btnOpenWaDirect.style.display = 'flex';
            }
            startResendTimer();
          } catch (err) {
            showError(err.message || 'Erro ao reenviar no WhatsApp.');
            btnResendOtp.disabled = false;
            btnResendOtp.innerHTML = '<i class="bi bi-whatsapp"></i> Reenviar no WhatsApp';
          }
        });
      }
    }

    // ETAPA 3: Persistência da Nova Senha
    if (forgotStep3Form) {
      forgotStep3Form.addEventListener('submit', async (e) => {
        e.preventDefault();
        hideAlerts();

        const novaSenha = forgotNovaSenha.value;
        const confirmarNovaSenha = forgotConfirmarNovaSenha.value;

        if (!novaSenha || !confirmarNovaSenha) {
          showError('Preencha os campos de nova senha e confirmação.');
          return;
        }

        if (novaSenha !== confirmarNovaSenha) {
          showError('A nova senha e a confirmação não coincidem.');
          return;
        }

        if (novaSenha.length < 6) {
          showError('A nova senha deve ter no mínimo 6 caracteres.');
          return;
        }

        const hasLetter = /[a-zA-Z]/.test(novaSenha);
        const hasNumber = /[0-9]/.test(novaSenha);
        if (!hasLetter || !hasNumber) {
          showError('A nova senha deve conter pelo menos uma letra e um número.');
          return;
        }

        btnSubmitStep3.disabled = true;
        btnSubmitStep3.innerHTML = '<i class="bi bi-arrow-repeat spin"></i> <span>Salvando nova senha...</span>';

        try {
          await auth.resetPassword({
            reset_ticket: recoveryState.resetTicket,
            nova_senha: novaSenha,
            confirmar_nova_senha: confirmarNovaSenha
          });

          goToStep(4);
        } catch (err) {
          showError(err.message || 'Erro ao definir nova senha.');
        } finally {
          btnSubmitStep3.disabled = false;
          btnSubmitStep3.innerHTML = '<span>Salvar Nova Senha e Concluir</span>';
        }
      });
    }

    // ETAPA 4: Conclusão e Redirecionamento para Login
    if (btnProceedToLogin) {
      btnProceedToLogin.addEventListener('click', () => {
        if (recoveryState.timerInterval) clearInterval(recoveryState.timerInterval);
        modalRecuperarSenha.style.display = 'none';
        identificadorInput.value = recoveryState.identificador;
        senhaInput.value = '';
        senhaInput.focus();
      });
    }
  }
});
