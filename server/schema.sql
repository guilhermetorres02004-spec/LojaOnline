-- Schema do WGStore

CREATE TABLE IF NOT EXISTS usuarios (
    id SERIAL PRIMARY KEY,
    nome TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    senha_hash TEXT NOT NULL,
    cpf TEXT,
    cnpj TEXT,
    telefone TEXT,
    papel TEXT NOT NULL DEFAULT 'cliente' CHECK (papel IN ('cliente', 'admin', 'vendedor')),
    status_cadastro TEXT NOT NULL DEFAULT 'aprovado' CHECK (status_cadastro IN ('aprovado', 'pendente')),
    data_cadastro TIMESTAMPTZ NOT NULL DEFAULT now(),
    compras_realizadas INTEGER NOT NULL DEFAULT 0,
    total_gasto NUMERIC(12, 2) NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS produtos (
    id SERIAL PRIMARY KEY,
    nome TEXT NOT NULL,
    tipo TEXT NOT NULL,
    marca TEXT NOT NULL,
    quantidade INTEGER NOT NULL DEFAULT 0,
    preco NUMERIC(12, 2) NOT NULL DEFAULT 0,
    foto TEXT,
    descricao TEXT,
    no_carrossel BOOLEAN NOT NULL DEFAULT false,
    criado_por_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
    criado_em DATE NOT NULL DEFAULT CURRENT_DATE,
    promocao INTEGER NOT NULL DEFAULT 0,
    promocao_validade DATE
);

CREATE TABLE IF NOT EXISTS pedidos (
    id SERIAL PRIMARY KEY,
    usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    total NUMERIC(12, 2) NOT NULL DEFAULT 0,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS pedido_itens (
    id SERIAL PRIMARY KEY,
    pedido_id INTEGER NOT NULL REFERENCES pedidos(id) ON DELETE CASCADE,
    produto_id INTEGER REFERENCES produtos(id) ON DELETE SET NULL,
    quantidade INTEGER NOT NULL,
    preco_unitario NUMERIC(12, 2) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_produtos_criado_por ON produtos(criado_por_id);
CREATE INDEX IF NOT EXISTS idx_pedidos_usuario ON pedidos(usuario_id);
CREATE INDEX IF NOT EXISTS idx_pedido_itens_pedido ON pedido_itens(pedido_id);
