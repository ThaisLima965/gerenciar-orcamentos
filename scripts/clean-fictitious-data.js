import { initDatabase, db, saveDatabase } from '../src/config/database.js';

async function cleanFictitiousData() {
  console.log('🧹 Limpando todos os dados fictícios do banco de dados...');
  await initDatabase();

  // 1. Excluir chamados/orçamentos de teste e fictícios
  const delOrc = db.prepare(`
    DELETE FROM chamados_orcamentos 
    WHERE matricula_tecnico IN ('1001', '1002', '1003', '1004', '1005', '1006', '1007', '1008')
       OR matricula_tecnico LIKE 'TEC-%'
       OR matricula_tecnico LIKE '88%'
       OR matricula_tecnico = '9991'
       OR numero_pgo LIKE 'PGO-2026-88%'
       OR numero_pgo LIKE 'PGO-TEST-%'
       OR numero_contrato LIKE 'CT-2024-%'
       OR numero_contrato LIKE 'CT-TEST-%'
  `).run();
  console.log(`   🗑️ Orçamentos fictícios excluídos: ${delOrc.changes}`);

  // 2. Excluir clientes fictícios (CT-2024-*, CT-TEST-*)
  const delCli = db.prepare(`
    DELETE FROM clientes 
    WHERE numero_contrato LIKE 'CT-2024-%'
       OR numero_contrato LIKE 'CT-TEST-%'
       OR nome_cliente LIKE '%Hospital Central Santa Clara%'
       OR nome_cliente LIKE '%Indústrias MetalSul%'
       OR nome_cliente LIKE '%Shopping Plaza Norte%'
       OR nome_cliente LIKE '%Rede PharmaVida%'
       OR nome_cliente LIKE '%Logística Express Brasil%'
       OR nome_cliente LIKE '%Centro Corporativo Faria Lima%'
       OR nome_cliente LIKE '%Edifício Empresarial Paulista%'
       OR nome_cliente LIKE '%Condomínio Grand Tower%'
       OR nome_cliente LIKE '%Tech Park Alphaville%'
       OR nome_cliente LIKE '%Complexo Logístico Aeroporto%'
       OR nome_cliente LIKE '%Novo Centro Médico Morumbi%'
       OR nome_cliente LIKE '%Condomínio Prime Office%'
  `).run();
  console.log(`   🗑️ Clientes fictícios excluídos: ${delCli.changes}`);

  // 3. Excluir técnicos fictícios (1001-1008, TEC-*, etc.)
  const delTec = db.prepare(`
    DELETE FROM tecnicos 
    WHERE matricula IN ('1001', '1002', '1003', '1004', '1005', '1006', '1007', '1008')
       OR matricula LIKE 'TEC-%'
       OR matricula LIKE '88%'
       OR matricula = '9991'
       OR email LIKE '%@empresa.com'
  `).run();
  console.log(`   🗑️ Técnicos fictícios excluídos: ${delTec.changes}`);

  // 4. Excluir usuários fictícios (Camila, Carlos Albuquerque, Thiago Silva, 1001-1008, @empresa.com)
  const delUsr = db.prepare(`
    DELETE FROM usuarios 
    WHERE matricula IN ('CONS001', 'SUP001', '1001', '1002', '1003', '1004', '1005', '1006', '1007', '1008')
       OR email LIKE '%@empresa.com'
       OR matricula LIKE 'USR-TEST-%'
       OR nome LIKE '%Camila Mendes%'
       OR nome LIKE '%Carlos Albuquerque%'
  `).run();
  console.log(`   🗑️ Usuários fictícios excluídos: ${delUsr.changes}`);

  // 5. Garantir que os usuários reais de TKE tenham suas senhas configuradas (Senha@12345 / Tke@1234)
  const defaultHash = '$2b$10$lPjOSXnA8CF1F7RjTd7OY.4w5FwMNgtfpnL6PrGvTXNzUYHDUCRy6'; // Senha@12345

  // Garante Thaís Lima (Consultora)
  const thais = db.prepare('SELECT id FROM usuarios WHERE matricula = ? OR LOWER(email) = ?').get('55011190', 'thais.lima@tkelevator.com');
  if (thais) {
    db.prepare(`
      UPDATE usuarios 
      SET nome = 'Thaís Lima', email = 'thais.lima@tkelevator.com', matricula = '55011190', perfil = 'CONSULTORA', grupo = 'G11', senha_hash = ?, primeiro_acesso = 0, ativo = 1
      WHERE id = ?
    `).run(defaultHash, thais.id);
  } else {
    db.prepare(`
      INSERT INTO usuarios (nome, email, matricula, senha_hash, perfil, grupo, primeiro_acesso, ativo)
      VALUES ('Thaís Lima', 'thais.lima@tkelevator.com', '55011190', ?, 'CONSULTORA', 'G11', 0, 1)
    `).run(defaultHash);
  }

  // Garante Supervisores TKE
  const supervisors = [
    { matricula: '55007886', nome: 'GENILSO RIBEIRO MENDES', email: 'genilso.mendes@tkelevator.com', grupo: 'G11' },
    { matricula: '55012476', nome: 'JOSEMAR ORLANDINI', email: 'josemar.orlandini@tkelevator.com', grupo: 'G06' },
    { matricula: '55021156', nome: 'MARCO ANTONIO ARANHA SALGADO FILHO', email: 'marco.filho@tkelevator.com', grupo: 'G05' }
  ];

  for (const sup of supervisors) {
    const existing = db.prepare('SELECT id FROM usuarios WHERE matricula = ? OR LOWER(email) = ?').get(sup.matricula, sup.email.toLowerCase());
    if (existing) {
      db.prepare(`
        UPDATE usuarios 
        SET nome = ?, email = ?, matricula = ?, perfil = 'SUPERVISOR', grupo = ?, senha_hash = ?, primeiro_acesso = 0, ativo = 1
        WHERE id = ?
      `).run(sup.nome, sup.email, sup.matricula, sup.grupo, defaultHash, existing.id);
    } else {
      db.prepare(`
        INSERT INTO usuarios (nome, email, matricula, senha_hash, perfil, grupo, primeiro_acesso, ativo)
        VALUES (?, ?, ?, ?, 'SUPERVISOR', ?, 0, 1)
      `).run(sup.nome, sup.email, sup.matricula, defaultHash, sup.grupo);
    }
  }

  saveDatabase();

  // 6. Relatório do estado atual
  console.log('\n📊 Estado atual do banco de dados após a limpeza:');
  console.log(`   👥 Usuários: ${db.prepare('SELECT COUNT(*) as c FROM usuarios').get().c}`);
  console.log(`   🔧 Técnicos: ${db.prepare('SELECT COUNT(*) as c FROM tecnicos').get().c}`);
  console.log(`   🏢 Clientes: ${db.prepare('SELECT COUNT(*) as c FROM clientes').get().c}`);
  console.log(`   📋 Orçamentos: ${db.prepare('SELECT COUNT(*) as c FROM chamados_orcamentos').get().c}`);

  console.log('\n👥 Usuários cadastrados no sistema:');
  const users = db.prepare('SELECT id, matricula, nome, email, perfil, grupo, ativo FROM usuarios ORDER BY perfil DESC, nome ASC').all();
  users.forEach(u => console.log(`   - [${u.perfil}] ${u.matricula} - ${u.nome} (${u.email}) - Grupo: ${u.grupo} - Ativo: ${u.ativo}`));

  console.log('\n🏢 Clientes cadastrados no sistema:');
  const clients = db.prepare('SELECT numero_contrato, nome_cliente FROM clientes').all();
  clients.forEach(c => console.log(`   - Contrato: ${c.numero_contrato} - Cliente: ${c.nome_cliente}`));

  console.log('\n✅ Limpeza concluída com sucesso!');
}

cleanFictitiousData().catch(err => {
  console.error('❌ Erro:', err);
  process.exit(1);
});
