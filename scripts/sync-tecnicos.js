import { initDatabase, db, saveDatabase } from '../src/config/database.js';

async function syncTecnicos() {
  console.log('🔄 Sincronizando e atualizando base oficial de técnicos TKE...');
  await initDatabase();

  // 1. Lista oficial de técnicos e colaboradores de campo TKE
  const tecnicosOficiais = [
    // Técnicos TKE - Grupo G11
    { matricula: '55011768', funcao: 'Técnico Preventivo', nome_sobrenome: 'CAIO CEZAR SILVA', email: 'caio.silva2@tkelevator.com', telefone: null, grupo: 'G11' },
    { matricula: '55021126', funcao: 'Técnico Preventivo', nome_sobrenome: 'LEONARDO MENEZES SILVERIO', email: 'leonardo.silverio@tkelevator.com', telefone: null, grupo: 'G11' },
    { matricula: '55018256', funcao: 'Técnico Preventivo', nome_sobrenome: 'GABRIEL HENRIQUE DA SILVA SANTOS', email: 'gabriel.santos1@tkelevator.com', telefone: null, grupo: 'G11' },
    { matricula: '55018990', funcao: 'Técnico Preventivo', nome_sobrenome: 'GUILHERME JUAN DOUETTS', email: 'guilherme.douetts@tkelevator.com', telefone: null, grupo: 'G11' },
    { matricula: '55012528', funcao: 'Técnico Preventivo', nome_sobrenome: 'JOAO LUCAS COSTA DO CARMO', email: 'joao.carmo@tkelevator.com', telefone: null, grupo: 'G11' },
    { matricula: '55020162', funcao: 'Técnico Preventivo', nome_sobrenome: 'RODRIGO DE OLIVEIRA MACHADO', email: 'rodrigo.machado@tkelevator.com', telefone: null, grupo: 'G11' },
    { matricula: '55019331', funcao: 'Técnico Corretivo', nome_sobrenome: 'GUILHERME GONÇALVES MURCA', email: 'guilherme.murca@tkelevator.com', telefone: null, grupo: 'G11' },
    { matricula: '55011402', funcao: 'Técnico Corretivo', nome_sobrenome: 'ALAN BATISTA BARBOSA BARROS', email: 'alan.barros@tkelevator.com', telefone: null, grupo: 'G11' },
    { matricula: '55011011', funcao: 'Técnico Corretivo', nome_sobrenome: 'SIDNEI SANTOS POLICARPO', email: 'sidnei.policarpo@tkelevator.com', telefone: null, grupo: 'G11' },

    // Técnicos TKE - Grupo G06
    { matricula: '55007503', funcao: 'Técnico Preventivo', nome_sobrenome: 'ARQUIMEDES PIRES DA SILVA', email: 'arquimedes.silva@tkelevator.com', telefone: null, grupo: 'G06' },
    { matricula: '55015408', funcao: 'Técnico Preventivo', nome_sobrenome: 'ALBENES SILVA CHAGAS', email: 'albenes.chagas@tkelevator.com', telefone: null, grupo: 'G06' },
    { matricula: '55008491', funcao: 'Técnico Preventivo', nome_sobrenome: 'MARCELO SEIJI HIRATSUKA', email: 'marcelo.hiratsuka@tkelevator.com', telefone: null, grupo: 'G06' },
    { matricula: '55018920', funcao: 'Técnico Preventivo', nome_sobrenome: 'BRUNO FERREIRA CORREIA DE SOUZA', email: 'bruno.souza2@tkelevator.com', telefone: null, grupo: 'G06' },
    { matricula: '55019205', funcao: 'Técnico Preventivo', nome_sobrenome: 'REGINALDO TAVARES FERREIRA', email: 'reginaldo.ferreira@tkelevator.com', telefone: null, grupo: 'G06' },
    { matricula: '55011293', funcao: 'Técnico Residente', nome_sobrenome: 'ANDERSON VINICIUS DO NASCIMENTO', email: 'anderson.nascimento@tkelevator.com', telefone: null, grupo: 'G06' },
    { matricula: '55012716', funcao: 'Técnico Corretivo', nome_sobrenome: 'DENIS CAMPOS ALVES LUIZ COSTA', email: 'denis.costa@tkelevator.com', telefone: null, grupo: 'G06' },
    { matricula: '55003302', funcao: 'Técnico Corretivo', nome_sobrenome: 'RONALDO LOPES DA COSTA', email: 'ronaldo.costa@tkelevator.com', telefone: null, grupo: 'G06' },
    { matricula: '55010003', funcao: 'Técnico Corretivo', nome_sobrenome: 'SERGIO DA SILVA SOUZA', email: 'sergio.souza@tkelevator.com', telefone: null, grupo: 'G06' },
    { matricula: '55016366', funcao: 'Técnico Corretivo', nome_sobrenome: 'VINICIUS BARBOSA BALTAZAR DA SILVA', email: 'vinicius.silva@tkelevator.com', telefone: null, grupo: 'G06' },

    // Técnicos TKE - Grupo G05
    { matricula: '55007943', funcao: 'Técnico Preventivo', nome_sobrenome: 'CARLOS FELIPE DA SILVA LEMOS', email: 'carlos.lemos@tkelevator.com', telefone: null, grupo: 'G05' },
    { matricula: '55006730', funcao: 'Técnico Preventivo', nome_sobrenome: 'GILVAN JOAQUIM DE SOUSA', email: 'gilvan.sousa@tkelevator.com', telefone: null, grupo: 'G05' },
    { matricula: '55014054', funcao: 'Técnico Preventivo', nome_sobrenome: 'ISMAEL GONCALVES DOS SANTOS', email: 'ismael.santos2@tkelevator.com', telefone: null, grupo: 'G05' },
    { matricula: '55012050', funcao: 'Técnico Preventivo', nome_sobrenome: 'JEFFERSON BARBOSA GRIGORIO', email: 'jefferson.grigorio@tkelevator.com', telefone: null, grupo: 'G05' },
    { matricula: '55013973', funcao: 'Técnico Preventivo', nome_sobrenome: 'JEFFERSON SOUZA MARQUES', email: 'jefferson.marques@tkelevator.com', telefone: null, grupo: 'G05' },
    { matricula: '55020622', funcao: 'Técnico Preventivo', nome_sobrenome: 'EMERSON DA SILVA NASCIMENTO IKEDA', email: 'emerson.ikeda@tkelevator.com', telefone: null, grupo: 'G05' },
    { matricula: '55002462', funcao: 'Técnico Corretivo', nome_sobrenome: 'FERNANDO DE MENDONCA COSTA', email: 'fernando.costa@tkelevator.com', telefone: null, grupo: 'G05' },
    { matricula: '55018175', funcao: 'Técnico Corretivo', nome_sobrenome: 'GABRIEL NASCIMENTO DE OLIVEIRA', email: 'gabriel.oliveira@tkelevator.com', telefone: null, grupo: 'G05' },
    { matricula: '55010811', funcao: 'Técnico Corretivo', nome_sobrenome: 'RODRIGO ALVES DA SILVA', email: 'rodrigo.silva3@tkelevator.com', telefone: null, grupo: 'G05' }
  ];

  // 2. Limpa registros fictícios e temporários
  db.prepare(`
    DELETE FROM tecnicos 
    WHERE matricula IN ('1001', '1002', '1003', '1004', '1005', '1006', '1007', '1008')
       OR matricula LIKE 'TEC-%' 
       OR matricula LIKE '88%' 
       OR matricula = '9991'
       OR email LIKE '%@empresa.com'
  `).run();

  // 3. Insere / Atualiza os técnicos oficiais
  const defaultHash = '$2b$10$lPjOSXnA8CF1F7RjTd7OY.4w5FwMNgtfpnL6PrGvTXNzUYHDUCRy6'; // Senha@12345

  for (const tec of tecnicosOficiais) {
    db.prepare(`
      INSERT OR REPLACE INTO tecnicos (matricula, funcao, nome_sobrenome, email, telefone)
      VALUES (?, ?, ?, ?, ?)
    `).run(tec.matricula, tec.funcao, tec.nome_sobrenome, tec.email, tec.telefone);

    const existingUser = db.prepare('SELECT id FROM usuarios WHERE matricula = ?').get(tec.matricula);
    if (!existingUser) {
      db.prepare(`
        INSERT INTO usuarios (nome, email, matricula, senha_hash, perfil, grupo, primeiro_acesso, ativo)
        VALUES (?, ?, ?, ?, 'TECNICO', ?, 0, 1)
      `).run(tec.nome_sobrenome, tec.email, tec.matricula, defaultHash, tec.grupo);
    } else {
      db.prepare(`
        UPDATE usuarios 
        SET nome = ?, email = COALESCE(?, email), grupo = ?
        WHERE matricula = ?
      `).run(tec.nome_sobrenome, tec.email, tec.grupo, tec.matricula);
    }
  }

  saveDatabase();
  console.log(`✅ Base de técnicos sincronizada com sucesso! Total: ${tecnicosOficiais.length} técnicos cadastrados.`);
}

syncTecnicos().catch(err => {
  console.error('❌ Erro na sincronização de técnicos:', err);
  process.exit(1);
});
