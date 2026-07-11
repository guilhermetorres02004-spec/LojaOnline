const express = require("express");
const pool = require("../db");
const { exigirLogin, exigirPapel } = require("../auth");
const asyncHandler = require("../asyncHandler");

const router = express.Router();
const LIMITE_PRODUTOS_VENDEDOR_DIA = 30;

function paraProduto(linha) {
    return {
        id: linha.id,
        nome: linha.nome,
        tipo: linha.tipo,
        marca: linha.marca,
        quantidade: linha.quantidade,
        preco: Number(linha.preco),
        foto: linha.foto || "",
        descricao: linha.descricao || "",
        noCarrossel: linha.no_carrossel,
        criadoPorId: linha.criado_por_id,
        criadoEm: linha.criado_em,
        promocao: linha.promocao || 0,
        promocaoValidade: linha.promocao_validade,
    };
}

router.get("/", asyncHandler(async (req, resposta) => {
    const { rows } = await pool.query("SELECT * FROM produtos ORDER BY id DESC");
    resposta.json(rows.map(paraProduto));
}));

router.get("/:id", asyncHandler(async (req, resposta) => {
    const { rows } = await pool.query("SELECT * FROM produtos WHERE id = $1", [req.params.id]);
    if (!rows[0]) return resposta.status(404).json({ erro: "Produto não encontrado." });
    resposta.json(paraProduto(rows[0]));
}));

router.post("/", exigirLogin, exigirPapel("admin", "vendedor"), asyncHandler(async (req, resposta) => {
    const { nome, tipo, marca, quantidade, preco, foto, descricao } = req.body;
    let noCarrossel = Boolean(req.body.noCarrossel);

    if (!nome || !tipo || !marca || Number(quantidade) < 0 || Number(preco) < 0) {
        return resposta.status(400).json({ erro: "Preencha todos os campos corretamente." });
    }

    const ehVendedor = req.usuario.papel === "vendedor";
    if (ehVendedor) {
        noCarrossel = false;
        const { rows } = await pool.query(
            "SELECT COUNT(*)::int AS total FROM produtos WHERE criado_por_id = $1 AND criado_em = CURRENT_DATE",
            [req.usuario.id]
        );
        if (rows[0].total >= LIMITE_PRODUTOS_VENDEDOR_DIA) {
            return resposta.status(429).json({
                erro: `Você atingiu o limite de ${LIMITE_PRODUTOS_VENDEDOR_DIA} produtos por dia. Tente novamente amanhã.`,
            });
        }
    }

    const { rows } = await pool.query(
        `INSERT INTO produtos (nome, tipo, marca, quantidade, preco, foto, descricao, no_carrossel, criado_por_id, criado_em)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, CURRENT_DATE) RETURNING *`,
        [nome, tipo, marca, quantidade, preco, foto || "", descricao || "", noCarrossel, req.usuario.id]
    );
    resposta.status(201).json(paraProduto(rows[0]));
}));

router.put("/:id", exigirLogin, exigirPapel("admin", "vendedor"), asyncHandler(async (req, resposta) => {
    const { nome, tipo, marca, quantidade, preco, foto, descricao } = req.body;
    let noCarrossel = Boolean(req.body.noCarrossel);

    if (!nome || !tipo || !marca || Number(quantidade) < 0 || Number(preco) < 0) {
        return resposta.status(400).json({ erro: "Preencha todos os campos corretamente." });
    }

    if (req.usuario.papel === "vendedor") {
        noCarrossel = false;
    }

    const { rows } = await pool.query(
        `UPDATE produtos
         SET nome = $1, tipo = $2, marca = $3, quantidade = $4, preco = $5, foto = $6, descricao = $7, no_carrossel = $8
         WHERE id = $9 RETURNING *`,
        [nome, tipo, marca, quantidade, preco, foto || "", descricao || "", noCarrossel, req.params.id]
    );
    if (!rows[0]) return resposta.status(404).json({ erro: "Produto não encontrado." });
    resposta.json(paraProduto(rows[0]));
}));

router.put("/:id/promocao", exigirLogin, exigirPapel("admin"), asyncHandler(async (req, resposta) => {
    const { promocao, promocaoValidade } = req.body;
    const percentual = Number(promocao);

    if (!percentual || percentual < 1 || percentual > 90) {
        return resposta.status(400).json({ erro: "Informe um desconto entre 1% e 90%." });
    }
    if (!promocaoValidade) {
        return resposta.status(400).json({ erro: "Escolha a data em que a promoção termina." });
    }

    const { rows } = await pool.query(
        "UPDATE produtos SET promocao = $1, promocao_validade = $2 WHERE id = $3 RETURNING *",
        [percentual, promocaoValidade, req.params.id]
    );
    if (!rows[0]) return resposta.status(404).json({ erro: "Produto não encontrado." });
    resposta.json(paraProduto(rows[0]));
}));

router.delete("/:id/promocao", exigirLogin, exigirPapel("admin"), asyncHandler(async (req, resposta) => {
    const { rows } = await pool.query(
        "UPDATE produtos SET promocao = 0, promocao_validade = NULL WHERE id = $1 RETURNING *",
        [req.params.id]
    );
    if (!rows[0]) return resposta.status(404).json({ erro: "Produto não encontrado." });
    resposta.json(paraProduto(rows[0]));
}));

router.delete("/", exigirLogin, exigirPapel("admin", "vendedor"), asyncHandler(async (req, resposta) => {
    const ids = Array.isArray(req.body.ids) ? req.body.ids : [];
    if (ids.length === 0) return resposta.status(400).json({ erro: "Nenhum produto selecionado." });
    await pool.query("DELETE FROM produtos WHERE id = ANY($1::int[])", [ids]);
    resposta.json({ removidos: ids.length });
}));

router.delete("/:id", exigirLogin, exigirPapel("admin", "vendedor"), asyncHandler(async (req, resposta) => {
    await pool.query("DELETE FROM produtos WHERE id = $1", [req.params.id]);
    resposta.json({ removido: true });
}));

module.exports = router;
