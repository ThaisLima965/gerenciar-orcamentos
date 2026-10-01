import { initDatabase, db } from '../src/config/database.js';

async function inspect() {
  await initDatabase();
  console.log('=== USUARIOS ===');
  console.log(db.prepare('SELECT id, nome, email, matricula, perfil, ativo, primeiro_acesso, grupo FROM usuarios').all());
  
  console.log('\n=== TECNICOS ===');
  console.log(db.prepare('SELECT matricula, nome_sobrenome, email, funcao FROM tecnicos').all());

  console.log('\n=== CLIENTES ===');
  console.log(db.prepare('SELECT numero_contrato, nome_cliente FROM clientes').all());

  console.log('\n=== ORCAMENTOS ===');
  console.log(db.prepare('SELECT id, matricula_tecnico, nome_tecnico, numero_pgo, numero_orcamento FROM chamados_orcamentos').all());
  
  process.exit(0);
}

inspect();
