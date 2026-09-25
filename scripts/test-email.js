import dotenv from 'dotenv';
import { verifySmtpConnection, sendPasswordResetEmail } from '../src/services/emailService.js';

dotenv.config();

async function testSmtp() {
  console.log('🔍 Testando conexão com o servidor SMTP corporativo...');
  console.log('   Host:', process.env.SMTP_HOST || '(não definido)');
  console.log('   Porta:', process.env.SMTP_PORT || '587');
  console.log('   Usuário:', process.env.SMTP_USER || '(não definido)');
  console.log('   Seguro (SSL/TLS):', process.env.SMTP_SECURE || 'false');
  console.log('   Remetente:', process.env.SMTP_FROM || '(padrão)');
  console.log('--------------------------------------------------');

  const verification = await verifySmtpConnection();

  if (!verification.configured) {
    console.log('⚠️ [SMTP não configurado]:', verification.message);
    console.log('👉 Preencha as variáveis SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS no arquivo .env.');
    process.exit(1);
  }

  if (!verification.connected) {
    console.error('❌ [Falha de Autenticação/Conexão]:', verification.error);
    console.log('👉 Verifique se o Host, Porta, Usuário e Senha estão corretos e se a rede não bloqueia a porta.');
    process.exit(1);
  }

  console.log('✅ [Sucesso]: Conexão SMTP autenticada com sucesso!');

  const targetEmail = process.argv[2] || process.env.SMTP_USER;
  if (targetEmail) {
    console.log(`📧 Enviando e-mail de teste para: ${targetEmail}...`);
    const result = await sendPasswordResetEmail({
      nome: 'Thaís Lima',
      email: targetEmail,
      matricula: '55011190',
      senhaProvisoria: 'Tke@849201'
    });

    if (result.mode === 'smtp') {
      console.log('🎉 E-mail enviado com sucesso para a caixa de entrada!');
    } else {
      console.log('ℹ️ E-mail processado em modo simulado:', result);
    }
  }
}

testSmtp();
