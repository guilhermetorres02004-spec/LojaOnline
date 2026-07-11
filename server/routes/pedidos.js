const express = require("express");
const pool = require("../db");
const { exigirLogin } = require("../auth");
const asyncHandler = require("../asyncHandler");

const router = express.Router();

function promocaoAtiva(produto) {
    const hoje = new Date().toISOString().split("T")[0];
    return Boolean(produto.promocao > 0 && produto.promocao_validade && produto.promocao_validade >= hoje);
}

function precoEfetivo(produto) {
    if (!promocaoAtiva(produto)) return Number(produto.preco);
    return Number(produto.preco) * (1 - produto.promocao / 100);
}

router.post("/", exigirLogin, asyncHandler(async (req, resposta) => {
    const itens = Array.isArray(req.body.itens) ? req.body.itens : [];
    if (itens.length === 0) {
        return resposta.status(400).json({ erro: "O carrinho está vazio." });
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
            "INSERT INTO pedidos (usuario_id, total) VALUES ($1, $2) RETURNING id",
            [req.usuario.id, total]
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

module.exports = router;
