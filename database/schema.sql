-- =====================================================================
-- SCHEMA DDL: SISTEMA CORPORATIVO DE GERENCIAMENTO DE ORÇAMENTOS
-- Compatível com SQLite 3 e PostgreSQL
-- =====================================================================

-- 1. TABELA DE USUÁRIOS DO SISTEMA COM RBAC
CREATE TABLE IF NOT EXISTS usuarios (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome VARCHAR(100) NOT NULL,
    email VARCHAR(120) NOT NULL UNIQUE,
    matricula VARCHAR(30) NOT NULL UNIQUE,
    senha_hash VARCHAR(255) NOT NULL,
    perfil VARCHAR(20) NOT NULL CHECK(perfil IN ('TECNICO', 'SUPERVISOR', 'CONSULTORA')),
    grupo VARCHAR(10) NOT NULL DEFAULT 'G11' CHECK(grupo IN ('G11', 'G06', 'G05')),
    primeiro_acesso INTEGER NOT NULL DEFAULT 1 CHECK(primeiro_acesso IN (0, 1)),
    ativo INTEGER NOT NULL DEFAULT 1 CHECK(ativo IN (0, 1)),
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 2. TABELA DE CLIENTES
CREATE TABLE IF NOT EXISTS clientes (
    numero_contrato VARCHAR(50) PRIMARY KEY,
    nome_cliente VARCHAR(150) NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 3. TABELA DE TÉCNICOS
CREATE TABLE IF NOT EXISTS tecnicos (
    matricula VARCHAR(30) PRIMARY KEY,
    funcao VARCHAR(80) NOT NULL DEFAULT 'Técnico de Manutenção',
    nome_sobrenome VARCHAR(120) NOT NULL,
    email VARCHAR(120),
    telefone VARCHAR(20),
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 4. TABELA DE CHAMADOS / ORÇAMENTOS
CREATE TABLE IF NOT EXISTS chamados_orcamentos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    matricula_tecnico VARCHAR(30) NOT NULL,
    nome_tecnico VARCHAR(120) NOT NULL,
    tipo_servico VARCHAR(20) NOT NULL CHECK(tipo_servico IN ('Preventivo', 'Corretivo')),
    numero_pgo VARCHAR(50) NOT NULL,
    g_origem VARCHAR(10) NOT NULL DEFAULT 'G11' CHECK(g_origem IN ('G11', 'G06', 'G05')),
    numero_contrato VARCHAR(50) NOT NULL,
    nome_cliente VARCHAR(150) NOT NULL,
    numero_orcamento VARCHAR(50) NOT NULL DEFAULT 'Aguardando Orçamento',
    descricao_servico TEXT,
    data_liberacao DATE,
    geor_liberou VARCHAR(10) NOT NULL DEFAULT 'Não' CHECK(geor_liberou IN ('Sim', 'Não')),
    data_envio_cliente DATE,
    status VARCHAR(30) NOT NULL DEFAULT 'Aberto' CHECK(
        status IN (
            'Aberto',
            'Em Análise',
            'Aguardando GEOR',
            'Liberado GEOR',
            'Enviado ao Cliente',
            'Aprovado pelo Cliente',
            'Reprovado pelo Cliente',
            'Concluído',
            'Cancelado'
        )
    ),
    valor_total REAL NOT NULL DEFAULT 0.00,
    data_criacao DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by_id INTEGER,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (numero_contrato) REFERENCES clientes(numero_contrato) ON UPDATE CASCADE,
    FOREIGN KEY (matricula_tecnico) REFERENCES tecnicos(matricula) ON UPDATE CASCADE,
    FOREIGN KEY (created_by_id) REFERENCES usuarios(id) ON DELETE SET NULL
);

-- ÍNDICES DE PERFORMANCE E CONSULTAS FREQUENTES
CREATE INDEX IF NOT EXISTS idx_chamados_matricula ON chamados_orcamentos(matricula_tecnico);
CREATE INDEX IF NOT EXISTS idx_chamados_contrato ON chamados_orcamentos(numero_contrato);
CREATE INDEX IF NOT EXISTS idx_chamados_status ON chamados_orcamentos(status);
CREATE INDEX IF NOT EXISTS idx_chamados_geor ON chamados_orcamentos(geor_liberou);
CREATE INDEX IF NOT EXISTS idx_chamados_pgo ON chamados_orcamentos(numero_pgo);
CREATE INDEX IF NOT EXISTS idx_usuarios_email ON usuarios(email);
CREATE INDEX IF NOT EXISTS idx_usuarios_matricula ON usuarios(matricula);
