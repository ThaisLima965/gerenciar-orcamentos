import app from './src/app.js';
import { initDatabase, saveDatabase } from './src/config/database.js';
import dotenv from 'dotenv';

dotenv.config();

const PORT = process.env.PORT || 3000;

async function startServer() {
  try {
    console.log('🚀 Iniciando Plataforma Corporativa de Gerenciamento de Orçamentos...');
    
    // Inicializa o banco de dados e aplica schemas e seeds
    await initDatabase();

    const server = app.listen(PORT, () => {
      console.log(`\n===============================================================`);
      console.log(`⚡ Servidor corporativo rodando com sucesso!`);
      console.log(`🌐 URL Local: http://localhost:${PORT}`);
      console.log(`🔐 Autenticação: JWT em Cookies HttpOnly + Proteção CSRF`);
      console.log(`👥 Perfis RBAC: TÉCNICO, SUPERVISOR, CONSULTORA (Admin)`);
      console.log(`===============================================================\n`);
    });

    // Tratamento de encerramento gracioso (salvando banco SQLite)
    const handleShutdown = () => {
      console.log('\n🛑 Encerrando servidor e salvando estado do banco de dados...');
      saveDatabase();
      server.close(() => {
        console.log('✅ Servidor finalizado com segurança.');
        process.exit(0);
      });
    };

    process.on('SIGINT', handleShutdown);
    process.on('SIGTERM', handleShutdown);

  } catch (error) {
    console.error('❌ Falha ao iniciar servidor:', error);
    process.exit(1);
  }
}

startServer();
