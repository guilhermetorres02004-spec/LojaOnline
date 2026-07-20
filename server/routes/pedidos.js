const express = require("express");
const pool = require("../db");
const { exigirLogin, exigirPapel } = require("../auth");
const asyncHandler = require("../asyncHandler");

const router = express.Router();

const ETAPAS_STATUS = ["confirmado", "preparando", "enviado", "entregue"];

function promocaoAtiva(produto) {
    const hoje = new Date().toISOString().split("T")[0];
    return Boolean(produto.promocao > 0 && produto.promocao_validade && produto.promocao_validade >= hoje);
}

function precoEfetivo(produto) {
    if (!promocaoAtiva(produto)) return Number(produto.preco);
    return Number(produto.preco) * (1 - produto.promocao / 100);
}

const METODOS_PAGAMENTO = ["pix", "cartao", "boleto"];
const CAMPOS_ENDERECO_OBRIGATORIOS = ["cep", "rua", "numero", "bairro", "cidade", "estado"];

router.post("/", exigirLogin, asyncHandler(async (req, resposta) => {
    const itens = Array.isArray(req.body.itens) ? req.body.itens : [];
    if (itens.length === 0) {
        return resposta.status(400).json({ erro: "O carrinho está vazio." });
    }

    const endereco = req.body.endereco || {};
    const enderecoIncompleto = CAMPOS_ENDERECO_OBRIGATORIOS.some((campo) => !String(endereco[campo] || "").trim());
    if (enderecoIncompleto) {
        return resposta.status(400).json({ erro: "Preencha o endereço de entrega completo." });
    }

    const metodoPagamento = req.body.metodoPagamento;
    if (!METODOS_PAGAMENTO.includes(metodoPagamento)) {
        return resposta.status(400).json({ erro: "Escolha uma forma de pagamento válida." });
    }

    const client = await pool.connect();
    try {
        await client.query("BEGIN");

        let total = 0;
        const itensComprados = [];

        for (const item of itens) {
            const produtoId = Number(item.produtoId);
            const quantidadeDesejada = Number(item.quantidade);
            if (!produtoId || quantidadeDesejada <= 0) continue;

            const { rows } = await client.query("SELECT * FROM produtos WHERE id = $1 FOR UPDATE", [produtoId]);
            const produto = rows[0];
            if (!produto) continue;

            const quantidadeComprada = Math.min(quantidadeDesejada, produto.quantidade);
            if (quantidadeComprada <= 0) continue;

            const precoUnitario = precoEfetivo(produto);
            total += precoUnitario * quantidadeComprada;

            await client.query("UPDATE produtos SET quantidade = quantidade - $1 WHERE id = $2", [
                quantidadeComprada,
                produtoId,
            ]);

            itensComprados.push({ produtoId, quantidade: quantidadeComprada, precoUnitario });
        }

        if (itensComprados.length === 0) {
            await client.query("ROLLBACK");
            return resposta.status(400).json({ erro: "Nenhum item do carrinho está disponível em estoque." });
        }

        const { rows: pedidoRows } = await client.query(
            "INSERT INTO pedidos (usuario_id, total, endereco, metodo_pagamento) VALUES ($1, $2, $3, $4) RETURNING id",
            [req.usuario.id, total, JSON.stringify(endereco), metodoPagamento]
        );
        const pedidoId = pedidoRows[0].id;

        for (const item of itensComprados) {
            await client.query(
                "INSERT INTO pedido_itens (pedido_id, produto_id, quantidade, preco_unitario) VALUES ($1, $2, $3, $4)",
                [pedidoId, item.produtoId, item.quantidade, item.precoUnitario]
            );
        }

        await client.query(
            "UPDATE usuarios SET compras_realizadas = compras_realizadas + 1, total_gasto = total_gasto + $1 WHERE id = $2",
            [total, req.usuario.id]
        );

        await client.query("COMMIT");
        resposta.status(201).json({ pedidoId, total });
    } catch (erro) {
        await client.query("ROLLBACK");
        throw erro;
    } finally {
        client.release();
    }
}));

router.get("/", exigirLogin, asyncHandler(async (req, resposta) => {
    const { rows: pedidos } = await pool.query(
        "SELECT * FROM pedidos WHERE usuario_id = $1 ORDER BY criado_em DESC",
        [req.usuario.id]
    );
    if (pedidos.length === 0) return resposta.json([]);

    const { rows: itens } = await pool.query(
        `SELECT pi.pedido_id, pi.quantidade, pi.preco_unitario, pi.status, p.nome
         FROM pedido_itens pi
         LEFT JOIN produtos p ON p.id = pi.produto_id
         WHERE pi.pedido_id = ANY($1::int[])`,
        [pedidos.map((pedido) => pedido.id)]
    );

    resposta.json(pedidos.map((pedido) => ({
        id: pedido.id,
        total: Number(pedido.total),
        endereco: pedido.endereco,
        metodoPagamento: pedido.metodo_pagamento,
        criadoEm: pedido.criado_em,
        itens: itens
            .filter((item) => item.pedido_id === pedido.id)
            .map((item) => ({
                nome: item.nome || "Produto removido",
                quantidade: item.quantidade,
                precoUnitario: Number(item.preco_unitario),
                status: item.status,
            })),
    })));
}));

router.get("/vendedor", exigirLogin, exigirPapel("admin", "vendedor"), asyncHandler(async (req, resposta) => {
    const ehAdmin = req.usuario.papel === "admin";
    const { rows } = await pool.query(
        `SELECT
            pi.id, pi.quantidade, pi.preco_unitario, pi.status, pi.atualizado_em,
            p.nome AS produto_nome, p.marca AS produto_marca,
            ped.id AS pedido_id, ped.criado_em, ped.endereco,
            u.nome AS comprador_nome, u.email AS comprador_email
         FROM pedido_itens pi
         JOIN produtos p ON p.id = pi.produto_id
         JOIN pedidos ped ON ped.id = pi.pedido_id
         JOIN usuarios u ON u.id = ped.usuario_id
         WHERE $1 OR p.criado_por_id = $2
         ORDER BY ped.criado_em DESC`,
        [ehAdmin, req.usuario.id]
    );

    if (rows.length > 0) {
        await pool.query("UPDATE pedido_itens SET visto = true WHERE id = ANY($1::int[])", [rows.map((linha) => linha.id)]);
    }

    resposta.json(rows.map((linha) => ({
        id: linha.id,
        pedidoId: linha.pedido_id,
        produtoNome: linha.produto_nome,
        produtoMarca: linha.produto_marca,
        quantidade: linha.quantidade,
        precoUnitario: Number(linha.preco_unitario),
        status: linha.status,
        atualizadoEm: linha.atualizado_em,
        criadoEm: linha.criado_em,
        endereco: linha.endereco,
        compradorNome: linha.comprador_nome,
        compradorEmail: linha.comprador_email,
    })));
}));

router.get("/vendedor/nao-processados", exigirLogin, exigirPapel("admin", "vendedor"), asyncHandler(async (req, resposta) => {
    const ehAdmin = req.usuario.papel === "admin";
    const { rows } = await pool.query(
        `SELECT COUNT(*)::int AS total
         FROM pedido_itens pi
         JOIN produtos p ON p.id = pi.produto_id
         WHERE pi.visto = false AND ($1 OR p.criado_por_id = $2)`,
        [ehAdmin, req.usuario.id]
    );
    resposta.json({ naoProcessados: rows[0].total });
}));

router.put("/itens/:id/status", exigirLogin, exigirPapel("admin", "vendedor"), asyncHandler(async (req, resposta) => {
    const novoStatus = req.body.status;
    if (!ETAPAS_STATUS.includes(novoStatus)) {
        return resposta.status(400).json({ erro: "Status inválido." });
    }

    const { rows } = await pool.query(
        `SELECT pi.*, p.criado_por_id FROM pedido_itens pi JOIN produtos p ON p.id = pi.produto_id WHERE pi.id = $1`,
        [req.params.id]
    );
    const item = rows[0];
    if (!item) return resposta.status(404).json({ erro: "Item do pedido não encontrado." });

    const ehAdmin = req.usuario.papel === "admin";
    if (!ehAdmin && item.criado_por_id !== req.usuario.id) {
        return resposta.status(403).json({ erro: "Você não tem permissão para atualizar este pedido." });
    }

    if (ETAPAS_STATUS.indexOf(novoStatus) < ETAPAS_STATUS.indexOf(item.status)) {
        return resposta.status(400).json({ erro: "Não é possível voltar o status para uma etapa anterior." });
    }

    const { rows: atualizados } = await pool.query(
        "UPDATE pedido_itens SET status = $1, atualizado_em = now() WHERE id = $2 RETURNING *",
        [novoStatus, req.params.id]
    );
    resposta.json({ id: atualizados[0].id, status: atualizados[0].status });
}));

router.get("/:id", exigirLogin, asyncHandler(async (req, resposta) => {
    const { rows: pedidos } = await pool.query(
        "SELECT * FROM pedidos WHERE id = $1 AND usuario_id = $2",
        [req.params.id, req.usuario.id]
    );
    const pedido = pedidos[0];
    if (!pedido) return resposta.status(404).json({ erro: "Pedido não encontrado." });

    const { rows: itens } = await pool.query(
        `SELECT pi.quantidade, pi.preco_unitario, pi.status, p.nome
         FROM pedido_itens pi
         LEFT JOIN produtos p ON p.id = pi.produto_id
         WHERE pi.pedido_id = $1`,
        [pedido.id]
    );

    resposta.json({
        id: pedido.id,
        total: Number(pedido.total),
        endereco: pedido.endereco,
        metodoPagamento: pedido.metodo_pagamento,
        criadoEm: pedido.criado_em,
        itens: itens.map((item) => ({
            nome: item.nome || "Produto removido",
            quantidade: item.quantidade,
            precoUnitario: Number(item.preco_unitario),
            status: item.status,
        })),
    });
}));

module.exports = router;
