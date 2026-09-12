import http from 'http';
import * as xlsx from 'xlsx';
import app from '../src/app.js';
import { initDatabase, db } from '../src/config/database.js';

let server;
const PORT = 3099;
const BASE_URL = `http://localhost:${PORT}`;

async function runTests() {
  console.log('🧪 ========================================================');
  console.log('🧪 INICIANDO BATERIA DE TESTES AUTOMATIZADOS (RBAC, SEEDS & IMPORT)');
  console.log('🧪 ========================================================\n');

  await initDatabase();

  // Garante estado limpo e senhas padronizadas para os 3 usuários de teste (ID 1, 2, 3)
  const defaultHash = '$2b$10$lPjOSXnA8CF1F7RjTd7OY.4w5FwMNgtfpnL6PrGvTXNzUYHDUCRy6'; // Senha@12345
  db.prepare("UPDATE usuarios SET senha_hash = ?, primeiro_acesso = 0, ativo = 1 WHERE id IN (1, 2, 3)").run(defaultHash);

  server = app.listen(PORT);
  console.log(`📡 Servidor de testes rodando na porta ${PORT}`);

  try {
    // 1. Teste de Integridade do Banco de Dados e Seeds
    console.log('\n🔍 [1/7] Testando Integridade das Tabelas e Seeds Iniciais...');
    const tables = db.exec("SELECT name FROM sqlite_master WHERE type='table'");
    const tableNames = tables[0].values.map(v => v[0]);
    assert(tableNames.includes('usuarios'), 'Tabela usuarios deve existir');
    assert(tableNames.includes('clientes'), 'Tabela clientes deve existir');
    assert(tableNames.includes('tecnicos'), 'Tabela tecnicos deve existir');
    assert(tableNames.includes('chamados_orcamentos'), 'Tabela chamados_orcamentos deve existir');
    
    // Verifica 10 clientes de seed (CT-2024-001 a CT-2024-010)
    const clientesRes = db.prepare('SELECT COUNT(*) as count FROM clientes').get();
    assert(clientesRes.count >= 10, 'Devem existir pelo menos 10 clientes iniciais');
    
    const cli01 = db.prepare('SELECT * FROM clientes WHERE numero_contrato = ?').get('CT-2024-001');
    assert(cli01 && cli01.nome_cliente.startsWith('Hospital Central Santa Clara'), 'Cliente CT-2024-001 deve ser Hospital Central Santa Clara');

    // Verifica 8 técnicos de seed (1001 a 1008)
    const tecnicosRes = db.prepare('SELECT COUNT(*) as count FROM tecnicos').get();
    assert(tecnicosRes.count >= 8, 'Devem existir pelo menos 8 técnicos iniciais');

    const tec01 = db.prepare('SELECT * FROM tecnicos WHERE matricula = ?').get('1001');
    assert(tec01 && tec01.nome_sobrenome.startsWith('Thiago Silva Santos'), 'Técnico 1001 deve ser Thiago Silva Santos');
    assert(tec01 && tec01.funcao && tec01.funcao.length > 0, 'Técnico 1001 deve ter uma função cadastrada');

    console.log(`   ✅ Banco verificado: ${clientesRes.count} Clientes, ${tecnicosRes.count} Técnicos cadastrados.`);

    // 2. Teste de Login com Senha Padrão (Senha@12345)
    console.log('\n🔍 [2/7] Testando Autenticação com Senha@12345 e Matrícula...');
    
    // Login com senha incorreta
    const badLogin = await postJson('/api/auth/login', { identificador: 'consultora@empresa.com', senha: 'SenhaErrada' });
    assert(badLogin.res.statusCode === 401, 'Login com senha errada deve retornar 401');
    console.log('   ✅ Rejeição correta de credenciais inválidas (401).');

    // Login com Consultora (Senha@12345)
    const consultoraLogin = await postJson('/api/auth/login', { identificador: 'consultora@empresa.com', senha: 'Senha@12345' });
    assert(consultoraLogin.res.statusCode === 200, 'Login da consultora com Senha@12345 deve retornar 200');
    assert(consultoraLogin.body.user.perfil === 'CONSULTORA', 'Perfil deve ser CONSULTORA');
    const consultoraCookie = extractCookies(consultoraLogin.res);
    const consultoraCsrf = consultoraLogin.body.csrfToken;
    console.log('   ✅ Login de Consultora (consultora@empresa.com / Senha@12345) bem-sucedido.');

    // Login com Supervisor (Senha@12345)
    const supervisorLogin = await postJson('/api/auth/login', { identificador: 'supervisor@empresa.com', senha: 'Senha@12345' });
    assert(supervisorLogin.res.statusCode === 200, 'Login do supervisor com Senha@12345 deve retornar 200');
    assert(supervisorLogin.body.user.perfil === 'SUPERVISOR', 'Perfil deve ser SUPERVISOR');
    const supervisorCookie = extractCookies(supervisorLogin.res);
    const supervisorCsrf = supervisorLogin.body.csrfToken;
    console.log('   ✅ Login de Supervisor (supervisor@empresa.com / Senha@12345) bem-sucedido.');

    // Login com Técnico usando Matrícula '1001' (Senha@12345)
    const tecnicoMatriculaLogin = await postJson('/api/auth/login', { identificador: '1001', senha: 'Senha@12345' });
    assert(tecnicoMatriculaLogin.res.statusCode === 200, 'Login do técnico por matrícula 1001 deve retornar 200');
    assert(tecnicoMatriculaLogin.body.user.perfil === 'TECNICO', 'Perfil deve ser TECNICO');
    assert(tecnicoMatriculaLogin.body.user.matricula === '1001', 'Matrícula do técnico deve ser 1001');
    const tecnicoCookie = extractCookies(tecnicoMatriculaLogin.res);
    const tecnicoCsrf = tecnicoMatriculaLogin.body.csrfToken;
    console.log('   ✅ Login de Técnico por matrícula (1001 / Senha@12345) bem-sucedido.');

    // 3. Teste de RBAC no Módulo de Importação & Exportação (Permitido para Consultora e Supervisor, Bloqueado para Técnico)
    console.log('\n🔍 [3/7] Testando RBAC de Permissão (Exclusivo Consultora e Supervisor, Bloqueado Técnico)...');
    
    // Técnico tentando importar clientes -> 403
    const tecImportCli = await postMultipart('/api/clientes/import', 'clientes.csv', 'Numero_Contrato,Nome_Cliente\nCT-X,Cliente X', tecnicoCookie, tecnicoCsrf);
    assert(tecImportCli.res.statusCode === 403, 'Técnico tentando importar clientes deve receber 403 Forbidden');
    
    // Técnico tentando exportar relatório -> 403
    const tecExportRes = await getRaw('/api/relatorios/premiacao/export?ciclo=2025/2026&mes=acumulado', {
      Cookie: tecnicoCookie
    });
    assert(tecExportRes.res.statusCode === 403, 'Técnico tentando exportar relatório deve receber 403 Forbidden');

    // Supervisor tentando importar técnicos -> 200
    const supImportTec = await postMultipart('/api/tecnicos/import', 'tecnicos.csv', 'Matricula,Funcao,Nome_Completo\n9991,Técnico de Manutenção,Supervisor Teste Insercao', supervisorCookie, supervisorCsrf);
    assert(supImportTec.res.statusCode === 200, 'Supervisor deve ter permissão para importar técnicos (200 OK)');

    // Supervisor tentando exportar relatório -> 200
    const supExportRes = await getRaw('/api/relatorios/premiacao/export?ciclo=2025/2026&mes=acumulado', {
      Cookie: supervisorCookie
    });
    assert(supExportRes.res.statusCode === 200, 'Supervisor deve ter permissão para exportar relatório Excel (200 OK)');
    
    console.log('   ✅ Perfil Técnico bloqueado (403 Forbidden) e Perfis Consultora/Supervisor autorizados (200 OK).');

    // 4. Teste de Importação de Planilha Excel/CSV de Clientes com Tratamento de Duplicados (UPSERT)
    console.log('\n🔍 [4/7] Testando Importação de Clientes (.xlsx) pela Consultora com UPSERT...');
    
    const uniqueTime = Date.now();
    const clientesTestData = [
      { Numero_Contrato: 'CT-2024-001', Nome_Cliente: 'Hospital Central Santa Clara - ALTA COMPLEXIDADE (Atualizado)' },
      { Numero_Contrato: `CT-TEST-${uniqueTime}-1`, Nome_Cliente: 'Novo Centro Médico Morumbi' },
      { Numero_Contrato: `CT-TEST-${uniqueTime}-2`, Nome_Cliente: 'Condomínio Prime Office' }
    ];
    const wsClientes = xlsx.utils.json_to_sheet(clientesTestData);
    const wbClientes = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(wbClientes, wsClientes, 'Clientes');
    const xlsxBufferClientes = xlsx.write(wbClientes, { type: 'buffer', bookType: 'xlsx' });

    const consImportCliRes = await postMultipart('/api/clientes/import', 'novos_clientes.xlsx', xlsxBufferClientes, consultoraCookie, consultoraCsrf);
    assert(consImportCliRes.res.statusCode === 200, `Importação de clientes deve retornar 200, recebido: ${consImportCliRes.res.statusCode}`);
    assert(consImportCliRes.body.success === true, 'Importação deve retornar success: true');
    assert(consImportCliRes.body.stats.inserted === 2, 'Devem ser 2 novos clientes inseridos');
    assert(consImportCliRes.body.stats.updated === 1, 'Deve ser 1 cliente atualizado (UPSERT)');
    assert(consImportCliRes.body.stats.errorsCount === 0, 'Não deve haver erros de validação');

    // Valida no banco se o registro foi atualizado
    const updatedCli = db.prepare('SELECT nome_cliente FROM clientes WHERE numero_contrato = ?').get('CT-2024-001');
    assert(updatedCli.nome_cliente.includes('Atualizado'), 'Nome do cliente deve ter sido atualizado no banco');
    console.log('   ✅ Importação de Clientes (.xlsx) processada com sucesso: 2 inseridos, 1 atualizado.');

    // 5. Teste de Importação de Planilha de Técnicos com Formato CSV
    console.log('\n🔍 [5/7] Testando Importação de Técnicos (.csv) pela Consultora com UPSERT...');
    
    const tecnicosCsvContent = 
      'Matricula;Funcao;Nome_Sobrenome;Email;Telefone\r\n' +
      '1001;Técnico Master;Thiago Silva Santos (Técnico Master);thiago.master@empresa.com;(11) 98765-4321\r\n' +
      `TEC-${uniqueTime}-1;Técnico Especialista;Bruno Henrique Martins;bruno.martins@empresa.com;(11) 98765-4329\r\n` +
      `TEC-${uniqueTime}-2;Técnica Residente;Fernanda Ribeiro Castro;fernanda.castro@empresa.com;(11) 98765-4330`;

    const consImportTecRes = await postMultipart('/api/tecnicos/import', 'tecnicos_novos.csv', tecnicosCsvContent, consultoraCookie, consultoraCsrf);
    assert(consImportTecRes.res.statusCode === 200, `Importação de técnicos deve retornar 200, recebido: ${consImportTecRes.res.statusCode}`);
    assert(consImportTecRes.body.success === true, 'Importação deve retornar success: true');
    assert(consImportTecRes.body.stats.inserted === 2, 'Devem ser 2 novos técnicos inseridos');
    assert(consImportTecRes.body.stats.updated === 1, 'Deve ser 1 técnico atualizado (UPSERT)');

    const updatedTec = db.prepare('SELECT nome_sobrenome FROM tecnicos WHERE matricula = ?').get('1001');
    assert(updatedTec.nome_sobrenome.includes('Master'), 'Nome do técnico 1001 deve ter sido atualizado');
    console.log('   ✅ Importação de Técnicos (.csv) processada com sucesso: 2 inseridos, 1 atualizado.');

    // 6. Teste de Download de Modelos Oficiais de Planilha
    console.log('\n🔍 [6/7] Testando Endpoints de Download de Modelos (.xlsx e .csv)...');
    const templateCliXlsx = await getRaw('/api/clientes/template?format=xlsx', { Cookie: consultoraCookie });
    assert(templateCliXlsx.res.statusCode === 200, 'Download modelo clientes .xlsx deve retornar 200');

    const templateTecCsv = await getRaw('/api/tecnicos/template?format=csv', { Cookie: consultoraCookie });
    assert(templateTecCsv.res.statusCode === 200, 'Download modelo técnicos .csv deve retornar 200');
    console.log('   ✅ Endpoints de download de modelos (.xlsx e .csv) testados com sucesso.');

    // 7. Teste de Fluxo Completo de Orçamentos, Formulário 3 Seções e Travas RBAC
    console.log('\n🔍 [7/7] Testando Formulário 3 Seções, Autocomplete e Travas Estritas RBAC...');
    
    // Teste de validação: G de Origem inválido (deve retornar 400)
    const invalidG = await postJson('/api/orcamentos', {
      numero_contrato: 'CT-2024-001',
      nome_cliente: 'Hospital Central Santa Clara',
      tipo_servico: 'Corretivo',
      numero_pgo: `PGO-TEST-${Date.now()}-INV`,
      g_origem: 'G99',
      numero_orcamento: 'ORC-AUTO-2026',
      descricao_servico: 'Teste de validação de G de origem inválido'
    }, {
      Cookie: tecnicoCookie,
      'X-CSRF-Token': tecnicoCsrf
    });
    assert(invalidG.res.statusCode === 400, 'G de Origem inválido deve retornar 400');
    console.log('   ✅ Validação de G de Origem inválido (400) confirmada.');

    // 7.1. Criação de chamado pelo Técnico (Preenchimento da Seção 1)
    const pgoTecnico = `PGO-TEST-${Date.now()}`;
    const novoChamado = await postJson('/api/orcamentos', {
      numero_contrato: 'CT-2024-001',
      tipo_servico: 'Corretivo',
      numero_pgo: pgoTecnico,
      g_origem: 'G06',
      descricao_servico: 'Troca de cabos de tração e encoder'
    }, {
      Cookie: tecnicoCookie,
      'X-CSRF-Token': tecnicoCsrf
    });
    assert(novoChamado.res.statusCode === 201, 'Criação de chamado pelo técnico deve retornar 201');
    assert(novoChamado.body.data.nome_cliente.startsWith('Hospital Central Santa Clara'), 'Nome do cliente deve ser resolvido automaticamente');
    assert(novoChamado.body.data.matricula_tecnico === '1001', 'Matrícula do técnico deve ser vinculada automaticamente');
    assert(novoChamado.body.data.g_origem === 'G06', 'G de Origem deve ser G06');
    const chamadoId = novoChamado.body.data.id;
    console.log('   ✅ Seção 1 preenchida e salva pelo Técnico com resolução automática de cliente.');

    // 7.2. Trava Rígida do Técnico: após salvar, o registro torna-se SOMENTE LEITURA (PUT bloqueado com 403)
    const tecUpdate = await putJson(`/api/orcamentos/${chamadoId}`, {
      descricao_servico: 'Tentativa de alteração indevida pelo técnico'
    }, {
      Cookie: tecnicoCookie,
      'X-CSRF-Token': tecnicoCsrf
    });
    assert(tecUpdate.res.statusCode === 403, 'Técnico tentando editar chamado gravado deve receber 403 Forbidden');
    console.log('   ✅ Bloqueio rígido do Técnico após gravação confirmado (403 Forbidden).');

    // 7.3. Supervisor tentando alterar Seção 3 (Data Envio ao Cliente ou Valor Total) -> Bloqueado com 403
    const supBlockedUpdate = await putJson(`/api/orcamentos/${chamadoId}`, {
      data_envio_cliente: '2026-09-06'
    }, {
      Cookie: supervisorCookie,
      'X-CSRF-Token': supervisorCsrf
    });
    assert(supBlockedUpdate.res.statusCode === 403, 'Supervisor tentando alterar Data Envio deve receber 403');

    const supBlockedValor = await putJson(`/api/orcamentos/${chamadoId}`, {
      valor_total: 1500.00
    }, {
      Cookie: supervisorCookie,
      'X-CSRF-Token': supervisorCsrf
    });
    assert(supBlockedValor.res.statusCode === 403, 'Supervisor tentando alterar Valor Total do orçamento deve receber 403 Forbidden');
    console.log('   ✅ Bloqueio do Supervisor para campos da Seção 3 (Data de Envio e Valor Total) confirmado (403 Forbidden).');

    // 7.4. Supervisor preenchendo a Seção 2 (Nº Orçamento, Data Liberação e GEOR Liberou: Sim)
    const supValidUpdate = await putJson(`/api/orcamentos/${chamadoId}`, {
      numero_orcamento: 'ORC-SUP-2026/01',
      geor_liberou: 'Sim',
      data_liberacao: '2026-09-06'
    }, {
      Cookie: supervisorCookie,
      'X-CSRF-Token': supervisorCsrf
    });
    assert(supValidUpdate.res.statusCode === 200, 'Supervisor deve salvar Seção 2 com sucesso');
    assert(supValidUpdate.body.data.geor_liberou === 'Sim', 'GEOR deve estar como Sim');
    assert(supValidUpdate.body.data.status === 'Liberado GEOR', 'Status deve atualizar para Liberado GEOR');
    console.log('   ✅ Seção 2 preenchida e salva pelo Supervisor com sucesso.');

    // 7.5. Trava do Supervisor: após salvar GEOR, torna-se SOMENTE LEITURA para o Supervisor
    const supSecondUpdate = await putJson(`/api/orcamentos/${chamadoId}`, {
      numero_orcamento: 'ORC-ALTERADO'
    }, {
      Cookie: supervisorCookie,
      'X-CSRF-Token': supervisorCsrf
    });
    assert(supSecondUpdate.res.statusCode === 403, 'Supervisor tentando editar após GEOR salvo deve receber 403');
    console.log('   ✅ Bloqueio de re-edição do Supervisor após liberação GEOR confirmado (403 Forbidden).');

    // 7.6. Consultora (Admin) com Acesso Irrestrito: Atualiza Seções 1, 2 e 3 (incluindo Valor Total e Data Envio)
    const consUpdate = await putJson(`/api/orcamentos/${chamadoId}`, {
      g_origem: 'G05',
      valor_total: 2450.75,
      data_envio_cliente: '2026-09-06',
      status: 'Enviado ao Cliente'
    }, {
      Cookie: consultoraCookie,
      'X-CSRF-Token': consultoraCsrf
    });
    assert(consUpdate.res.statusCode === 200, 'Consultora deve atualizar qualquer seção');
    assert(consUpdate.body.data.valor_total === 2450.75, 'Valor Total deve ser atualizado pela Consultora para 2450.75');
    assert(consUpdate.body.data.data_envio_cliente === '2026-09-06', 'Data envio deve estar preenchida');
    assert(consUpdate.body.data.status === 'Enviado ao Cliente', 'Status deve ser Enviado ao Cliente');
    assert(consUpdate.body.data.g_origem === 'G05', 'G de Origem deve ser atualizado para G05');
    console.log('   ✅ Acesso irrestrito da Consultora em todas as 3 Seções (incluindo Valor Total) validado com sucesso.');

    // 8. Teste do Módulo de Dashboard & Apuração para Premiação com Ciclo Anual, Base Completa e Excel
    console.log('\n🔍 [8/8] Testando Dashboard de Premiação, Ciclo Anual (Out a Set), Base Completa (Zero Vendas) e Exportação Excel (.xlsx)...');
    
    // Consulta do Ciclo 2025/2026 Acumulado
    const premAcumulado = await getJson('/api/relatorios/premiacao?ciclo=2025/2026&mes=acumulado', {
      Cookie: consultoraCookie
    });
    assert(premAcumulado.res.statusCode === 200, 'Endpoint de premiação deve retornar 200');
    assert(premAcumulado.body.success === true, 'Resposta deve indicar success: true');
    assert(premAcumulado.body.periodo.dataInicio === '2025-10-01', 'Data inicial do ciclo deve ser 01/10/2025');
    assert(premAcumulado.body.periodo.dataFim === '2026-09-30', 'Data final do ciclo deve ser 30/09/2026');

    const totalTecnicosBase = db.prepare('SELECT COUNT(*) as count FROM tecnicos').get().count;
    assert(premAcumulado.body.ranking_preventivo.length === totalTecnicosBase, `Ranking Preventivo deve conter TODOS os ${totalTecnicosBase} técnicos da base via LEFT JOIN`);
    assert(premAcumulado.body.ranking_corretivo.length === totalTecnicosBase, `Ranking Corretivo deve conter TODOS os ${totalTecnicosBase} técnicos da base via LEFT JOIN`);

    // Verifica que técnicos sem vendas possuem obrigatoriamente 0
    const zeroVendasPrev = premAcumulado.body.ranking_preventivo.filter(t => t.qtd_aprovados === 0);
    assert(zeroVendasPrev.length > 0, 'Devem existir técnicos com 0 vendas no ranking preventivo');
    assert(zeroVendasPrev[0].valor_total === 0, 'Técnico sem vendas deve ter valor total igual a 0.00');

    // Verifica ordenação decrescente
    for (let i = 0; i < premAcumulado.body.ranking_preventivo.length - 1; i++) {
      const atual = premAcumulado.body.ranking_preventivo[i];
      const proximo = premAcumulado.body.ranking_preventivo[i + 1];
      assert(
        atual.qtd_aprovados > proximo.qtd_aprovados || 
        (atual.qtd_aprovados === proximo.qtd_aprovados && atual.valor_total >= proximo.valor_total) ||
        (atual.qtd_aprovados === proximo.qtd_aprovados && atual.valor_total === proximo.valor_total),
        'Ranking preventivo deve estar estritamente ordenado de forma decrescente'
      );
    }

    // Verifica KPIs
    const kpis = premAcumulado.body.kpis;
    assert(kpis.total_geral_qtd === (kpis.total_preventivo_qtd + kpis.total_corretivo_qtd), 'KPI total geral deve ser a soma de preventivo + corretivo');
    assert(kpis.total_geral_valor === (kpis.total_preventivo_valor + kpis.total_corretivo_valor), 'KPI total geral valor deve ser a soma dos valores');
    assert(kpis.total_tecnicos_cadastrados === totalTecnicosBase, 'Total de técnicos nos KPIs deve ser igual ao total de cadastrados');
    console.log(`   ✅ Dashboard apurado: ${kpis.total_geral_qtd} PGOs (${kpis.total_preventivo_qtd} Preventivo, ${kpis.total_corretivo_qtd} Corretivo), ${kpis.total_tecnicos_ativos}/${kpis.total_tecnicos_cadastrados} Técnicos Ativos.`);

    // Consulta de Mês Específico (Agosto = Mês 11 do ciclo 2025/2026)
    const premMesAgosto = await getJson('/api/relatorios/premiacao?ciclo=2025/2026&mes=08', {
      Cookie: consultoraCookie
    });
    assert(premMesAgosto.res.statusCode === 200, 'Consulta de mês específico deve retornar 200');
    assert(premMesAgosto.body.periodo.dataInicio === '2026-08-01', 'Data inicial de Agosto deve ser 2026-08-01');
    assert(premMesAgosto.body.periodo.dataFim === '2026-08-31', 'Data final de Agosto deve ser 2026-08-31');
    console.log('   ✅ Filtro por mês individual (08/2026: 01/08/2026 a 31/08/2026) validado.');

    // Teste de Exportação para Excel (.xlsx) com múltiplas abas
    console.log('   📊 Testando download e integridade da planilha Excel (.xlsx)...');
    const excelRes = await getRaw('/api/relatorios/premiacao/export?ciclo=2025/2026&mes=acumulado', {
      Cookie: consultoraCookie
    });
    assert(excelRes.res.statusCode === 200, 'Exportação Excel deve retornar HTTP 200');
    assert(
      excelRes.res.headers['content-type'].includes('spreadsheetml.sheet'),
      'Content-Type deve ser application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    
    // Parse do arquivo Excel gerado
    const parsedWb = xlsx.read(excelRes.buffer, { type: 'buffer' });
    assert(parsedWb.SheetNames.includes('Resumo Geral'), 'Planilha Excel deve conter a aba "Resumo Geral"');
    assert(parsedWb.SheetNames.includes('Ranking Preventivo'), 'Planilha Excel deve conter a aba "Ranking Preventivo"');
    assert(parsedWb.SheetNames.includes('Ranking Corretivo'), 'Planilha Excel deve conter a aba "Ranking Corretivo"');

    const wsPrev = parsedWb.Sheets['Ranking Preventivo'];
    const prevJson = xlsx.utils.sheet_to_json(wsPrev, { header: 1 });
    assert(prevJson.length >= 10, 'Aba Ranking Preventivo deve conter cabeçalho, todos os técnicos e totalizadores');
    console.log('   ✅ Planilha Excel gerada com sucesso com as 3 abas formatadas: Resumo Geral, Ranking Preventivo e Ranking Corretivo.');

    // 8. Teste do Módulo de Gestão de Usuários & Fluxo de Primeiro Acesso com Troca Obrigatória
    console.log('\n🔍 [8/8] Testando Gestão de Usuários, Primeiro Acesso e Troca Obrigatória de Senha...');

    // 8.1. Supervisor tentando listar/criar usuários -> 403
    const supListUsers = await getJson('/api/usuarios', { Cookie: supervisorCookie });
    assert(supListUsers.res.statusCode === 403, 'Supervisor tentando acessar gestão de usuários deve receber 403 Forbidden');
    console.log('   ✅ RBAC de Gestão de Usuários protegido contra acesso não autorizado (Supervisor bloqueado com 403).');

    // 8.2. Consultora lista usuários existentes
    const consultoraListUsers = await getJson('/api/usuarios', { Cookie: consultoraCookie });
    assert(consultoraListUsers.res.statusCode === 200, 'Consultora deve conseguir listar usuários (200 OK)');
    assert(Array.isArray(consultoraListUsers.body.data), 'Lista de usuários deve ser um array');
    console.log(`   ✅ Consultora listou ${consultoraListUsers.body.data.length} usuários com sucesso.`);

    // 8.3. Consultora cadastra novo Técnico com primeiro_acesso = 1 e grupo G06
    const testStamp = Date.now().toString().slice(-4);
    const testEmail = `carlos.teste.${testStamp}@empresa.com`;
    const testMatricula = `88${testStamp.slice(-2)}`;

    const novoColaboradorPayload = {
      nome: 'Carlos Eduardo Oliveira',
      email: testEmail,
      matricula: testMatricula,
      perfil: 'TECNICO',
      grupo: 'G06',
      senha_padrao: 'Tke@1234'
    };
    const createUserRes = await postJson('/api/usuarios', novoColaboradorPayload, {
      Cookie: consultoraCookie,
      'X-CSRF-Token': consultoraCsrf
    });
    assert(createUserRes.res.statusCode === 201, 'Cadastro de novo colaborador deve retornar 201 Created');
    assert(createUserRes.body.data.email === testEmail, 'E-mail do novo usuário deve coincidir');
    assert(createUserRes.body.data.primeiro_acesso === true || createUserRes.body.data.primeiro_acesso === 1, 'Novo usuário deve vir com primeiro_acesso = true');
    assert(createUserRes.body.data.grupo === 'G06', 'Grupo do novo usuário deve ser G06');
    const novoUserId = createUserRes.body.data.id;
    console.log(`   ✅ Colaborador criado com sucesso (ID #${novoUserId}) com flag primeiro_acesso: true e grupo G06.`);

    // 8.4. Novo colaborador faz login com a senha provisória Tke@1234
    const newColabLogin = await postJson('/api/auth/login', {
      identificador: testEmail,
      senha: 'Tke@1234'
    });
    assert(newColabLogin.res.statusCode === 200, 'Login inicial com senha provisória deve retornar 200 OK');
    assert(newColabLogin.body.primeiro_acesso === true, 'Flag primeiro_acesso no login deve ser true');
    assert(newColabLogin.body.user.primeiro_acesso === true, 'Flag primeiro_acesso no objeto user deve ser true');
    const newColabCookie = extractCookies(newColabLogin.res);
    const newColabCsrf = newColabLogin.body.csrfToken;
    console.log('   ✅ Login com senha provisória interceptado: flag primeiro_acesso === true confirmada.');

    // 8.5. Tentativas inválidas de troca de senha no primeiro acesso
    // Rejeição 1: Senha idêntica à padrão
    const failIdentical = await postJson('/api/auth/primeiro-acesso', {
      novaSenha: 'Tke@1234',
      confirmarNovaSenha: 'Tke@1234'
    }, {
      Cookie: newColabCookie,
      'X-CSRF-Token': newColabCsrf
    });
    assert(failIdentical.res.statusCode === 400, 'Troca para senha idêntica à provisória deve retornar 400');
    console.log('   ✅ Rejeição de senha nova idêntica à provisória validada.');

    // Rejeição 2: Senha fraca (< 6 caracteres)
    const failWeak = await postJson('/api/auth/primeiro-acesso', {
      novaSenha: '123ab',
      confirmarNovaSenha: '123ab'
    }, {
      Cookie: newColabCookie,
      'X-CSRF-Token': newColabCsrf
    });
    assert(failWeak.res.statusCode === 400, 'Troca para senha curta (<6 chars) deve retornar 400');
    console.log('   ✅ Rejeição de senha curta (<6 caracteres) validada.');

    // Rejeição 3: Confirmação divergente
    const failMismatch = await postJson('/api/auth/primeiro-acesso', {
      novaSenha: 'NovaSenha@2026',
      confirmarNovaSenha: 'Diferente@2026'
    }, {
      Cookie: newColabCookie,
      'X-CSRF-Token': newColabCsrf
    });
    assert(failMismatch.res.statusCode === 400, 'Troca com confirmação divergente deve retornar 400');
    console.log('   ✅ Rejeição de senhas divergentes validada.');

    // 8.6. Sucesso na Redefinição de Primeiro Acesso
    const successFirstAccess = await postJson('/api/auth/primeiro-acesso', {
      novaSenha: 'NovaSenha@2026',
      confirmarNovaSenha: 'NovaSenha@2026'
    }, {
      Cookie: newColabCookie,
      'X-CSRF-Token': newColabCsrf
    });
    assert(successFirstAccess.res.statusCode === 200, 'Redefinição válida deve retornar 200 OK');
    assert(successFirstAccess.body.primeiro_acesso === false, 'Flag primeiro_acesso deve ser atualizada para false');
    assert(successFirstAccess.body.user.primeiro_acesso === false, 'Flag primeiro_acesso no user retornado deve ser false');
    console.log('   ✅ Redefinição de Primeiro Acesso concluída com sucesso: senha atualizada e flag setada para false.');

    // 8.7. Novo login com a senha antiga deve falhar
    const oldPassLogin = await postJson('/api/auth/login', {
      identificador: testEmail,
      senha: 'Tke@1234'
    });
    assert(oldPassLogin.res.statusCode === 401, 'Login com senha provisória após a troca deve retornar 401');
    console.log('   ✅ Login com senha antiga rejeitado (401).');

    // 8.8. Novo login com a nova senha deve funcionar com primeiro_acesso = false
    const newPassLogin = await postJson('/api/auth/login', {
      identificador: testEmail,
      senha: 'NovaSenha@2026'
    });
    assert(newPassLogin.res.statusCode === 200, 'Login com nova senha pessoal deve retornar 200 OK');
    assert(newPassLogin.body.primeiro_acesso === false, 'primeiro_acesso deve ser false após troca');
    console.log('   ✅ Login com nova senha pessoal bem-sucedido com acesso pleno liberado.');

    // 8.9. Reset de Senha Administrativo pela Consultora
    const resetPassRes = await patchJson(`/api/usuarios/${novoUserId}/reset-password`, {}, {
      Cookie: consultoraCookie,
      'X-CSRF-Token': consultoraCsrf
    });
    assert(resetPassRes.res.statusCode === 200, 'Reset de senha pela Consultora deve retornar 200 OK');
    assert(resetPassRes.body.data.primeiro_acesso === true, 'primeiro_acesso deve ser redefinido para true após reset');
    console.log('   ✅ Reset de senha corporativo executado pela Consultora: senha retornada a Tke@1234 e primeiro_acesso reativado.');

    // 8.10. Teste de Ativação / Desativação de Usuário
    const disableUserRes = await patchJson(`/api/usuarios/${novoUserId}/toggle-status`, { ativo: false }, {
      Cookie: consultoraCookie,
      'X-CSRF-Token': consultoraCsrf
    });
    assert(disableUserRes.res.statusCode === 200, 'Desativação deve retornar 200 OK');
    
    // Login com usuário desativado deve retornar 403
    const loginDisabled = await postJson('/api/auth/login', {
      identificador: testEmail,
      senha: 'Tke@1234'
    });
    assert(loginDisabled.res.statusCode === 403, 'Usuário desativado não pode fazer login (403)');
    console.log('   ✅ Bloqueio de login para usuário inativo confirmado (403).');
    console.log('   ✅ Bloqueio de login para usuário inativo confirmado (403).');

    // 8.12. Teste de Esqueci Minha Senha (Forgot Password)
    console.log('   🔑 Testando fluxo de Esqueci Minha Senha (/api/auth/forgot-password)...');
    
    // Identificador inexistente -> 404
    const forgotInvalido = await postJson('/api/auth/forgot-password', { identificador: 'nao.existe@empresa.com' });
    assert(forgotInvalido.res.statusCode === 404, 'Recuperação de e-mail inexistente deve retornar 404');

    // Recuperação para usuário desativado -> 403
    const forgotDesativado = await postJson('/api/auth/forgot-password', { identificador: testEmail });
    assert(forgotDesativado.res.statusCode === 403, 'Recuperação de usuário desativado deve retornar 403 Forbidden');

    // Reativa o usuário para teste de recuperação bem-sucedida
    await patchJson(`/api/usuarios/${novoUserId}/toggle-status`, { ativo: true }, {
      Cookie: consultoraCookie,
      'X-CSRF-Token': consultoraCsrf
    });

    // Recuperação para usuário ativo -> 200
    const forgotValido = await postJson('/api/auth/forgot-password', { identificador: testEmail });
    assert(forgotValido.res.statusCode === 200, 'Recuperação válida deve retornar 200 OK');
    assert(forgotValido.body.success === true, 'Deve indicar success: true');
    assert(forgotValido.body.senha_temporaria === 'Tke@1234', 'Deve retornar senha temporária padrão');

    // Verifica se primeiro_acesso foi reativado para 1
    const userAfterForgot = db.prepare('SELECT primeiro_acesso FROM usuarios WHERE email = ?').get(testEmail);
    assert(userAfterForgot.primeiro_acesso === 1, 'primeiro_acesso deve ser 1 após forgot-password');
    console.log('   ✅ Fluxo de Esqueci Minha Senha validado com sucesso (rejeição de inativo/inexistente e reset para Tke@1234 com primeiro_acesso).');

    // 8.13. Teste de Exclusão de Colaborador (DELETE /api/usuarios/:id)
    console.log('   🗑️ Testando exclusão de colaborador (DELETE /api/usuarios/:id)...');
    
    // Supervisor tentando excluir colaborador -> 403
    const supDeleteUser = await deleteJson(`/api/usuarios/${novoUserId}`, {
      Cookie: supervisorCookie,
      'X-CSRF-Token': supervisorCsrf
    });
    assert(supDeleteUser.res.statusCode === 403, 'Supervisor não pode excluir colaboradores (403 Forbidden)');

    // Consultora tentando excluir a si mesma -> 400
    const consultoraId = consultoraLogin.body.user.id;
    const consSelfDelete = await deleteJson(`/api/usuarios/${consultoraId}`, {
      Cookie: consultoraCookie,
      'X-CSRF-Token': consultoraCsrf
    });
    assert(consSelfDelete.res.statusCode === 400, 'Consultora não pode excluir a própria conta ativa (400 Bad Request)');

    // Consultora excluindo o colaborador criado para teste
    const consDeleteUser = await deleteJson(`/api/usuarios/${novoUserId}`, {
      Cookie: consultoraCookie,
      'X-CSRF-Token': consultoraCsrf
    });
    assert(consDeleteUser.res.statusCode === 200, 'Consultora deve excluir colaborador com sucesso (200 OK)');
    
    const userDeletedCheck = db.prepare('SELECT id FROM usuarios WHERE id = ?').get(novoUserId);
    assert(!userDeletedCheck, 'Colaborador deve ter sido removido do banco de dados');
    console.log(`   ✅ Exclusão de colaborador (ID #${novoUserId}) concluída e protegida com sucesso.`);

    console.log('\n🎉 ========================================================');
    console.log('🎉 TODOS OS TESTES PASSARAM COM 100% DE SUCESSO!');
    console.log('🎉 ========================================================\n');

  } catch (err) {
    console.error('\n❌ FALHA NO TESTE:', err);
    process.exitCode = 1;
  } finally {
    server.close();
  }
}

// Helpers HTTP
function assert(condition, message) {
  if (!condition) {
    throw new Error(`Asserção falhou: ${message}`);
  }
}

function extractCookies(res) {
  const setCookie = res.headers['set-cookie'];
  if (!setCookie) return '';
  const cookieMap = {};
  setCookie.forEach(c => {
    const [pair] = c.split(';');
    const [k, ...v] = pair.split('=');
    if (k) cookieMap[k.trim()] = v.join('=');
  });
  return Object.entries(cookieMap).map(([k, v]) => `${k}=${v}`).join('; ');
}

function request(method, path, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const reqOptions = {
      method,
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      }
    };

    const req = http.request(reqOptions, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        let json = null;
        try {
          json = JSON.parse(data);
        } catch {
          json = data;
        }
        resolve({ res, body: json });
      });
    });

    req.on('error', reject);
    if (body) {
      req.write(typeof body === 'string' ? body : JSON.stringify(body));
    }
    req.end();
  });
}

function postMultipart(path, filename, fileContent, cookie = '', csrfToken = '') {
  return new Promise((resolve, reject) => {
    const boundary = '----WebKitFormBoundary' + Math.random().toString(36).substring(2);
    const url = new URL(path, BASE_URL);

    const bufferData = Buffer.isBuffer(fileContent) ? fileContent : Buffer.from(fileContent);

    const header = Buffer.from(
      `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="file"; filename="${filename}"\r\n` +
      `Content-Type: application/octet-stream\r\n\r\n`
    );
    const footer = Buffer.from(`\r\n--${boundary}--\r\n`);
    const payload = Buffer.concat([header, bufferData, footer]);

    const reqOptions = {
      method: 'POST',
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': payload.length,
        'Cookie': cookie,
        'X-CSRF-Token': csrfToken
      }
    };

    const req = http.request(reqOptions, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        let json = null;
        try {
          json = JSON.parse(data);
        } catch {
          json = data;
        }
        resolve({ res, body: json });
      });
    });

    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

function getRaw(path, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const reqOptions = {
      method: 'GET',
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      headers
    };

    const req = http.request(reqOptions, (res) => {
      let chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => {
        resolve({ res, buffer: Buffer.concat(chunks) });
      });
    });

    req.on('error', reject);
    req.end();
  });
}

const getJson = (path, headers) => request('GET', path, null, headers);
const postJson = (path, body, headers) => request('POST', path, body, headers);
const putJson = (path, body, headers) => request('PUT', path, body, headers);
const patchJson = (path, body, headers) => request('PATCH', path, body, headers);
const deleteJson = (path, headers) => request('DELETE', path, null, headers);

runTests();
