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
  // CONTROLADOR DO MODAL DE RECUPERAÇÃO DE SENHA VIA TOTP / 2FA (RFC 6238)
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

  // Elementos da Etapa 1 (Identificação)
  const forgotStep1 = document.getElementById('forgot-step-1');
  const forgotStep1Form = document.getElementById('forgot-step1-form');
  const forgotIdentificadorInput = document.getElementById('forgot-identificador');
  const btnSubmitStep1 = document.getElementById('btn-submit-step1');
  const btnCancelForgot = document.getElementById('btn-cancel-forgot');

  // Elementos da Etapa 2-A (Token TOTP 6 Dígitos)
  const forgotStep2 = document.getElementById('forgot-step-2');
  const forgotStep2Form = document.getElementById('forgot-step2-form');
  const forgotOtpInput = document.getElementById('forgot-otp-input');
  const step2UserName = document.getElementById('step2-user-name');
  const btnToggleBackup = document.getElementById('btn-toggle-backup');
  const btnBackToStep1 = document.getElementById('btn-back-to-step1');
  const btnSubmitStep2 = document.getElementById('btn-submit-step2');

  // Elementos da Etapa 2-B (Setup Inicial de Pareamento QR Code)
  const forgotStepSetup = document.getElementById('forgot-step-setup');
  const forgotSetupForm = document.getElementById('forgot-setup-form');
  const totpSetupQrcodeImg = document.getElementById('totp-setup-qrcode-img');
  const totpSetupManualKey = document.getElementById('totp-setup-manual-key');
  const btnCopyManualKey = document.getElementById('btn-copy-manual-key');
  const totpSetupOtpInput = document.getElementById('totp-setup-otp-input');
  const btnSetupBackToStep1 = document.getElementById('btn-setup-back-to-step1');
  const btnSubmitSetup = document.getElementById('btn-submit-setup');

  // Elementos da Etapa 2-C (Código de Backup de Emergência)
  const forgotStepBackup = document.getElementById('forgot-step-backup');
  const forgotBackupForm = document.getElementById('forgot-backup-form');
  const forgotBackupInput = document.getElementById('forgot-backup-input');
  const btnBackToTotp = document.getElementById('btn-back-to-totp');
  const btnBackupBackToStep1 = document.getElementById('btn-backup-back-to-step1');
  const btnSubmitBackup = document.getElementById('btn-submit-backup');

  // Elementos da Etapa 3 (Definição de Nova Senha)
  const forgotStep3 = document.getElementById('forgot-step-3');
  const forgotStep3Form = document.getElementById('forgot-step3-form');
  const forgotNovaSenha = document.getElementById('forgot-nova-senha');
  const forgotConfirmarNovaSenha = document.getElementById('forgot-confirmar-nova-senha');
  const toggleForgotNovaSenha = document.getElementById('toggle-forgot-nova-senha');
  const toggleForgotConfirmarSenha = document.getElementById('toggle-forgot-confirmar-senha');
  const btnSubmitStep3 = document.getElementById('btn-submit-step3');

  // Elementos da Etapa 4 (Sucesso e Códigos de Backup)
  const forgotStep4 = document.getElementById('forgot-step-4');
  const forgotBackupCodesContainer = document.getElementById('forgot-backup-codes-display-container');
  const forgotBackupCodesGrid = document.getElementById('forgot-backup-codes-grid');
  const btnCopyAllBackupCodes = document.getElementById('btn-copy-all-backup-codes');
  const btnDownloadBackupCodes = document.getElementById('btn-download-backup-codes');
  const btnProceedToLogin = document.getElementById('btn-proceed-to-login');

  // Configura botões de visualização de senha no formulário de reset
  setupPasswordToggle(toggleForgotNovaSenha, forgotNovaSenha);
  setupPasswordToggle(toggleForgotConfirmarSenha, forgotConfirmarNovaSenha);

  // Estado da sessão de recuperação
  let recoveryState = {
    identificador: '',
    userName: '',
    resetTicket: '',
    manualKey: '',
    backupCodes: []
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

  function goToStep(step) {
    hideAlerts();
    if (forgotStep1) forgotStep1.style.display = step === 1 ? 'block' : 'none';
    if (forgotStep2) forgotStep2.style.display = step === 2 ? 'block' : 'none';
    if (forgotStepSetup) forgotStepSetup.style.display = step === 'setup' ? 'block' : 'none';
    if (forgotStepBackup) forgotStepBackup.style.display = step === 'backup' ? 'block' : 'none';
    if (forgotStep3) forgotStep3.style.display = step === 3 ? 'block' : 'none';
    if (forgotStep4) forgotStep4.style.display = step === 4 ? 'block' : 'none';

    if (step === 1) {
      if (forgotModalIcon) forgotModalIcon.className = 'bi bi-shield-lock-fill';
      if (forgotModalTitle) forgotModalTitle.textContent = 'Recuperação com Autenticador';
      if (forgotModalSubtitle) forgotModalSubtitle.textContent = 'Informe seu e-mail corporativo ou matrícula para validar sua conta.';
      if (forgotIdentificadorInput) {
        forgotIdentificadorInput.value = identificadorInput.value.trim() || '';
        setTimeout(() => forgotIdentificadorInput.focus(), 150);
      }
    } else if (step === 2) {
      if (forgotModalIcon) forgotModalIcon.className = 'bi bi-phone-fill';
      if (forgotModalTitle) forgotModalTitle.textContent = 'Código do Autenticador (2FA)';
      if (forgotModalSubtitle) forgotModalSubtitle.textContent = 'Abra seu app autenticador (Google Authenticator, Apple Passwords ou Authy) e digite o código de 6 dígitos.';
      if (step2UserName) step2UserName.textContent = recoveryState.userName || 'Usuário Identificado';
      if (forgotOtpInput) {
        forgotOtpInput.value = '';
        setTimeout(() => forgotOtpInput.focus(), 150);
      }
    } else if (step === 'setup') {
      if (forgotModalIcon) forgotModalIcon.className = 'bi bi-qr-code-scan';
      if (forgotModalTitle) forgotModalTitle.textContent = 'Configurar App Autenticador';
      if (forgotModalSubtitle) forgotModalSubtitle.textContent = 'Como é seu primeiro acesso, configure a segurança em 2 etapas no seu celular.';
      if (totpSetupOtpInput) {
        totpSetupOtpInput.value = '';
        setTimeout(() => totpSetupOtpInput.focus(), 150);
      }
    } else if (step === 'backup') {
      if (forgotModalIcon) forgotModalIcon.className = 'bi bi-key-fill';
      if (forgotModalTitle) forgotModalTitle.textContent = 'Código de Backup de Emergência';
      if (forgotModalSubtitle) forgotModalSubtitle.textContent = 'Digite um dos seus códigos de emergência de 8 dígitos cadastrados anteriormente.';
      if (forgotBackupInput) {
        forgotBackupInput.value = '';
        setTimeout(() => forgotBackupInput.focus(), 150);
      }
    } else if (step === 3) {
      if (forgotModalIcon) forgotModalIcon.className = 'bi bi-key-fill';
      if (forgotModalTitle) forgotModalTitle.textContent = 'Cadastrar Nova Senha';
      if (forgotModalSubtitle) forgotModalSubtitle.textContent = 'Identidade validada com sucesso! Cadastre agora sua nova senha pessoal.';
      if (forgotNovaSenha) forgotNovaSenha.value = '';
      if (forgotConfirmarNovaSenha) forgotConfirmarNovaSenha.value = '';
      setTimeout(() => forgotNovaSenha && forgotNovaSenha.focus(), 150);
    } else if (step === 4) {
      if (forgotModalIcon) forgotModalIcon.className = 'bi bi-check-circle-fill';
      if (forgotModalTitle) forgotModalTitle.textContent = 'Senha Alterada com Sucesso!';
      if (forgotModalSubtitle) forgotModalSubtitle.textContent = 'Tudo pronto! Sua nova senha foi sincronizada com segurança.';

      // Se gerou códigos de backup no primeiro pareamento, exibe na tela final
      if (recoveryState.backupCodes && recoveryState.backupCodes.length > 0) {
        if (forgotBackupCodesGrid) {
          forgotBackupCodesGrid.innerHTML = recoveryState.backupCodes.map(code => `
            <div style="padding: 0.35rem 0.5rem; background: #F1F5F9; border-radius: 4px; letter-spacing: 0.1rem;">
              ${code}
            </div>
          `).join('');
        }
        if (forgotBackupCodesContainer) {
          forgotBackupCodesContainer.style.display = 'block';
        }
      } else {
        if (forgotBackupCodesContainer) {
          forgotBackupCodesContainer.style.display = 'none';
        }
      }
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
        modalRecuperarSenha.style.display = 'none';
      });
    }

    if (btnBackToStep1) {
      btnBackToStep1.addEventListener('click', () => goToStep(1));
    }
    if (btnSetupBackToStep1) {
      btnSetupBackToStep1.addEventListener('click', () => goToStep(1));
    }
    if (btnBackupBackToStep1) {
      btnBackupBackToStep1.addEventListener('click', () => goToStep(1));
    }

    // Toggle para código de backup
    if (btnToggleBackup) {
      btnToggleBackup.addEventListener('click', () => goToStep('backup'));
    }
    if (btnBackToTotp) {
      btnBackToTotp.addEventListener('click', () => goToStep(2));
    }

    // Copiar Chave Manual Base32
    if (btnCopyManualKey && totpSetupManualKey) {
      btnCopyManualKey.addEventListener('click', async () => {
        const key = recoveryState.manualKey || totpSetupManualKey.textContent;
        if (!key) return;
        try {
          await navigator.clipboard.writeText(key);
          const originalText = btnCopyManualKey.innerHTML;
          btnCopyManualKey.innerHTML = '<i class="bi bi-check2"></i> Copiado!';
          btnCopyManualKey.classList.add('btn-success');
          setTimeout(() => {
            btnCopyManualKey.innerHTML = originalText;
            btnCopyManualKey.classList.remove('btn-success');
          }, 2000);
        } catch {
          showInfo(`Chave copiada: ${key}`);
        }
      });
    }

    // Copiar Todos os Códigos de Backup
    if (btnCopyAllBackupCodes) {
      btnCopyAllBackupCodes.addEventListener('click', async () => {
        if (!recoveryState.backupCodes || !recoveryState.backupCodes.length) return;
        const text = `CÓDIGOS DE BACKUP DE EMERGÊNCIA (TKE ORÇAMENTOS):\n\n` + 
          recoveryState.backupCodes.join('\n') + 
          `\n\nGuarde em local seguro. Cada código é de uso único.`;
        try {
          await navigator.clipboard.writeText(text);
          btnCopyAllBackupCodes.innerHTML = '<i class="bi bi-check2"></i> Copiados!';
          setTimeout(() => {
            btnCopyAllBackupCodes.innerHTML = '<i class="bi bi-clipboard"></i> Copiar Todos';
          }, 2000);
        } catch {
          alert(text);
        }
      });
    }

    // Baixar Códigos de Backup em arquivo .txt
    if (btnDownloadBackupCodes) {
      btnDownloadBackupCodes.addEventListener('click', () => {
        if (!recoveryState.backupCodes || !recoveryState.backupCodes.length) return;
        const text = `CÓDIGOS DE BACKUP DE EMERGÊNCIA (TKE ORÇAMENTOS)\n` +
          `Usuário: ${recoveryState.identificador}\n` +
          `Data: ${new Date().toLocaleString('pt-BR')}\n\n` +
          recoveryState.backupCodes.map((c, i) => `${i + 1}. ${c}`).join('\n') +
          `\n\nATENÇÃO: Guarde em local seguro. Cada código é de uso único caso você perca o acesso ao app autenticador.`;
        
        const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `codigos-backup-tke-${recoveryState.identificador.replace(/[^a-zA-Z0-9]/g, '_')}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      });
    }

    // =========================================================================
    // ETAPA 1: Identificação do Usuário
    // =========================================================================
    if (forgotStep1Form) {
      forgotStep1Form.addEventListener('submit', async (e) => {
        e.preventDefault();
        hideAlerts();

        const ident = forgotIdentificadorInput.value.trim();
        if (!ident) {
          showError('Por favor, informe seu e-mail corporativo ou matrícula.');
          return;
        }

        btnSubmitStep1.disabled = true;
        btnSubmitStep1.innerHTML = '<i class="bi bi-arrow-repeat spin"></i> <span>Verificando...</span>';

        try {
          const res = await auth.forgotPassword(ident);
          recoveryState.identificador = ident;
          recoveryState.userName = res.user_name || '';

          if (res.needs_setup) {
            // Usuário ainda não tem TOTP configurado -> Exibe QR Code
            recoveryState.manualKey = res.manual_key || '';
            if (totpSetupQrcodeImg && res.qr_code) {
              totpSetupQrcodeImg.src = res.qr_code;
            }
            if (totpSetupManualKey && res.manual_key) {
              totpSetupManualKey.textContent = res.manual_key;
            }
            goToStep('setup');
          } else {
            // Usuário já possui TOTP ativo -> Pede o código de 6 dígitos
            goToStep(2);
          }
        } catch (err) {
          showError(err.message || 'Falha ao solicitar verificação.');
        } finally {
          btnSubmitStep1.disabled = false;
          btnSubmitStep1.innerHTML = '<span>Avançar</span>';
        }
      });
    }

    // =========================================================================
    // ETAPA 2-A: Validação do Código TOTP de 6 Dígitos
    // =========================================================================
    if (forgotStep2Form) {
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
          showError('Por favor, digite o código completo de 6 dígitos do app autenticador.');
          return;
        }

        btnSubmitStep2.disabled = true;
        btnSubmitStep2.innerHTML = '<i class="bi bi-arrow-repeat spin"></i> <span>Validando...</span>';

        try {
          const res = await auth.verifyToken(recoveryState.identificador, otp);
          recoveryState.resetTicket = res.reset_ticket;
          goToStep(3);
        } catch (err) {
          showError(err.message || 'Código incorreto ou expirado. Verifique no app autenticador.');
        } finally {
          btnSubmitStep2.disabled = false;
          btnSubmitStep2.innerHTML = '<span>Validar Código</span>';
        }
      });
    }

    // =========================================================================
    // ETAPA 2-B: Confirmação do Setup Inicial (QR Code)
    // =========================================================================
    if (forgotSetupForm) {
      if (totpSetupOtpInput) {
        totpSetupOtpInput.addEventListener('input', (e) => {
          e.target.value = e.target.value.replace(/\D/g, '').slice(0, 6);
        });
      }

      forgotSetupForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        hideAlerts();

        const otp = totpSetupOtpInput.value.trim();
        if (!otp || otp.length !== 6) {
          showError('Por favor, digite o código de 6 dígitos gerado pelo app autenticador.');
          return;
        }

        btnSubmitSetup.disabled = true;
        btnSubmitSetup.innerHTML = '<i class="bi bi-arrow-repeat spin"></i> <span>Confirmando Pareamento...</span>';

        try {
          const res = await auth.verifyToken(recoveryState.identificador, otp);
          recoveryState.resetTicket = res.reset_ticket;
          if (res.backup_codes) {
            recoveryState.backupCodes = res.backup_codes;
          }
          goToStep(3);
        } catch (err) {
          showError(err.message || 'Código de pareamento incorreto. Verifique o código no seu app.');
        } finally {
          btnSubmitSetup.disabled = false;
          btnSubmitSetup.innerHTML = '<span>Confirmar Pareamento</span>';
        }
      });
    }

    // =========================================================================
    // ETAPA 2-C: Validação via Código de Backup (8 dígitos)
    // =========================================================================
    if (forgotBackupForm) {
      if (forgotBackupInput) {
        forgotBackupInput.addEventListener('input', (e) => {
          let val = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
          if (val.length > 4) {
            val = val.slice(0, 4) + '-' + val.slice(4, 8);
          }
          e.target.value = val.slice(0, 9);
        });
      }

      forgotBackupForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        hideAlerts();

        const backupCode = forgotBackupInput.value.trim();
        if (!backupCode || backupCode.replace(/[^A-Z0-9]/g, '').length < 8) {
          showError('Por favor, digite o código de backup completo de 8 dígitos (ex: ABCD-1234).');
          return;
        }

        btnSubmitBackup.disabled = true;
        btnSubmitBackup.innerHTML = '<i class="bi bi-arrow-repeat spin"></i> <span>Validando Código...</span>';

        try {
          const res = await auth.verifyToken(recoveryState.identificador, backupCode);
          recoveryState.resetTicket = res.reset_ticket;
          goToStep(3);
        } catch (err) {
          showError(err.message || 'Código de backup inválido ou já utilizado.');
        } finally {
          btnSubmitBackup.disabled = false;
          btnSubmitBackup.innerHTML = '<span>Validar Código</span>';
        }
      });
    }

    // =========================================================================
    // ETAPA 3: Persistência da Nova Senha
    // =========================================================================
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

    // =========================================================================
    // ETAPA 4: Conclusão e Redirecionamento para Login
    // =========================================================================
    if (btnProceedToLogin) {
      btnProceedToLogin.addEventListener('click', () => {
        modalRecuperarSenha.style.display = 'none';
        identificadorInput.value = recoveryState.identificador;
        senhaInput.value = '';
        senhaInput.focus();
      });
    }
  }
});
