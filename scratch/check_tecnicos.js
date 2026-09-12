import { initDatabase, db } from '../src/config/database.js';

async function checkTecnicos() {
  await initDatabase();
  const allTecnicos = db.prepare('SELECT matricula, nome_sobrenome, email, funcao FROM tecnicos').all();
  console.log('Total tecnicos in tecnicos table:', allTecnicos.length);
  const tkeTecnicos = allTecnicos.filter(t => t.email && t.email.includes('@tkelevator.com'));
  console.log('TKE tecnicos in tecnicos table:', tkeTecnicos.length);
  
  const allOrcamentos = db.prepare('SELECT id, matricula_tecnico, nome_tecnico, numero_pgo, numero_orcamento FROM chamados_orcamentos').all();
  console.log('Total orçamentos in chamados_orcamentos table:', allOrcamentos.length);
  console.log('Orcamentos sample:', allOrcamentos.slice(0, 10));

  const allClientes = db.prepare('SELECT numero_contrato, nome_cliente FROM clientes').all();
  console.log('Total clientes:', allClientes.length);
  console.log('Clientes sample:', allClientes.slice(0, 10));

  process.exit(0);
}

checkTecnicos();
