import { db } from '../config/database.js';
import XLSX from 'xlsx';

// Utilitário para resolução do intervalo de datas a partir do Ciclo Anual e Mês
export function parsePeriodoCiclo(cicloParam, mesParam) {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1; // 1 a 12

  // Se não fornecido ciclo, determina padrão (se atual >= 10, ciclo YYYY/YYYY+1, senão YYYY-1/YYYY)
  let ciclo = cicloParam;
  if (!ciclo || !ciclo.includes('/')) {
    if (currentMonth >= 10) {
      ciclo = `${currentYear}/${currentYear + 1}`;
    } else {
      ciclo = `${currentYear - 1}/${currentYear}`;
    }
  }

  const [anoInicioStr, anoFimStr] = ciclo.split('/');
  const anoInicio = parseInt(anoInicioStr, 10);
  const anoFim = parseInt(anoFimStr, 10);

  let mes = mesParam || 'acumulado';
  let dataInicio = '';
  let dataFim = '';
  let descricaoPeriodo = '';
  let nomeMes = '';

  const mesesMap = {
    '10': { nome: 'Outubro', ano: anoInicio, mesNum: 10 },
    '11': { nome: 'Novembro', ano: anoInicio, mesNum: 11 },
    '12': { nome: 'Dezembro', ano: anoInicio, mesNum: 12 },
    '01': { nome: 'Janeiro', ano: anoFim, mesNum: 1 },
    '02': { nome: 'Fevereiro', ano: anoFim, mesNum: 2 },
    '03': { nome: 'Março', ano: anoFim, mesNum: 3 },
    '04': { nome: 'Abril', ano: anoFim, mesNum: 4 },
    '05': { nome: 'Maio', ano: anoFim, mesNum: 5 },
    '06': { nome: 'Junho', ano: anoFim, mesNum: 6 },
    '07': { nome: 'Julho', ano: anoFim, mesNum: 7 },
    '08': { nome: 'Agosto', ano: anoFim, mesNum: 8 },
    '09': { nome: 'Setembro', ano: anoFim, mesNum: 9 },
    // aliases
    '1': { nome: 'Janeiro', ano: anoFim, mesNum: 1 },
    '2': { nome: 'Fevereiro', ano: anoFim, mesNum: 2 },
    '3': { nome: 'Março', ano: anoFim, mesNum: 3 },
    '4': { nome: 'Abril', ano: anoFim, mesNum: 4 },
    '5': { nome: 'Maio', ano: anoFim, mesNum: 5 },
    '6': { nome: 'Junho', ano: anoFim, mesNum: 6 },
    '7': { nome: 'Julho', ano: anoFim, mesNum: 7 },
    '8': { nome: 'Agosto', ano: anoFim, mesNum: 8 },
    '9': { nome: 'Setembro', ano: anoFim, mesNum: 9 }
  };

  if (mes.toLowerCase() === 'acumulado' || !mesesMap[mes]) {
    mes = 'acumulado';
    dataInicio = `${anoInicio}-10-01`;
    dataFim = `${anoFim}-09-30`;
    descricaoPeriodo = `Acumulado do Ciclo (${anoInicio}/${anoFim}): 01/10/${anoInicio} a 30/09/${anoFim}`;
    nomeMes = 'Acumulado do Ciclo';
  } else {
    const configMes = mesesMap[mes];
    const paddedMes = String(configMes.mesNum).padStart(2, '0');
    const ultimoDia = new Date(configMes.ano, configMes.mesNum, 0).getDate();
    dataInicio = `${configMes.ano}-${paddedMes}-01`;
    dataFim = `${configMes.ano}-${paddedMes}-${String(ultimoDia).padStart(2, '0')}`;
    descricaoPeriodo = `${configMes.nome}/${configMes.ano} (01/${paddedMes}/${configMes.ano} a ${ultimoDia}/${paddedMes}/${configMes.ano})`;
    nomeMes = `${configMes.nome}/${configMes.ano}`;
  }

  return {
    ciclo,
    anoInicio,
    anoFim,
    mes,
    nomeMes,
    dataInicio,
    dataFim,
    descricaoPeriodo
  };
}

// =====================================================================
// COMPARADOR HIERÁRQUICO EM 2 CAMADAS PARA O RANKING
// Nível 1 (>= 7 PGOs): Prioridade Absoluta -> Ordenado por Valor (R$) DESC, Qtd DESC, Nome ASC
// Nível 2 (< 7 PGOs): Abaixo do Topo -> Ordenado por Qtd DESC, Valor (R$) DESC, Nome ASC
// =====================================================================
export function sortTwoTierRanking(a, b) {
  const qtdDiff = Number(b.qtd_aprovados) - Number(a.qtd_aprovados);
  if (qtdDiff !== 0) return qtdDiff;

  const valDiff = Number(b.valor_total) - Number(a.valor_total);
  if (Math.abs(valDiff) > 0.001) return valDiff;

  return (a.nome_tecnico || '').localeCompare(b.nome_tecnico || '');
}

export const relatorioController = {
  // Obter dados consolidados do Dashboard e Relatório de Apuração para Premiação
  async getDashboardPremiacao(req, res) {
    try {
      const { ciclo: cicloParam, mes: mesParam, g_origem } = req.query;
      const periodo = parsePeriodoCiclo(cicloParam, mesParam);

      // SQL de Ranking Preventivo (Sincronizado diretamente com a base de colaboradores em Gestão de Acesso)
      let sqlPreventivo = `
        SELECT 
          u.matricula,
          u.nome as nome_tecnico,
          COALESCE(t.funcao, 'Técnico de Manutenção') as funcao,
          COALESCE(u.grupo, 'G11') as grupo,
          COALESCE(COUNT(c.id), 0) as qtd_aprovados,
          COALESCE(SUM(c.valor_total), 0.0) as valor_total
        FROM usuarios u
        LEFT JOIN tecnicos t ON (t.matricula = u.matricula OR LOWER(t.email) = LOWER(u.email))
        LEFT JOIN chamados_orcamentos c 
          ON (c.matricula_tecnico = u.matricula OR (t.matricula IS NOT NULL AND c.matricula_tecnico = t.matricula))
          AND c.tipo_servico = 'Preventivo'
          AND (c.status IN ('Aprovado pelo Cliente', 'Concluído', 'Liberado GEOR') OR c.geor_liberou = 'Sim')
          AND DATE(COALESCE(c.data_liberacao, c.data_envio_cliente, substr(c.data_criacao, 1, 10))) >= ?
          AND DATE(COALESCE(c.data_liberacao, c.data_envio_cliente, substr(c.data_criacao, 1, 10))) <= ?
        WHERE u.perfil = 'TECNICO'
          AND u.ativo = 1
          AND (LOWER(COALESCE(t.funcao, '')) NOT LIKE '%supervisor%' AND LOWER(COALESCE(t.funcao, '')) NOT LIKE '%consult%' AND LOWER(COALESCE(t.funcao, '')) NOT LIKE '%admin%')
      `;
      const paramsPreventivo = [periodo.dataInicio, periodo.dataFim];

      if (g_origem) {
        sqlPreventivo += ` AND (COALESCE(u.grupo, 'G11') = ?) `;
        paramsPreventivo.push(g_origem);
      }

      sqlPreventivo += `
        GROUP BY u.matricula, u.nome, t.funcao, u.grupo
      `;

      // SQL de Ranking Corretivo (Sincronizado diretamente com a base de colaboradores em Gestão de Acesso)
      let sqlCorretivo = `
        SELECT 
          u.matricula,
          u.nome as nome_tecnico,
          COALESCE(t.funcao, 'Técnico de Manutenção') as funcao,
          COALESCE(u.grupo, 'G11') as grupo,
          COALESCE(COUNT(c.id), 0) as qtd_aprovados,
          COALESCE(SUM(c.valor_total), 0.0) as valor_total
        FROM usuarios u
        LEFT JOIN tecnicos t ON (t.matricula = u.matricula OR LOWER(t.email) = LOWER(u.email))
        LEFT JOIN chamados_orcamentos c 
          ON (c.matricula_tecnico = u.matricula OR (t.matricula IS NOT NULL AND c.matricula_tecnico = t.matricula))
          AND c.tipo_servico = 'Corretivo'
          AND (c.status IN ('Aprovado pelo Cliente', 'Concluído', 'Liberado GEOR') OR c.geor_liberou = 'Sim')
          AND DATE(COALESCE(c.data_liberacao, c.data_envio_cliente, substr(c.data_criacao, 1, 10))) >= ?
          AND DATE(COALESCE(c.data_liberacao, c.data_envio_cliente, substr(c.data_criacao, 1, 10))) <= ?
        WHERE u.perfil = 'TECNICO'
          AND u.ativo = 1
          AND (LOWER(COALESCE(t.funcao, '')) NOT LIKE '%supervisor%' AND LOWER(COALESCE(t.funcao, '')) NOT LIKE '%consult%' AND LOWER(COALESCE(t.funcao, '')) NOT LIKE '%admin%')
      `;
      const paramsCorretivo = [periodo.dataInicio, periodo.dataFim];

      if (g_origem) {
        sqlCorretivo += ` AND (COALESCE(u.grupo, 'G11') = ?) `;
        paramsCorretivo.push(g_origem);
      }

      sqlCorretivo += `
        GROUP BY u.matricula, u.nome, t.funcao, u.grupo
      `;

      const rawPreventivo = db.prepare(sqlPreventivo).all(...paramsPreventivo);
      const rawCorretivo = db.prepare(sqlCorretivo).all(...paramsCorretivo);

      // Aplica a ordenação
      rawPreventivo.sort(sortTwoTierRanking);
      rawCorretivo.sort(sortTwoTierRanking);

      // Atribuição de posição no ranking contínua (1, 2, 3...) e campos adicionais
      const rankingPreventivo = rawPreventivo.map((item, idx) => {
        const qtd = Number(item.qtd_aprovados) || 0;
        const atingiu = qtd >= 7;
        return {
          posicao: idx + 1,
          matricula: item.matricula,
          colaborador: item.nome_tecnico,
          nome_tecnico: item.nome_tecnico,
          funcao: item.funcao || 'Técnico de Manutenção',
          grupo: item.grupo || 'G11',
          qtd_aprovados: qtd,
          valor_total: Number(item.valor_total) || 0.0,
          atingiu_meta: atingiu,
          faixa_status: atingiu ? 'Meta Atingida (≥ 7)' : 'Abaixo da Meta (< 7)',
          nivel_prioridade: atingiu ? 1 : 2
        };
      });

      const rankingCorretivo = rawCorretivo.map((item, idx) => {
        const qtd = Number(item.qtd_aprovados) || 0;
        const atingiu = qtd >= 7;
        return {
          posicao: idx + 1,
          matricula: item.matricula,
          colaborador: item.nome_tecnico,
          nome_tecnico: item.nome_tecnico,
          funcao: item.funcao || 'Técnico de Manutenção',
          grupo: item.grupo || 'G11',
          qtd_aprovados: qtd,
          valor_total: Number(item.valor_total) || 0.0,
          atingiu_meta: atingiu,
          faixa_status: atingiu ? 'Meta Atingida (≥ 7)' : 'Abaixo da Meta (< 7)',
          nivel_prioridade: atingiu ? 1 : 2
        };
      });

      // Consolidação de KPIs
      let totalQtdPreventivo = 0;
      let totalValorPreventivo = 0;
      let totalMetaAtingidaPrev = 0;
      rankingPreventivo.forEach(r => {
        totalQtdPreventivo += r.qtd_aprovados;
        totalValorPreventivo += r.valor_total;
        if (r.atingiu_meta) totalMetaAtingidaPrev++;
      });

      let totalQtdCorretivo = 0;
      let totalValorCorretivo = 0;
      let totalMetaAtingidaCorr = 0;
      rankingCorretivo.forEach(r => {
        totalQtdCorretivo += r.qtd_aprovados;
        totalValorCorretivo += r.valor_total;
        if (r.atingiu_meta) totalMetaAtingidaCorr++;
      });

      const totalGeralQtd = totalQtdPreventivo + totalQtdCorretivo;
      const totalGeralValor = totalValorPreventivo + totalValorCorretivo;

      // Contagem de técnicos ativos com vendas no período
      const tecnicosComVenda = new Set();
      rankingPreventivo.forEach(r => { if (r.qtd_aprovados > 0) tecnicosComVenda.add(r.matricula); });
      rankingCorretivo.forEach(r => { if (r.qtd_aprovados > 0) tecnicosComVenda.add(r.matricula); });

      const totalTecnicosCadastrados = rankingPreventivo.length;
      const totalTecnicosAtivos = tecnicosComVenda.size;
      const taxaParticipacao = totalTecnicosCadastrados > 0 
        ? Math.round((totalTecnicosAtivos / totalTecnicosCadastrados) * 100) 
        : 0;

      return res.status(200).json({
        success: true,
        periodo,
        kpis: {
          total_geral_qtd: totalGeralQtd,
          total_geral_valor: totalGeralValor,
          total_preventivo_qtd: totalQtdPreventivo,
          total_preventivo_valor: totalValorPreventivo,
          total_meta_atingida_prev: totalMetaAtingidaPrev,
          total_corretivo_qtd: totalQtdCorretivo,
          total_corretivo_valor: totalValorCorretivo,
          total_meta_atingida_corr: totalMetaAtingidaCorr,
          total_tecnicos_cadastrados: totalTecnicosCadastrados,
          total_tecnicos_ativos: totalTecnicosAtivos,
          taxa_participacao: taxaParticipacao
        },
        ranking_preventivo: rankingPreventivo,
        ranking_corretivo: rankingCorretivo
      });
    } catch (error) {
      console.error('❌ [Relatorio Controller] Erro ao calcular dashboard de premiação:', error);
      return res.status(500).json({
        success: false,
        error: 'Erro interno ao processar dados de apuração para premiação.'
      });
    }
  },

  // Exportação formatada para Excel (.xlsx) com múltiplas abas e fórmulas
  async exportExcelPremiacao(req, res) {
    try {
      const { ciclo: cicloParam, mes: mesParam, g_origem } = req.query;
      const periodo = parsePeriodoCiclo(cicloParam, mesParam);

      // 1. Busca dados Preventivo (Sincronizado com Gestão de Acesso)
      let sqlPreventivo = `
        SELECT 
          u.matricula,
          u.nome as nome_tecnico,
          COALESCE(t.funcao, 'Técnico de Manutenção') as funcao,
          COALESCE(u.grupo, 'G11') as grupo,
          COALESCE(COUNT(c.id), 0) as qtd_aprovados,
          COALESCE(SUM(c.valor_total), 0.0) as valor_total
        FROM usuarios u
        LEFT JOIN tecnicos t ON (t.matricula = u.matricula OR LOWER(t.email) = LOWER(u.email))
        LEFT JOIN chamados_orcamentos c 
          ON (c.matricula_tecnico = u.matricula OR (t.matricula IS NOT NULL AND c.matricula_tecnico = t.matricula))
          AND c.tipo_servico = 'Preventivo'
          AND (c.status IN ('Aprovado pelo Cliente', 'Concluído', 'Liberado GEOR') OR c.geor_liberou = 'Sim')
          AND DATE(COALESCE(c.data_liberacao, c.data_envio_cliente, substr(c.data_criacao, 1, 10))) >= ?
          AND DATE(COALESCE(c.data_liberacao, c.data_envio_cliente, substr(c.data_criacao, 1, 10))) <= ?
        WHERE u.perfil = 'TECNICO'
          AND u.ativo = 1
          AND (LOWER(COALESCE(t.funcao, '')) NOT LIKE '%supervisor%' AND LOWER(COALESCE(t.funcao, '')) NOT LIKE '%consult%' AND LOWER(COALESCE(t.funcao, '')) NOT LIKE '%admin%')
      `;
      const paramsPreventivo = [periodo.dataInicio, periodo.dataFim];
      if (g_origem) {
        sqlPreventivo += ` AND (COALESCE(u.grupo, 'G11') = ?) `;
        paramsPreventivo.push(g_origem);
      }
      sqlPreventivo += ` GROUP BY u.matricula, u.nome, t.funcao, u.grupo `;

      // 2. Busca dados Corretivo (Sincronizado com Gestão de Acesso)
      let sqlCorretivo = `
        SELECT 
          u.matricula,
          u.nome as nome_tecnico,
          COALESCE(t.funcao, 'Técnico de Manutenção') as funcao,
          COALESCE(u.grupo, 'G11') as grupo,
          COALESCE(COUNT(c.id), 0) as qtd_aprovados,
          COALESCE(SUM(c.valor_total), 0.0) as valor_total
        FROM usuarios u
        LEFT JOIN tecnicos t ON (t.matricula = u.matricula OR LOWER(t.email) = LOWER(u.email))
        LEFT JOIN chamados_orcamentos c 
          ON (c.matricula_tecnico = u.matricula OR (t.matricula IS NOT NULL AND c.matricula_tecnico = t.matricula))
          AND c.tipo_servico = 'Corretivo'
          AND (c.status IN ('Aprovado pelo Cliente', 'Concluído', 'Liberado GEOR') OR c.geor_liberou = 'Sim')
          AND DATE(COALESCE(c.data_liberacao, c.data_envio_cliente, substr(c.data_criacao, 1, 10))) >= ?
          AND DATE(COALESCE(c.data_liberacao, c.data_envio_cliente, substr(c.data_criacao, 1, 10))) <= ?
        WHERE u.perfil = 'TECNICO'
          AND u.ativo = 1
          AND (LOWER(COALESCE(t.funcao, '')) NOT LIKE '%supervisor%' AND LOWER(COALESCE(t.funcao, '')) NOT LIKE '%consult%' AND LOWER(COALESCE(t.funcao, '')) NOT LIKE '%admin%')
      `;
      const paramsCorretivo = [periodo.dataInicio, periodo.dataFim];
      if (g_origem) {
        sqlCorretivo += ` AND (COALESCE(u.grupo, 'G11') = ?) `;
        paramsCorretivo.push(g_origem);
      }
      sqlCorretivo += ` GROUP BY u.matricula, u.nome, t.funcao, u.grupo `;

      const rawPreventivo = db.prepare(sqlPreventivo).all(...paramsPreventivo);
      const rawCorretivo = db.prepare(sqlCorretivo).all(...paramsCorretivo);

      // Ordena por 2 camadas
      rawPreventivo.sort(sortTwoTierRanking);
      rawCorretivo.sort(sortTwoTierRanking);

      const formatCurrency = (val) => Number(val || 0);

      // Formatação das linhas dos Rankings com colunas solicitadas
      const rankingPreventivoRows = rawPreventivo.map((item, idx) => {
        const qtd = Number(item.qtd_aprovados) || 0;
        const atingiu = qtd >= 7;
        return [
          idx + 1,
          item.nome_tecnico,
          item.matricula,
          item.grupo || 'G11',
          qtd,
          formatCurrency(item.valor_total),
          atingiu ? 'Meta Atingida (≥ 7)' : 'Abaixo da Meta (< 7)'
        ];
      });

      const rankingCorretivoRows = rawCorretivo.map((item, idx) => {
        const qtd = Number(item.qtd_aprovados) || 0;
        const atingiu = qtd >= 7;
        return [
          idx + 1,
          item.nome_tecnico,
          item.matricula,
          item.grupo || 'G11',
          qtd,
          formatCurrency(item.valor_total),
          atingiu ? 'Meta Atingida (≥ 7)' : 'Abaixo da Meta (< 7)'
        ];
      });

      // Consolidação de totais
      const totalQtdPrev = rawPreventivo.reduce((acc, cur) => acc + (Number(cur.qtd_aprovados) || 0), 0);
      const totalValPrev = rawPreventivo.reduce((acc, cur) => acc + (Number(cur.valor_total) || 0), 0);
      const totalQtdCorr = rawCorretivo.reduce((acc, cur) => acc + (Number(cur.qtd_aprovados) || 0), 0);
      const totalValCorr = rawCorretivo.reduce((acc, cur) => acc + (Number(cur.valor_total) || 0), 0);

      const tecnicosAtivosSet = new Set();
      rawPreventivo.forEach(r => { if (r.qtd_aprovados > 0) tecnicosAtivosSet.add(r.matricula); });
      rawCorretivo.forEach(r => { if (r.qtd_aprovados > 0) tecnicosAtivosSet.add(r.matricula); });

      // Criação da Planilha Excel
      const wb = XLSX.utils.book_new();

      // =====================================================================
      // ABA 1: RESUMO GERAL
      // =====================================================================
      const resumoAOA = [
        ['TKE ELEVADORES - RELATÓRIO DE APURAÇÃO PARA PREMIAÇÃO'],
        ['Estrutura de Classificação em 2 Níveis (Nível 1: ≥ 7 PGOs | Nível 2: < 7 PGOs)'],
        [''],
        ['METADADOS DA APURAÇÃO', ''],
        ['Ciclo Anual de Referência:', `Ciclo ${periodo.ciclo} (01/10/${periodo.anoInicio} a 30/09/${periodo.anoFim})`],
        ['Período Selecionado:', periodo.nomeMes],
        ['Data Inicial do Filtro:', periodo.dataInicio],
        ['Data Final do Filtro:', periodo.dataFim],
        ['Data/Hora de Emissão:', new Date().toLocaleString('pt-BR')],
        ['Total de Técnicos Cadastrados:', rawPreventivo.length],
        ['Técnicos Ativos com Venda no Período:', tecnicosAtivosSet.size],
        ['Taxa de Participação:', `${rawPreventivo.length > 0 ? Math.round((tecnicosAtivosSet.size / rawPreventivo.length) * 100) : 0}%`],
        [''],
        ['CONSOLIDAÇÃO GERAL DE INDICADORES (KPIS)'],
        ['Tipo de Serviço', 'Qtd. PGOs Aprovados', 'Valor Total (R$)'],
        ['Serviços Preventivos', totalQtdPrev, totalValPrev],
        ['Serviços Corretivos', totalQtdCorr, totalValCorr],
        ['TOTAL GERAL CONSOLIDADO', totalQtdPrev + totalQtdCorr, totalValPrev + totalValCorr],
        [''],
        ['FÓRMULA MATRICIAL EXCEL RECOMENDADA:'],
        ['CLASSIFICARPOR (SORTBY):', '=CLASSIFICARPOR(A5:F12; SE(D5:D12>=7; 1; 2); 1; SE(D5:D12>=7; E5:E12; D5:D12); -1; SE(D5:D12>=7; D5:D12; E5:E12); -1)']
      ];

      const wsResumo = XLSX.utils.aoa_to_sheet(resumoAOA);
      wsResumo['!cols'] = [
        { wch: 38 },
        { wch: 28 },
        { wch: 25 }
      ];
      XLSX.utils.book_append_sheet(wb, wsResumo, 'Resumo Geral');

      // =====================================================================
      // ABA 2: RANKING PREVENTIVO (COM 2 CAMADAS E COLUNAS SOLICITADAS)
      // =====================================================================
      const prevHeader = ['Posição (Rank)', 'Colaborador', 'Matrícula', 'Grupo', 'Qtd. PGO Aprovados', 'Valor Aprovado (R$)', 'Faixa / Status'];
      const prevAOA = [
        ['TKE ELEVADORES - RANKING DE SERVIÇOS PREVENTIVOS'],
        [`Período: ${periodo.descricaoPeriodo}`],
        ['Critério: Nível 1 (≥ 7 PGOs ordenado por R$) | Nível 2 (< 7 PGOs ordenado por Qtd)'],
        [''],
        prevHeader,
        ...rankingPreventivoRows,
        [''],
        ['TOTAL PREVENTIVO', '', '', '', totalQtdPrev, totalValPrev, '']
      ];

      const wsPreventivo = XLSX.utils.aoa_to_sheet(prevAOA);
      wsPreventivo['!cols'] = [
        { wch: 14 },
        { wch: 35 },
        { wch: 14 },
        { wch: 10 },
        { wch: 20 },
        { wch: 22 },
        { wch: 24 }
      ];
      XLSX.utils.book_append_sheet(wb, wsPreventivo, 'Ranking Preventivo');

      // =====================================================================
      // ABA 3: RANKING CORRETIVO (COM 2 CAMADAS E COLUNAS SOLICITADAS)
      // =====================================================================
      const corrHeader = ['Posição (Rank)', 'Colaborador', 'Matrícula', 'Grupo', 'Qtd. PGO Aprovados', 'Valor Aprovado (R$)', 'Faixa / Status'];
      const corrAOA = [
        ['TKE ELEVADORES - RANKING DE SERVIÇOS CORRETIVOS'],
        [`Período: ${periodo.descricaoPeriodo}`],
        ['Critério: Nível 1 (≥ 7 PGOs ordenado por R$) | Nível 2 (< 7 PGOs ordenado por Qtd)'],
        [''],
        corrHeader,
        ...rankingCorretivoRows,
        [''],
        ['TOTAL CORRETIVO', '', '', '', totalQtdCorr, totalValCorr, '']
      ];

      const wsCorretivo = XLSX.utils.aoa_to_sheet(corrAOA);
      wsCorretivo['!cols'] = [
        { wch: 14 },
        { wch: 35 },
        { wch: 14 },
        { wch: 10 },
        { wch: 20 },
        { wch: 22 },
        { wch: 24 }
      ];
      XLSX.utils.book_append_sheet(wb, wsCorretivo, 'Ranking Corretivo');

      // =====================================================================
      // ABA 4: EVOLUÇÃO MÊS A MÊS - QUANTIDADE DE PGOS (OUT A SET)
      // =====================================================================
      const mesesQtdHeaders = [
        'Posição', 'Colaborador', 'Matrícula', 'Grupo',
        `Out/${periodo.anoInicio}`, `Nov/${periodo.anoInicio}`, `Dez/${periodo.anoInicio}`,
        `Jan/${periodo.anoFim}`, `Fev/${periodo.anoFim}`, `Mar/${periodo.anoFim}`,
        `Abr/${periodo.anoFim}`, `Mai/${periodo.anoFim}`, `Jun/${periodo.anoFim}`,
        `Jul/${periodo.anoFim}`, `Ago/${periodo.anoFim}`, `Set/${periodo.anoFim}`,
        'Total Qtd Ciclo', 'Total Valor (R$)', 'Faixa / Status'
      ];

      const mesesValHeaders = [
        'Posição', 'Colaborador', 'Matrícula', 'Grupo',
        `Out/${periodo.anoInicio} (R$)`, `Nov/${periodo.anoInicio} (R$)`, `Dez/${periodo.anoInicio} (R$)`,
        `Jan/${periodo.anoFim} (R$)`, `Fev/${periodo.anoFim} (R$)`, `Mar/${periodo.anoFim} (R$)`,
        `Abr/${periodo.anoFim} (R$)`, `Mai/${periodo.anoFim} (R$)`, `Jun/${periodo.anoFim} (R$)`,
        `Jul/${periodo.anoFim} (R$)`, `Ago/${periodo.anoFim} (R$)`, `Set/${periodo.anoFim} (R$)`,
        'Total Valor (R$)', 'Total Qtd Ciclo', 'Faixa / Status'
      ];

      const mesesOrdem = [
        { nome: `Out/${periodo.anoInicio}`, mesNum: 10, ano: periodo.anoInicio },
        { nome: `Nov/${periodo.anoInicio}`, mesNum: 11, ano: periodo.anoInicio },
        { nome: `Dez/${periodo.anoInicio}`, mesNum: 12, ano: periodo.anoInicio },
        { nome: `Jan/${periodo.anoFim}`, mesNum: 1, ano: periodo.anoFim },
        { nome: `Fev/${periodo.anoFim}`, mesNum: 2, ano: periodo.anoFim },
        { nome: `Mar/${periodo.anoFim}`, mesNum: 3, ano: periodo.anoFim },
        { nome: `Abr/${periodo.anoFim}`, mesNum: 4, ano: periodo.anoFim },
        { nome: `Mai/${periodo.anoFim}`, mesNum: 5, ano: periodo.anoFim },
        { nome: `Jun/${periodo.anoFim}`, mesNum: 6, ano: periodo.anoFim },
        { nome: `Jul/${periodo.anoFim}`, mesNum: 7, ano: periodo.anoFim },
        { nome: `Ago/${periodo.anoFim}`, mesNum: 8, ano: periodo.anoFim },
        { nome: `Set/${periodo.anoFim}`, mesNum: 9, ano: periodo.anoFim }
      ];

      // Busca todos os técnicos (sincronizado com Gestão de Acesso) e calcula a matriz mês a mês consolidada
      let sqlTodosTecnicos = `
        SELECT 
          u.matricula,
          u.nome as nome_tecnico,
          COALESCE(t.funcao, 'Técnico de Manutenção') as funcao,
          COALESCE(u.grupo, 'G11') as grupo,
          COALESCE(COUNT(c.id), 0) as qtd_total_ciclo,
          COALESCE(SUM(c.valor_total), 0.0) as valor_total_ciclo
        FROM usuarios u
        LEFT JOIN tecnicos t ON (t.matricula = u.matricula OR LOWER(t.email) = LOWER(u.email))
        LEFT JOIN chamados_orcamentos c 
          ON (c.matricula_tecnico = u.matricula OR (t.matricula IS NOT NULL AND c.matricula_tecnico = t.matricula))
          AND (c.status IN ('Aprovado pelo Cliente', 'Concluído', 'Liberado GEOR') OR c.geor_liberou = 'Sim')
          AND DATE(COALESCE(c.data_liberacao, c.data_envio_cliente, substr(c.data_criacao, 1, 10))) >= ?
          AND DATE(COALESCE(c.data_liberacao, c.data_envio_cliente, substr(c.data_criacao, 1, 10))) <= ?
        WHERE u.perfil = 'TECNICO'
          AND u.ativo = 1
          AND (LOWER(COALESCE(t.funcao, '')) NOT LIKE '%supervisor%' AND LOWER(COALESCE(t.funcao, '')) NOT LIKE '%consult%' AND LOWER(COALESCE(t.funcao, '')) NOT LIKE '%admin%')
      `;
      const paramsCiclo = [`${periodo.anoInicio}-10-01`, `${periodo.anoFim}-09-30`];
      if (g_origem) {
        sqlTodosTecnicos += ` AND (COALESCE(u.grupo, 'G11') = ?) `;
        paramsCiclo.push(g_origem);
      }
      sqlTodosTecnicos += ` GROUP BY u.matricula, u.nome, t.funcao, u.grupo `;

      const rawTodos = db.prepare(sqlTodosTecnicos).all(...paramsCiclo);
      // Ordena por 2 camadas no consolidado anual
      rawTodos.sort((a, b) => {
        const qtdA = Number(a.qtd_total_ciclo) || 0;
        const qtdB = Number(b.qtd_total_ciclo) || 0;
        const valA = Number(a.valor_total_ciclo) || 0;
        const valB = Number(b.valor_total_ciclo) || 0;
        const metaA = qtdA >= 7;
        const metaB = qtdB >= 7;

        if (metaA && !metaB) return -1;
        if (!metaA && metaB) return 1;
        if (metaA && metaB) {
          if (valB !== valA) return valB - valA;
          return qtdB - qtdA;
        }
        if (qtdB !== qtdA) return qtdB - qtdA;
        return valB - valA;
      });

      // Estruturação dos dados mês a mês
      const mesAMesQtdRows = [];
      const mesAMesValRows = [];

      // Totalizadores de colunas mensais
      const somaMensalQtd = Array(12).fill(0);
      const somaMensalVal = Array(12).fill(0);

      rawTodos.forEach((tec, idx) => {
        const rowQtd = [idx + 1, tec.nome_tecnico, tec.matricula, tec.grupo || 'G11'];
        const rowVal = [idx + 1, tec.nome_tecnico, tec.matricula, tec.grupo || 'G11'];
        let somaQtd = 0;
        let somaVal = 0;

        mesesOrdem.forEach((m, mIdx) => {
          const paddedM = String(m.mesNum).padStart(2, '0');
          const ultDia = new Date(m.ano, m.mesNum, 0).getDate();
          const dIni = `${m.ano}-${paddedM}-01`;
          const dFim = `${m.ano}-${paddedM}-${String(ultDia).padStart(2, '0')}`;

          let sqlMes = `
            SELECT COALESCE(COUNT(c.id), 0) as qtd, COALESCE(SUM(c.valor_total), 0.0) as val
            FROM chamados_orcamentos c
            LEFT JOIN usuarios u ON (u.matricula = c.matricula_tecnico)
            WHERE (c.matricula_tecnico = ? OR u.matricula = ?)
              AND (c.status IN ('Aprovado pelo Cliente', 'Concluído', 'Liberado GEOR') OR c.geor_liberou = 'Sim')
              AND DATE(COALESCE(c.data_liberacao, c.data_envio_cliente, substr(c.data_criacao, 1, 10))) >= ?
              AND DATE(COALESCE(c.data_liberacao, c.data_envio_cliente, substr(c.data_criacao, 1, 10))) <= ?
          `;
          const paramsMes = [tec.matricula, tec.matricula, dIni, dFim];
          if (g_origem) {
            sqlMes += ` AND (COALESCE(u.grupo, 'G11') = ?) `;
            paramsMes.push(g_origem);
          }

          const resMes = db.prepare(sqlMes).get(...paramsMes);
          const q = Number(resMes?.qtd) || 0;
          const v = Number(resMes?.val) || 0;

          somaQtd += q;
          somaVal += v;
          somaMensalQtd[mIdx] += q;
          somaMensalVal[mIdx] += v;

          rowQtd.push(q);
          rowVal.push(formatCurrency(v));
        });

        rowQtd.push(somaQtd);
        rowQtd.push(formatCurrency(somaVal));
        rowQtd.push(somaQtd >= 7 ? 'Meta Atingida (≥ 7)' : 'Abaixo da Meta (< 7)');

        rowVal.push(formatCurrency(somaVal));
        rowVal.push(somaQtd);
        rowVal.push(somaQtd >= 7 ? 'Meta Atingida (≥ 7)' : 'Abaixo da Meta (< 7)');

        mesAMesQtdRows.push(rowQtd);
        mesAMesValRows.push(rowVal);
      });

      // Linhas de totais mensais
      const totalGeralCicloQtd = somaMensalQtd.reduce((a, b) => a + b, 0);
      const totalGeralCicloVal = somaMensalVal.reduce((a, b) => a + b, 0);

      const linhaTotalQtd = ['TOTAL MENSAL', '', '', '', ...somaMensalQtd, totalGeralCicloQtd, formatCurrency(totalGeralCicloVal), ''];
      const linhaTotalVal = ['TOTAL MENSAL (R$)', '', '', '', ...somaMensalVal.map(formatCurrency), formatCurrency(totalGeralCicloVal), totalGeralCicloQtd, ''];

      // Planilha 4: Evolução Mês a Mês (Quantidade)
      const mesAMesQtdAOA = [
        ['TKE ELEVADORES - APURAÇÃO MÊS A MÊS: QUANTIDADE DE PGOS APROVADOS'],
        [`Ciclo Anual ${periodo.ciclo} (01/10/${periodo.anoInicio} a 30/09/${periodo.anoFim}) - Base Completa`],
        ['Critério de Ranking: Priorização em 2 Níveis (Nível 1: ≥ 7 PGOs ordenado por R$ | Nível 2: < 7 ordenado por Qtd)'],
        [''],
        mesesQtdHeaders,
        ...mesAMesQtdRows,
        [''],
        linhaTotalQtd
      ];

      const wsMesAMesQtd = XLSX.utils.aoa_to_sheet(mesAMesQtdAOA);
      wsMesAMesQtd['!cols'] = [
        { wch: 10 }, { wch: 32 }, { wch: 12 }, { wch: 10 },
        { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 },
        { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 },
        { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 },
        { wch: 16 }, { wch: 20 }, { wch: 24 }
      ];
      XLSX.utils.book_append_sheet(wb, wsMesAMesQtd, 'Mês a Mês (Qtd PGOs)');

      // =====================================================================
      // ABA 5: EVOLUÇÃO MÊS A MÊS - VALORES EM R$ (OUT A SET)
      // =====================================================================
      const mesAMesValAOA = [
        ['TKE ELEVADORES - APURAÇÃO MÊS A MÊS: VALORES FINANCEIROS APROVADOS (R$)'],
        [`Ciclo Anual ${periodo.ciclo} (01/10/${periodo.anoInicio} a 30/09/${periodo.anoFim}) - Base Completa`],
        ['Critério de Ranking: Priorização em 2 Níveis (Nível 1: ≥ 7 PGOs ordenado por R$ | Nível 2: < 7 ordenado por Qtd)'],
        [''],
        mesesValHeaders,
        ...mesAMesValRows,
        [''],
        linhaTotalVal
      ];

      const wsMesAMesVal = XLSX.utils.aoa_to_sheet(mesAMesValAOA);
      wsMesAMesVal['!cols'] = [
        { wch: 10 }, { wch: 32 }, { wch: 12 }, { wch: 10 },
        { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 },
        { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 },
        { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 },
        { wch: 20 }, { wch: 16 }, { wch: 24 }
      ];
      XLSX.utils.book_append_sheet(wb, wsMesAMesVal, 'Mês a Mês (Valores R$)');

      // Geração do buffer binário
      const excelBuffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
      const safeCiclo = periodo.ciclo.replace('/', '-');
      const safeMes = periodo.mes.toLowerCase().replace('/', '-');
      const filename = `TKE_Relatorio_Premiacao_Ciclo_${safeCiclo}_${safeMes}.xlsx`;

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      return res.status(200).send(excelBuffer);
    } catch (error) {
      console.error('❌ [Relatorio Controller] Erro ao exportar planilha de premiação:', error);
      return res.status(500).json({
        success: false,
        error: 'Erro ao gerar planilha de apuração para premiação.'
      });
    }
  }
};
