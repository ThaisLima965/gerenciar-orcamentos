import { initDatabase, db, saveDatabase } from '../src/config/database.js';

const baseData = [
  { gFuncao: '06 - SUPERVISOR', matricula: '55012476', nome: 'JOSEMAR ORLANDINI', email: 'josemar.orlandini@tkelevator.com', grupo: 'G06', perfil: 'SUPERVISOR', funcao: 'Supervisor' },
  { gFuncao: '06 - PREVENTIVO', matricula: '55007503', nome: 'ARQUIMEDES PIRES DA SILVA', email: 'arquimedes.silva@tkelevator.com', grupo: 'G06', perfil: 'TECNICO', funcao: 'Preventivo' },
  { gFuncao: '06 - PREVENTIVO', matricula: '55015408', nome: 'ALBENES SILVA CHAGAS', email: 'albenes.chagas@tkelevator.com', grupo: 'G06', perfil: 'TECNICO', funcao: 'Preventivo' },
  { gFuncao: '06 - PREVENTIVO', matricula: '55008491', nome: 'MARCELO SEIJI HIRATSUKA', email: 'marcelo.hiratsuka@tkelevator.com', grupo: 'G06', perfil: 'TECNICO', funcao: 'Preventivo' },
  { gFuncao: '06 - PREVENTIVO', matricula: '55018920', nome: 'BRUNO FERREIRA CORREIA DE SOUZA', email: 'bruno.souza2@tkelevator.com', grupo: 'G06', perfil: 'TECNICO', funcao: 'Preventivo' },
  { gFuncao: '06 - PREVENTIVO', matricula: '55019205', nome: 'REGINALDO TAVARES FERREIRA', email: 'reginaldo.ferreira@tkelevator.com', grupo: 'G06', perfil: 'TECNICO', funcao: 'Preventivo' },
  { gFuncao: '06 - RESIDENTE', matricula: '55011293', nome: 'ANDERSON VINICIUS DO NASCIMENTO', email: 'anderson.nascimento@tkelevator.com', grupo: 'G06', perfil: 'TECNICO', funcao: 'Residente' },
  { gFuncao: '06 - CORRETIVO', matricula: '55012716', nome: 'DENIS CAMPOS ALVES LUIZ COSTA', email: 'denis.costa@tkelevator.com', grupo: 'G06', perfil: 'TECNICO', funcao: 'Corretivo' },
  { gFuncao: '06 - CORRETIVO', matricula: '55003302', nome: 'RONALDO LOPES DA COSTA', email: 'ronaldo.costa@tkelevator.com', grupo: 'G06', perfil: 'TECNICO', funcao: 'Corretivo' },
  { gFuncao: '06 - CORRETIVO', matricula: '55010003', nome: 'SERGIO DA SILVA SOUZA', email: 'sergio.souza@tkelevator.com', grupo: 'G06', perfil: 'TECNICO', funcao: 'Corretivo' },
  { gFuncao: '06 - CORRETIVO', matricula: '55016366', nome: 'VINICIUS BARBOSA BALTAZAR DA SILVA', email: 'vinicius.silva@tkelevator.com', grupo: 'G06', perfil: 'TECNICO', funcao: 'Corretivo' },

  { gFuncao: '05 - SUPERVISOR', matricula: '55021156', nome: 'MARCO ANTONIO ARANHA SALGADO FILHO', email: 'marco.filho@tkelevator.com', grupo: 'G05', perfil: 'SUPERVISOR', funcao: 'Supervisor' },
  { gFuncao: '05 - PREVENTIVO', matricula: '55007943', nome: 'CARLOS FELIPE DA SILVA LEMOS', email: 'carlos.lemos@tkelevator.com', grupo: 'G05', perfil: 'TECNICO', funcao: 'Preventivo' },
  { gFuncao: '05 - PREVENTIVO', matricula: '55006730', nome: 'GILVAN JOAQUIM DE SOUSA', email: 'gilvan.sousa@tkelevator.com', grupo: 'G05', perfil: 'TECNICO', funcao: 'Preventivo' },
  { gFuncao: '05 - PREVENTIVO', matricula: '55014054', nome: 'ISMAEL GONCALVES DOS SANTOS', email: 'ismael.santos2@tkelevator.com', grupo: 'G05', perfil: 'TECNICO', funcao: 'Preventivo' },
  { gFuncao: '05 - PREVENTIVO', matricula: '55012050', nome: 'JEFFERSON BARBOSA GRIGORIO', email: 'jefferson.grigorio@tkelevator.com', grupo: 'G05', perfil: 'TECNICO', funcao: 'Preventivo' },
  { gFuncao: '05 - PREVENTIVO', matricula: '55013973', nome: 'JEFFERSON SOUZA MARQUES', email: 'jefferson.marques@tkelevator.com', grupo: 'G05', perfil: 'TECNICO', funcao: 'Preventivo' },
  { gFuncao: '05 - PREVENTIVO', matricula: '55020622', nome: 'EMERSON DA SILVA NASCIMENTO IKEDA', email: 'emerson.ikeda@tkelevator.com', grupo: 'G05', perfil: 'TECNICO', funcao: 'Preventivo' },
  { gFuncao: '05 - CORRETIVO', matricula: '55002462', nome: 'FERNANDO DE MENDONCA COSTA', email: 'fernando.costa@tkelevator.com', grupo: 'G05', perfil: 'TECNICO', funcao: 'Corretivo' },
  { gFuncao: '05 - CORRETIVO', matricula: '55018175', nome: 'GABRIEL NASCIMENTO DE OLIVEIRA', email: 'gabriel.oliveira@tkelevator.com', grupo: 'G05', perfil: 'TECNICO', funcao: 'Corretivo' },
  { gFuncao: '05 - CORRETIVO', matricula: '55010811', nome: 'RODRIGO ALVES DA SILVA', email: 'rodrigo.silva3@tkelevator.com', grupo: 'G05', perfil: 'TECNICO', funcao: 'Corretivo' },

  { gFuncao: '11 - SUPERVISOR', matricula: '55007886', nome: 'GENILSO RIBEIRO MENDES', email: 'genilso.mendes@tkelevator.com', grupo: 'G11', perfil: 'SUPERVISOR', funcao: 'Supervisor' },
  { gFuncao: '11 - PREVENTIVO', matricula: '55011768', nome: 'CAIO CEZAR SILVA', email: 'caio.silva2@tkelevator.com', grupo: 'G11', perfil: 'TECNICO', funcao: 'Preventivo' },
  { gFuncao: '11 - PREVENTIVO', matricula: '55021126', nome: 'LEONARDO MENEZES SILVERIO', email: 'leonardo.silverio@tkelevator.com', grupo: 'G11', perfil: 'TECNICO', funcao: 'Preventivo' },
  { gFuncao: '11 - PREVENTIVO', matricula: '55018256', nome: 'GABRIEL HENRIQUE DA SILVA SANTOS', email: 'gabriel.santos1@tkelevator.com', grupo: 'G11', perfil: 'TECNICO', funcao: 'Preventivo' },
  { gFuncao: '11 - PREVENTIVO', matricula: '55018990', nome: 'GUILHERME JUAN DOUETTS', email: 'guilherme.douetts@tkelevator.com', grupo: 'G11', perfil: 'TECNICO', funcao: 'Preventivo' },
  { gFuncao: '11 - PREVENTIVO', matricula: '55012528', nome: 'JOAO LUCAS COSTA DO CARMO', email: 'joao.carmo@tkelevator.com', grupo: 'G11', perfil: 'TECNICO', funcao: 'Preventivo' },
  { gFuncao: '11 - PREVENTIVO', matricula: '55020162', nome: 'RODRIGO DE OLIVEIRA MACHADO', email: 'rodrigo.machado@tkelevator.com', grupo: 'G11', perfil: 'TECNICO', funcao: 'Preventivo' },
  { gFuncao: '11 - CORRETIVO', matricula: '55019331', nome: 'GUILHERME GONÇALVES MURCA', email: 'guilherme.murca@tkelevator.com', grupo: 'G11', perfil: 'TECNICO', funcao: 'Corretivo' },
  { gFuncao: '11 - CORRETIVO', matricula: '55011402', nome: 'ALAN BATISTA BARBOSA BARROS', email: 'alan.barros@tkelevator.com', grupo: 'G11', perfil: 'TECNICO', funcao: 'Corretivo' },
  { gFuncao: '11 - CORRETIVO', matricula: '55011011', nome: 'SIDNEI SANTOS POLICARPO', email: 'sidnei.policarpo@tkelevator.com', grupo: 'G11', perfil: 'TECNICO', funcao: 'Corretivo' }
];

async function syncBaseData() {
  await initDatabase();

  for (const item of baseData) {
    // 1. Atualiza ou insere na tabela usuarios
    const usr = db.prepare('SELECT id FROM usuarios WHERE matricula = ? OR LOWER(email) = ?').get(item.matricula, item.email.toLowerCase());
    if (usr) {
      db.prepare('UPDATE usuarios SET nome = ?, email = ?, matricula = ?, grupo = ?, perfil = ? WHERE id = ?').run(
        item.nome,
        item.email.toLowerCase(),
        item.matricula,
        item.grupo,
        item.perfil,
        usr.id
      );
    }

    // 2. Atualiza ou insere na tabela tecnicos
    const tec = db.prepare('SELECT matricula FROM tecnicos WHERE matricula = ? OR LOWER(email) = ?').get(item.matricula, item.email.toLowerCase());
    if (tec) {
      db.prepare('UPDATE tecnicos SET matricula = ?, nome_sobrenome = ?, email = ?, funcao = ? WHERE matricula = ?').run(
        item.matricula,
        item.nome,
        item.email.toLowerCase(),
        item.funcao,
        tec.matricula
      );
    } else {
      db.prepare('INSERT INTO tecnicos (matricula, funcao, nome_sobrenome, email) VALUES (?, ?, ?, ?)').run(
        item.matricula,
        item.funcao,
        item.nome,
        item.email.toLowerCase()
      );
    }
  }

  saveDatabase();
  console.log('✅ Base de 31 colaboradores sincronizada com sucesso no banco de dados!');
  process.exit(0);
}

syncBaseData();
