-- =====================================================================
-- SEED DATA: DADOS INICIAIS DE TESTE E PRODUÇÃO (TKE ELEVADORES)
-- =====================================================================

-- 1. CLIENTES INICIAIS (10 REGISTROS: CT-2024-001 a CT-2024-010)
INSERT OR REPLACE INTO clientes (numero_contrato, nome_cliente) VALUES
('CT-2024-001', 'Hospital Central Santa Clara'),
('CT-2024-002', 'Indústrias MetalSul S/A'),
('CT-2024-003', 'Shopping Plaza Norte'),
('CT-2024-004', 'Rede PharmaVida Distribuidora'),
('CT-2024-005', 'Logística Express Brasil S/A'),
('CT-2024-006', 'Centro Corporativo Faria Lima'),
('CT-2024-007', 'Edifício Empresarial Paulista'),
('CT-2024-008', 'Condomínio Grand Tower'),
('CT-2024-009', 'Tech Park Alphaville'),
('CT-2024-010', 'Complexo Logístico Aeroporto');

-- 2. TÉCNICOS INICIAIS (8 REGISTROS: MATRÍCULAS 1001 a 1008)
INSERT OR REPLACE INTO tecnicos (matricula, funcao, nome_sobrenome, email, telefone) VALUES
('1001', 'Técnico de Manutenção', 'Thiago Silva Santos', 'tecnico@empresa.com', '(11) 98765-4321'),
('1002', 'Técnico Residente', 'Marcos Vinicius Costa', 'marcos.costa@empresa.com', '(11) 98765-4322'),
('1003', 'Técnico Especialista', 'Rafael Fernandes Oliveira', 'rafael.fernandes@empresa.com', '(11) 98765-4323'),
('1004', 'Técnica de Manutenção', 'Larissa Duarte Mendes', 'larissa.duarte@empresa.com', '(11) 98765-4324'),
('1005', 'Técnica Residente', 'Juliana Prado Martins', 'juliana.prado@empresa.com', '(11) 98765-4325'),
('1006', 'Técnico de Instalação', 'Roberto Alencar Lima', 'roberto.lima@empresa.com', '(11) 98765-4326'),
('1007', 'Técnico de Reparos', 'Carlos Eduardo Souza', 'carlos.souza@empresa.com', '(11) 98765-4327'),
('1008', 'Técnica Especialista', 'Mariana Becker Ramos', 'mariana.ramos@empresa.com', '(11) 98765-4328');

-- 3. USUÁRIOS PADRÃO PARA TESTES IMEDIATOS (SENHA PADRÃO: Senha@12345)
-- Bcrypt Hash para 'Senha@12345': $2b$10$lPjOSXnA8CF1F7RjTd7OY.4w5FwMNgtfpnL6PrGvTXNzUYHDUCRy6
INSERT OR REPLACE INTO usuarios (id, nome, email, matricula, senha_hash, perfil, ativo) VALUES
(1, 'Camila Mendes (Consultora Admin)', 'consultora@empresa.com', 'CONS001', '$2b$10$lPjOSXnA8CF1F7RjTd7OY.4w5FwMNgtfpnL6PrGvTXNzUYHDUCRy6', 'CONSULTORA', 1),
(2, 'Carlos Albuquerque (Supervisor)', 'supervisor@empresa.com', 'SUP001', '$2b$10$lPjOSXnA8CF1F7RjTd7OY.4w5FwMNgtfpnL6PrGvTXNzUYHDUCRy6', 'SUPERVISOR', 1),
(3, 'Thiago Silva (Técnico 1001)', 'tecnico@empresa.com', '1001', '$2b$10$lPjOSXnA8CF1F7RjTd7OY.4w5FwMNgtfpnL6PrGvTXNzUYHDUCRy6', 'TECNICO', 1);

-- 4. ORÇAMENTOS DE AMOSTRA PARA TESTES (COM VALORES MONETÁRIOS, CICLOS ANUAIS E DOIS NÍVEIS DE META)
INSERT OR REPLACE INTO chamados_orcamentos (
    id, matricula_tecnico, nome_tecnico, tipo_servico, numero_pgo, g_origem,
    numero_contrato, nome_cliente, numero_orcamento, descricao_servico,
    valor_total, data_liberacao, geor_liberou, data_envio_cliente, status, data_criacao, created_by_id
) VALUES
-- TÉCNICA LARISSA (1004): 7 PGOs Aprovados no Ciclo 2025/2026 (Nível 1 - Topo, Valor Maior: R$ 68.900)
(1, '1004', 'Larissa Duarte Mendes', 'Corretivo', 'PGO-2026-8801', 'G06', 'CT-2024-001', 'Hospital Central Santa Clara', 'ORC-9801/26', 'Modernização de comandos de cabina', 15000.00, '2025-10-15', 'Sim', '2025-10-18', 'Aprovado pelo Cliente', '2025-10-10', 1),
(2, '1004', 'Larissa Duarte Mendes', 'Corretivo', 'PGO-2026-8802', 'G06', 'CT-2024-002', 'Indústrias MetalSul S/A', 'ORC-9802/26', 'Substituição de inversor de frequência', 12400.00, '2025-11-20', 'Sim', '2025-11-22', 'Aprovado pelo Cliente', '2025-11-15', 1),
(3, '1004', 'Larissa Duarte Mendes', 'Preventivo', 'PGO-2026-8803', 'G06', 'CT-2024-003', 'Shopping Plaza Norte', 'ORC-9803/26', 'Revisão preventiva semestral de freios', 8500.00, '2025-12-10', 'Sim', '2025-12-12', 'Aprovado pelo Cliente', '2025-12-05', 1),
(4, '1004', 'Larissa Duarte Mendes', 'Corretivo', 'PGO-2026-8804', 'G06', 'CT-2024-004', 'Rede PharmaVida Distribuidora', 'ORC-9804/26', 'Troca de cabos de tração e polias', 16000.00, '2026-02-14', 'Sim', '2026-02-16', 'Aprovado pelo Cliente', '2026-02-10', 1),
(5, '1004', 'Larissa Duarte Mendes', 'Preventivo', 'PGO-2026-8805', 'G06', 'CT-2024-005', 'Logística Express Brasil S/A', 'ORC-9805/26', 'Inspeção periódica e lubrificação', 4200.00, '2026-04-18', 'Sim', '2026-04-20', 'Aprovado pelo Cliente', '2026-04-12', 1),
(6, '1004', 'Larissa Duarte Mendes', 'Corretivo', 'PGO-2026-8806', 'G06', 'CT-2024-006', 'Centro Corporativo Faria Lima', 'ORC-9806/26', 'Reparo no operador de portas', 7800.00, '2026-06-22', 'Sim', '2026-06-25', 'Aprovado pelo Cliente', '2026-06-18', 1),
(7, '1004', 'Larissa Duarte Mendes', 'Preventivo', 'PGO-2026-8807', 'G06', 'CT-2024-007', 'Edifício Empresarial Paulista', 'ORC-9807/26', 'Ajuste de nível de pavimento', 5000.00, '2026-08-10', 'Sim', '2026-08-12', 'Aprovado pelo Cliente', '2026-08-05', 1),

-- TÉCNICO THIAGO (1001): 8 PGOs Aprovados no Ciclo 2025/2026 (Nível 1 - Topo, Valor R$ 51.300)
(8, '1001', 'Thiago Silva Santos', 'Corretivo', 'PGO-2026-8811', 'G11', 'CT-2024-001', 'Hospital Central Santa Clara', 'ORC-9811/26', 'Troca de fita seletora e sensores', 6200.00, '2025-10-22', 'Sim', '2025-10-25', 'Aprovado pelo Cliente', '2025-10-18', 3),
(9, '1001', 'Thiago Silva Santos', 'Preventivo', 'PGO-2026-8812', 'G11', 'CT-2024-002', 'Indústrias MetalSul S/A', 'ORC-9812/26', 'Manutenção bimestral de corrediças', 3800.00, '2025-11-12', 'Sim', '2025-11-15', 'Aprovado pelo Cliente', '2025-11-08', 3),
(10, '1001', 'Thiago Silva Santos', 'Corretivo', 'PGO-2026-8813', 'G11', 'CT-2024-003', 'Shopping Plaza Norte', 'ORC-9813/26', 'Substituição de contatoras de força', 8900.00, '2026-01-15', 'Sim', '2026-01-18', 'Aprovado pelo Cliente', '2026-01-10', 3),
(11, '1001', 'Thiago Silva Santos', 'Preventivo', 'PGO-2026-8814', 'G11', 'CT-2024-004', 'Rede PharmaVida Distribuidora', 'ORC-9814/26', 'Revisão periódica de limites', 4500.00, '2026-03-20', 'Sim', '2026-03-22', 'Aprovado pelo Cliente', '2026-03-15', 3),
(12, '1001', 'Thiago Silva Santos', 'Corretivo', 'PGO-2026-8815', 'G11', 'CT-2024-005', 'Logística Express Brasil S/A', 'ORC-9815/26', 'Substituição de encoder de tração', 7100.00, '2026-05-14', 'Sim', '2026-05-16', 'Aprovado pelo Cliente', '2026-05-10', 3),
(13, '1001', 'Thiago Silva Santos', 'Preventivo', 'PGO-2026-8816', 'G11', 'CT-2024-006', 'Centro Corporativo Faria Lima', 'ORC-9816/26', 'Alinhamento geral de guias', 5600.00, '2026-07-10', 'Sim', '2026-07-12', 'Aprovado pelo Cliente', '2026-07-05', 3),
(14, '1001', 'Thiago Silva Santos', 'Corretivo', 'PGO-2026-8817', 'G11', 'CT-2024-007', 'Edifício Empresarial Paulista', 'ORC-9817/26', 'Troca de botoneiras de chamada', 6800.00, '2026-08-15', 'Sim', '2026-08-18', 'Aprovado pelo Cliente', '2026-08-10', 3),
(15, '1001', 'Thiago Silva Santos', 'Preventivo', 'PGO-2026-8818', 'G11', 'CT-2024-008', 'Condomínio Grand Tower', 'ORC-9818/26', 'Limpeza técnica e lubrificação de poço', 8400.00, '2026-09-02', 'Sim', '2026-09-04', 'Aprovado pelo Cliente', '2026-08-28', 3),

-- TÉCNICO MARCOS (1002): 5 PGOs Aprovados no Ciclo (Nível 2 - Abaixo da Meta, Valor R$ 38.000)
(16, '1002', 'Marcos Vinicius Costa', 'Preventivo', 'PGO-2026-8821', 'G06', 'CT-2024-002', 'Indústrias MetalSul S/A', 'ORC-9821/26', 'Revisão periódica de freios', 4200.00, '2025-11-20', 'Sim', '2025-11-22', 'Aprovado pelo Cliente', '2025-11-15', 3),
(17, '1002', 'Marcos Vinicius Costa', 'Preventivo', 'PGO-2026-8822', 'G06', 'CT-2024-003', 'Shopping Plaza Norte', 'ORC-9822/26', 'Inspeção semestral de amortecedores', 7800.00, '2026-01-25', 'Sim', '2026-01-28', 'Aprovado pelo Cliente', '2026-01-20', 3),
(18, '1002', 'Marcos Vinicius Costa', 'Corretivo', 'PGO-2026-8823', 'G06', 'CT-2024-005', 'Logística Express Brasil S/A', 'ORC-9823/26', 'Troca de bloco de segurança', 11500.00, '2026-04-12', 'Sim', '2026-04-15', 'Aprovado pelo Cliente', '2026-04-05', 3),
(19, '1002', 'Marcos Vinicius Costa', 'Preventivo', 'PGO-2026-8824', 'G06', 'CT-2024-007', 'Edifício Empresarial Paulista', 'ORC-9824/26', 'Revisão geral de sapatas', 4800.00, '2026-06-15', 'Sim', '2026-06-18', 'Aprovado pelo Cliente', '2026-06-10', 3),
(20, '1002', 'Marcos Vinicius Costa', 'Corretivo', 'PGO-2026-8825', 'G06', 'CT-2024-009', 'Tech Park Alphaville', 'ORC-9825/26', 'Substituição de placa de comando', 9700.00, '2026-08-20', 'Sim', '2026-08-22', 'Aprovado pelo Cliente', '2026-08-14', 3),

-- TÉCNICO RAFAEL (1003): 3 PGOs Aprovados no Ciclo (Nível 2 - Abaixo da Meta, Valor R$ 24.100)
(21, '1003', 'Rafael Fernandes Oliveira', 'Corretivo', 'PGO-2026-8831', 'G05', 'CT-2024-003', 'Shopping Plaza Norte', 'ORC-9831/26', 'Troca de operador de porta', 9800.00, '2025-12-15', 'Sim', '2025-12-18', 'Aprovado pelo Cliente', '2025-12-10', 2),
(22, '1003', 'Rafael Fernandes Oliveira', 'Preventivo', 'PGO-2026-8832', 'G05', 'CT-2024-004', 'Rede PharmaVida Distribuidora', 'ORC-9832/26', 'Inspeção de corrediças', 5400.00, '2026-03-10', 'Sim', '2026-03-12', 'Aprovado pelo Cliente', '2026-03-05', 2),
(23, '1003', 'Rafael Fernandes Oliveira', 'Corretivo', 'PGO-2026-8833', 'G05', 'CT-2024-008', 'Condomínio Grand Tower', 'ORC-9833/26', 'Modernização de botoeiras', 8900.00, '2026-07-20', 'Sim', '2026-07-22', 'Aprovado pelo Cliente', '2026-07-15', 2),

-- TÉCNICA JULIANA (1005): 2 PGOs Aprovados no Ciclo (Nível 2 - Abaixo da Meta, Valor R$ 21.800)
(24, '1005', 'Juliana Prado Martins', 'Corretivo', 'PGO-2026-8841', 'G05', 'CT-2024-008', 'Condomínio Grand Tower', 'ORC-9841/26', 'Reparo de inversor VVVF', 14300.00, '2026-05-20', 'Sim', '2026-05-22', 'Aprovado pelo Cliente', '2026-05-15', 2),
(25, '1005', 'Juliana Prado Martins', 'Preventivo', 'PGO-2026-8842', 'G05', 'CT-2024-010', 'Complexo Logístico Aeroporto', 'ORC-9842/26', 'Revisão periódica de freios', 7500.00, '2026-08-14', 'Sim', '2026-08-16', 'Aprovado pelo Cliente', '2026-08-08', 2),

-- TÉCNICO ROBERTO (1006): 1 PGO Aprovado no Ciclo (Nível 2 - Abaixo da Meta, Valor R$ 6.300)
(26, '1006', 'Roberto Alencar Lima', 'Corretivo', 'PGO-2026-8851', 'G11', 'CT-2024-006', 'Centro Corporativo Faria Lima', 'ORC-9851/26', 'Troca de cabo de manobra', 6300.00, '2026-06-18', 'Sim', '2026-06-20', 'Aprovado pelo Cliente', '2026-06-12', 1)

-- TÉCNICOS CARLOS (1007) E MARIANA (1008): 0 PGOs Aprovados (Nível 2 - Zero Vendas: Qtd=0, Valor=R$ 0,00)
;


