-- =====================================================================
-- SEED DATA: DADOS OFICIAIS DE PRODUÇÃO (TKE ELEVADORES)
-- =====================================================================

-- 1. CLIENTES INICIAIS
INSERT OR REPLACE INTO clientes (numero_contrato, nome_cliente) VALUES
('3593', 'Jairo Correa'),
('5477', 'Ed. Corinto');

-- 2. TÉCNICOS OFICIAIS DE CAMPO (28 TÉCNICOS TKE)
INSERT OR REPLACE INTO tecnicos (matricula, funcao, nome_sobrenome, email, telefone) VALUES
-- Grupo G11
('55011768', 'Técnico Preventivo', 'CAIO CEZAR SILVA', 'caio.silva2@tkelevator.com', NULL),
('55021126', 'Técnico Preventivo', 'LEONARDO MENEZES SILVERIO', 'leonardo.silverio@tkelevator.com', NULL),
('55018256', 'Técnico Preventivo', 'GABRIEL HENRIQUE DA SILVA SANTOS', 'gabriel.santos1@tkelevator.com', NULL),
('55018990', 'Técnico Preventivo', 'GUILHERME JUAN DOUETTS', 'guilherme.douetts@tkelevator.com', NULL),
('55012528', 'Técnico Preventivo', 'JOAO LUCAS COSTA DO CARMO', 'joao.carmo@tkelevator.com', NULL),
('55020162', 'Técnico Preventivo', 'RODRIGO DE OLIVEIRA MACHADO', 'rodrigo.machado@tkelevator.com', NULL),
('55019331', 'Técnico Corretivo', 'GUILHERME GONÇALVES MURCA', 'guilherme.murca@tkelevator.com', NULL),
('55011402', 'Técnico Corretivo', 'ALAN BATISTA BARBOSA BARROS', 'alan.barros@tkelevator.com', NULL),
('55011011', 'Técnico Corretivo', 'SIDNEI SANTOS POLICARPO', 'sidnei.policarpo@tkelevator.com', NULL),
-- Grupo G06
('55007503', 'Técnico Preventivo', 'ARQUIMEDES PIRES DA SILVA', 'arquimedes.silva@tkelevator.com', NULL),
('55015408', 'Técnico Preventivo', 'ALBENES SILVA CHAGAS', 'albenes.chagas@tkelevator.com', NULL),
('55008491', 'Técnico Preventivo', 'MARCELO SEIJI HIRATSUKA', 'marcelo.hiratsuka@tkelevator.com', NULL),
('55018920', 'Técnico Preventivo', 'BRUNO FERREIRA CORREIA DE SOUZA', 'bruno.souza2@tkelevator.com', NULL),
('55019205', 'Técnico Preventivo', 'REGINALDO TAVARES FERREIRA', 'reginaldo.ferreira@tkelevator.com', NULL),
('55011293', 'Técnico Residente', 'ANDERSON VINICIUS DO NASCIMENTO', 'anderson.nascimento@tkelevator.com', NULL),
('55012716', 'Técnico Corretivo', 'DENIS CAMPOS ALVES LUIZ COSTA', 'denis.costa@tkelevator.com', NULL),
('55003302', 'Técnico Corretivo', 'RONALDO LOPES DA COSTA', 'ronaldo.costa@tkelevator.com', NULL),
('55010003', 'Técnico Corretivo', 'SERGIO DA SILVA SOUZA', 'sergio.souza@tkelevator.com', NULL),
('55016366', 'Técnico Corretivo', 'VINICIUS BARBOSA BALTAZAR DA SILVA', 'vinicius.silva@tkelevator.com', NULL),
-- Grupo G05
('55007943', 'Técnico Preventivo', 'CARLOS FELIPE DA SILVA LEMOS', 'carlos.lemos@tkelevator.com', NULL),
('55006730', 'Técnico Preventivo', 'GILVAN JOAQUIM DE SOUSA', 'gilvan.sousa@tkelevator.com', NULL),
('55014054', 'Técnico Preventivo', 'ISMAEL GONCALVES DOS SANTOS', 'ismael.santos2@tkelevator.com', NULL),
('55012050', 'Técnico Preventivo', 'JEFFERSON BARBOSA GRIGORIO', 'jefferson.grigorio@tkelevator.com', NULL),
('55013973', 'Técnico Preventivo', 'JEFFERSON SOUZA MARQUES', 'jefferson.marques@tkelevator.com', NULL),
('55020622', 'Técnico Preventivo', 'EMERSON DA SILVA NASCIMENTO IKEDA', 'emerson.ikeda@tkelevator.com', NULL),
('55002462', 'Técnico Corretivo', 'FERNANDO DE MENDONCA COSTA', 'fernando.costa@tkelevator.com', NULL),
('55018175', 'Técnico Corretivo', 'GABRIEL NASCIMENTO DE OLIVEIRA', 'gabriel.oliveira@tkelevator.com', NULL),
('55010811', 'Técnico Corretivo', 'RODRIGO ALVES DA SILVA', 'rodrigo.silva3@tkelevator.com', NULL);

-- 3. USUÁRIOS OFICIAIS (SENHA PADRÃO: Senha@12345)
-- Bcrypt Hash para 'Senha@12345': $2b$10$lPjOSXnA8CF1F7RjTd7OY.4w5FwMNgtfpnL6PrGvTXNzUYHDUCRy6
INSERT OR REPLACE INTO usuarios (matricula, nome, email, senha_hash, perfil, grupo, primeiro_acesso, ativo) VALUES
-- Consultora (Admin)
('55011190', 'Thaís Lima', 'thais.lima@tkelevator.com', '$2b$10$lPjOSXnA8CF1F7RjTd7OY.4w5FwMNgtfpnL6PrGvTXNzUYHDUCRy6', 'CONSULTORA', 'G11', 0, 1),
-- Supervisores
('55007886', 'GENILSO RIBEIRO MENDES', 'genilso.mendes@tkelevator.com', '$2b$10$lPjOSXnA8CF1F7RjTd7OY.4w5FwMNgtfpnL6PrGvTXNzUYHDUCRy6', 'SUPERVISOR', 'G11', 0, 1),
('55012476', 'JOSEMAR ORLANDINI', 'josemar.orlandini@tkelevator.com', '$2b$10$lPjOSXnA8CF1F7RjTd7OY.4w5FwMNgtfpnL6PrGvTXNzUYHDUCRy6', 'SUPERVISOR', 'G06', 0, 1),
('55021156', 'MARCO ANTONIO ARANHA SALGADO FILHO', 'marco.filho@tkelevator.com', '$2b$10$lPjOSXnA8CF1F7RjTd7OY.4w5FwMNgtfpnL6PrGvTXNzUYHDUCRy6', 'SUPERVISOR', 'G05', 0, 1),
-- Técnicos G11
('55011768', 'CAIO CEZAR SILVA', 'caio.silva2@tkelevator.com', '$2b$10$lPjOSXnA8CF1F7RjTd7OY.4w5FwMNgtfpnL6PrGvTXNzUYHDUCRy6', 'TECNICO', 'G11', 0, 1),
('55021126', 'LEONARDO MENEZES SILVERIO', 'leonardo.silverio@tkelevator.com', '$2b$10$lPjOSXnA8CF1F7RjTd7OY.4w5FwMNgtfpnL6PrGvTXNzUYHDUCRy6', 'TECNICO', 'G11', 0, 1),
('55018256', 'GABRIEL HENRIQUE DA SILVA SANTOS', 'gabriel.santos1@tkelevator.com', '$2b$10$lPjOSXnA8CF1F7RjTd7OY.4w5FwMNgtfpnL6PrGvTXNzUYHDUCRy6', 'TECNICO', 'G11', 0, 1),
('55018990', 'GUILHERME JUAN DOUETTS', 'guilherme.douetts@tkelevator.com', '$2b$10$lPjOSXnA8CF1F7RjTd7OY.4w5FwMNgtfpnL6PrGvTXNzUYHDUCRy6', 'TECNICO', 'G11', 0, 1),
('55012528', 'JOAO LUCAS COSTA DO CARMO', 'joao.carmo@tkelevator.com', '$2b$10$lPjOSXnA8CF1F7RjTd7OY.4w5FwMNgtfpnL6PrGvTXNzUYHDUCRy6', 'TECNICO', 'G11', 0, 1),
('55020162', 'RODRIGO DE OLIVEIRA MACHADO', 'rodrigo.machado@tkelevator.com', '$2b$10$lPjOSXnA8CF1F7RjTd7OY.4w5FwMNgtfpnL6PrGvTXNzUYHDUCRy6', 'TECNICO', 'G11', 0, 1),
('55019331', 'GUILHERME GONÇALVES MURCA', 'guilherme.murca@tkelevator.com', '$2b$10$lPjOSXnA8CF1F7RjTd7OY.4w5FwMNgtfpnL6PrGvTXNzUYHDUCRy6', 'TECNICO', 'G11', 0, 1),
('55011402', 'ALAN BATISTA BARBOSA BARROS', 'alan.barros@tkelevator.com', '$2b$10$lPjOSXnA8CF1F7RjTd7OY.4w5FwMNgtfpnL6PrGvTXNzUYHDUCRy6', 'TECNICO', 'G11', 0, 1),
('55011011', 'SIDNEI SANTOS POLICARPO', 'sidnei.policarpo@tkelevator.com', '$2b$10$lPjOSXnA8CF1F7RjTd7OY.4w5FwMNgtfpnL6PrGvTXNzUYHDUCRy6', 'TECNICO', 'G11', 0, 1),
-- Técnicos G06
('55007503', 'ARQUIMEDES PIRES DA SILVA', 'arquimedes.silva@tkelevator.com', '$2b$10$lPjOSXnA8CF1F7RjTd7OY.4w5FwMNgtfpnL6PrGvTXNzUYHDUCRy6', 'TECNICO', 'G06', 0, 1),
('55015408', 'ALBENES SILVA CHAGAS', 'albenes.chagas@tkelevator.com', '$2b$10$lPjOSXnA8CF1F7RjTd7OY.4w5FwMNgtfpnL6PrGvTXNzUYHDUCRy6', 'TECNICO', 'G06', 0, 1),
('55008491', 'MARCELO SEIJI HIRATSUKA', 'marcelo.hiratsuka@tkelevator.com', '$2b$10$lPjOSXnA8CF1F7RjTd7OY.4w5FwMNgtfpnL6PrGvTXNzUYHDUCRy6', 'TECNICO', 'G06', 0, 1),
('55018920', 'BRUNO FERREIRA CORREIA DE SOUZA', 'bruno.souza2@tkelevator.com', '$2b$10$lPjOSXnA8CF1F7RjTd7OY.4w5FwMNgtfpnL6PrGvTXNzUYHDUCRy6', 'TECNICO', 'G06', 0, 1),
('55019205', 'REGINALDO TAVARES FERREIRA', 'reginaldo.ferreira@tkelevator.com', '$2b$10$lPjOSXnA8CF1F7RjTd7OY.4w5FwMNgtfpnL6PrGvTXNzUYHDUCRy6', 'TECNICO', 'G06', 0, 1),
('55011293', 'ANDERSON VINICIUS DO NASCIMENTO', 'anderson.nascimento@tkelevator.com', '$2b$10$lPjOSXnA8CF1F7RjTd7OY.4w5FwMNgtfpnL6PrGvTXNzUYHDUCRy6', 'TECNICO', 'G06', 0, 1),
('55012716', 'DENIS CAMPOS ALVES LUIZ COSTA', 'denis.costa@tkelevator.com', '$2b$10$lPjOSXnA8CF1F7RjTd7OY.4w5FwMNgtfpnL6PrGvTXNzUYHDUCRy6', 'TECNICO', 'G06', 0, 1),
('55003302', 'RONALDO LOPES DA COSTA', 'ronaldo.costa@tkelevator.com', '$2b$10$lPjOSXnA8CF1F7RjTd7OY.4w5FwMNgtfpnL6PrGvTXNzUYHDUCRy6', 'TECNICO', 'G06', 0, 1),
('55010003', 'SERGIO DA SILVA SOUZA', 'sergio.souza@tkelevator.com', '$2b$10$lPjOSXnA8CF1F7RjTd7OY.4w5FwMNgtfpnL6PrGvTXNzUYHDUCRy6', 'TECNICO', 'G06', 0, 1),
('55016366', 'VINICIUS BARBOSA BALTAZAR DA SILVA', 'vinicius.silva@tkelevator.com', '$2b$10$lPjOSXnA8CF1F7RjTd7OY.4w5FwMNgtfpnL6PrGvTXNzUYHDUCRy6', 'TECNICO', 'G06', 0, 1),
-- Técnicos G05
('55007943', 'CARLOS FELIPE DA SILVA LEMOS', 'carlos.lemos@tkelevator.com', '$2b$10$lPjOSXnA8CF1F7RjTd7OY.4w5FwMNgtfpnL6PrGvTXNzUYHDUCRy6', 'TECNICO', 'G05', 0, 1),
('55006730', 'GILVAN JOAQUIM DE SOUSA', 'gilvan.sousa@tkelevator.com', '$2b$10$lPjOSXnA8CF1F7RjTd7OY.4w5FwMNgtfpnL6PrGvTXNzUYHDUCRy6', 'TECNICO', 'G05', 0, 1),
('55014054', 'ISMAEL GONCALVES DOS SANTOS', 'ismael.santos2@tkelevator.com', '$2b$10$lPjOSXnA8CF1F7RjTd7OY.4w5FwMNgtfpnL6PrGvTXNzUYHDUCRy6', 'TECNICO', 'G05', 0, 1),
('55012050', 'JEFFERSON BARBOSA GRIGORIO', 'jefferson.grigorio@tkelevator.com', '$2b$10$lPjOSXnA8CF1F7RjTd7OY.4w5FwMNgtfpnL6PrGvTXNzUYHDUCRy6', 'TECNICO', 'G05', 0, 1),
('55013973', 'JEFFERSON SOUZA MARQUES', 'jefferson.marques@tkelevator.com', '$2b$10$lPjOSXnA8CF1F7RjTd7OY.4w5FwMNgtfpnL6PrGvTXNzUYHDUCRy6', 'TECNICO', 'G05', 0, 1),
('55020622', 'EMERSON DA SILVA NASCIMENTO IKEDA', 'emerson.ikeda@tkelevator.com', '$2b$10$lPjOSXnA8CF1F7RjTd7OY.4w5FwMNgtfpnL6PrGvTXNzUYHDUCRy6', 'TECNICO', 'G05', 0, 1),
('55002462', 'FERNANDO DE MENDONCA COSTA', 'fernando.costa@tkelevator.com', '$2b$10$lPjOSXnA8CF1F7RjTd7OY.4w5FwMNgtfpnL6PrGvTXNzUYHDUCRy6', 'TECNICO', 'G05', 0, 1),
('55018175', 'GABRIEL NASCIMENTO DE OLIVEIRA', 'gabriel.oliveira@tkelevator.com', '$2b$10$lPjOSXnA8CF1F7RjTd7OY.4w5FwMNgtfpnL6PrGvTXNzUYHDUCRy6', 'TECNICO', 'G05', 0, 1),
('55010811', 'RODRIGO ALVES DA SILVA', 'rodrigo.silva3@tkelevator.com', '$2b$10$lPjOSXnA8CF1F7RjTd7OY.4w5FwMNgtfpnL6PrGvTXNzUYHDUCRy6', 'TECNICO', 'G05', 0, 1);
