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
    total_gasto NUMERIC(12, 2) NOT NULL DEFAULT 0,
    reset_token_hash TEXT,
    reset_token_expira TIMESTAMPTZ
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
    endereco JSONB,
    metodo_pagamento TEXT,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS pedido_itens (
    id SERIAL PRIMARY KEY,
    pedido_id INTEGER NOT NULL REFERENCES pedidos(id) ON DELETE CASCADE,
    produto_id INTEGER REFERENCES produtos(id) ON DELETE SET NULL,
    quantidade INTEGER NOT NULL,
    preco_unitario NUMERIC(12, 2) NOT NULL,
    status TEXT NOT NULL DEFAULT 'confirmado' CHECK (status IN ('confirmado', 'preparando', 'enviado', 'entregue')),
    visto BOOLEAN NOT NULL DEFAULT false,
    atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS conversas_suporte (
    id SERIAL PRIMARY KEY,
    usuario_id INTEGER NOT NULL UNIQUE REFERENCES usuarios(id) ON DELETE CASCADE,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
    atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS mensagens_suporte (
    id SERIAL PRIMARY KEY,
    conversa_id INTEGER NOT NULL REFERENCES conversas_suporte(id) ON DELETE CASCADE,
    autor_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    de_admin BOOLEAN NOT NULL DEFAULT false,
    texto TEXT NOT NULL,
    lida BOOLEAN NOT NULL DEFAULT false,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS comentarios_produto (
    id SERIAL PRIMARY KEY,
    produto_id INTEGER NOT NULL REFERENCES produtos(id) ON DELETE CASCADE,
    usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    texto TEXT NOT NULL,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tentativas_login (
    id SERIAL PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    tentativas INTEGER NOT NULL DEFAULT 0,
    primeira_tentativa TIMESTAMPTZ NOT NULL DEFAULT now(),
    bloqueado_ate TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_produtos_criado_por ON produtos(criado_por_id);
CREATE INDEX IF NOT EXISTS idx_pedidos_usuario ON pedidos(usuario_id);
CREATE INDEX IF NOT EXISTS idx_pedido_itens_pedido ON pedido_itens(pedido_id);
CREATE INDEX IF NOT EXISTS idx_mensagens_suporte_conversa ON mensagens_suporte(conversa_id);
CREATE INDEX IF NOT EXISTS idx_comentarios_produto_produto ON comentarios_produto(produto_id);
