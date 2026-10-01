import { initDatabase, db, saveDatabase } from '../src/config/database.js';

async function cleanFictitiousData() {
  await initDatabase();

  console.log('--- INICIANDO LIMPEZA DE CADASTROS FICTÍCIOS ---');

  // 1. Limpar Colaboradores Fictícios em `usuarios`
  // Remove registros com @empresa.com, email 'e-mail' ou matricula 'Matricula'
  // Preserva apenas usuários reais (@tkelevator.com) e contas que não sejam os mocks de teste
  const fakeUsers = db.prepare(`
    SELECT id, nome, email, matricula FROM usuarios 
    WHERE email LIKE '%@empresa.com' 
       OR email = 'e-mail' 
       OR matricula = 'Matricula'
       OR email LIKE 'carlos.teste%'
  `).all();
  
  console.log(`\nColaboradores fictícios encontrados em 'usuarios' (${fakeUsers.length}):`);
  fakeUsers.forEach(u => console.log(` - ID: ${u.id} | ${u.nome} (${u.email}) [Matrícula: ${u.matricula}]`));

  db.prepare(`
    DELETE FROM usuarios 
    WHERE email LIKE '%@empresa.com' 
       OR email = 'e-mail' 
       OR matricula = 'Matricula'
       OR email LIKE 'carlos.teste%'
  `).run();

  // 2. Limpar Técnicos Fictícios em `tecnicos`
  const fakeTecnicos = db.prepare(`
    SELECT matricula, nome_sobrenome, email FROM tecnicos 
    WHERE email NOT LIKE '%@tkelevator.com' 
       OR email IS NULL 
       OR matricula LIKE 'TEC-%' 
       OR matricula LIKE 'TEC0%'
       OR matricula IN ('9999', '9991', '7788', '8894', '8815', '8803', '8873', '8885', '8855', '9001', '9002', '1001', '1002', '1003', '1004', '1005', '1006', '1007', '1008', '1009', '1010')
  `).all();

  console.log(`\nTécnicos fictícios encontrados em 'tecnicos' (${fakeTecnicos.length}):`);
  fakeTecnicos.forEach(t => console.log(` - Matrícula: ${t.matricula} | ${t.nome_sobrenome} (${t.email || 'sem email'})`));

  db.prepare(`
    DELETE FROM tecnicos 
    WHERE email NOT LIKE '%@tkelevator.com' 
       OR email IS NULL 
       OR matricula LIKE 'TEC-%' 
       OR matricula LIKE 'TEC0%'
       OR matricula IN ('9999', '9991', '7788', '8894', '8815', '8803', '8873', '8885', '8855', '9001', '9002', '1001', '1002', '1003', '1004', '1005', '1006', '1007', '1008', '1009', '1010')
  `).run();

  // 3. Limpar Orçamentos Fictícios de Teste
  const fakeOrcamentos = db.prepare(`
    SELECT id, numero_pgo, nome_tecnico, numero_orcamento FROM chamados_orcamentos
    WHERE numero_pgo LIKE 'PGO-TEST%'
       OR numero_pgo LIKE 'PGO-AUTO%'
       OR matricula_tecnico NOT IN (SELECT matricula FROM usuarios)
  `).all();

  console.log(`\nOrçamentos fictícios encontrados (${fakeOrcamentos.length}):`);
  fakeOrcamentos.forEach(o => console.log(` - ID: ${o.id} | PGO: ${o.numero_pgo} | Técnico: ${o.nome_tecnico} | Orçamento: ${o.numero_orcamento}`));

  db.prepare(`
    DELETE FROM chamados_orcamentos
    WHERE numero_pgo LIKE 'PGO-TEST%'
       OR numero_pgo LIKE 'PGO-AUTO%'
       OR matricula_tecnico NOT IN (SELECT matricula FROM usuarios)
  `).run();

  // 4. Limpar Clientes de Teste Fictícios
  db.prepare(`
    DELETE FROM clientes 
    WHERE numero_contrato LIKE 'CT-TEST%' 
       OR numero_contrato LIKE 'CTR-2026%' 
       OR numero_contrato LIKE 'CT-2024%'
  `).run();

  saveDatabase();

  console.log('\n--- RESUMO APÓS LIMPEZA ---');
  const remainingUsers = db.prepare('SELECT id, nome, email, matricula, perfil FROM usuarios').all();
  console.log(`Total de Colaboradores Reais Ativos (${remainingUsers.length}):`);
  remainingUsers.forEach(u => console.log(` ✅ ${u.nome} | ${u.email} | Matrícula: ${u.matricula} | Perfil: ${u.perfil}`));

  const remainingTecnicos = db.prepare('SELECT matricula, nome_sobrenome, email FROM tecnicos').all();
  console.log(`\nTotal de Técnicos na tabela 'tecnicos' (${remainingTecnicos.length}):`);

  process.exit(0);
}

cleanFictitiousData();
