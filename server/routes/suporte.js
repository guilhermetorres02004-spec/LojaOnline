const express = require("express");
const pool = require("../db");
const { exigirLogin, exigirPapel } = require("../auth");
const asyncHandler = require("../asyncHandler");

const router = express.Router();

function paraMensagem(linha) {
    return {
        id: linha.id,
        conversaId: linha.conversa_id,
        autorId: linha.autor_id,
        deAdmin: linha.de_admin,
        texto: linha.texto,
        lida: linha.lida,
        criadoEm: linha.criado_em,
    };
}

async function obterOuCriarConversa(usuarioId) {
    const existente = await pool.query("SELECT * FROM conversas_suporte WHERE usuario_id = $1", [usuarioId]);
    if (existente.rows[0]) return existente.rows[0];

    const { rows } = await pool.query(
        "INSERT INTO conversas_suporte (usuario_id) VALUES ($1) RETURNING *",
        [usuarioId]
    );
    return rows[0];
}

router.get("/conversa", exigirLogin, asyncHandler(async (req, resposta) => {
    const conversa = await obterOuCriarConversa(req.usuario.id);
    await pool.query(
        "UPDATE mensagens_suporte SET lida = true WHERE conversa_id = $1 AND de_admin = true AND lida = false",
        [conversa.id]
    );
    const { rows } = await pool.query(
        "SELECT * FROM mensagens_suporte WHERE conversa_id = $1 ORDER BY criado_em",
        [conversa.id]
    );
    resposta.json({ id: conversa.id, mensagens: rows.map(paraMensagem) });
}));

router.get("/conversa/nao-lidas", exigirLogin, asyncHandler(async (req, resposta) => {
    const { rows } = await pool.query(
        `SELECT COUNT(*)::int AS total FROM mensagens_suporte m
         JOIN conversas_suporte c ON c.id = m.conversa_id
         WHERE c.usuario_id = $1 AND m.de_admin = true AND m.lida = false`,
        [req.usuario.id]
    );
    resposta.json({ naoLidas: rows[0].total });
}));

router.post("/conversa/mensagens", exigirLogin, asyncHandler(async (req, resposta) => {
    const texto = (req.body.texto || "").trim();
    if (!texto) {
        return resposta.status(400).json({ erro: "Escreva uma mensagem antes de enviar." });
    }

    const conversa = await obterOuCriarConversa(req.usuario.id);
    const { rows } = await pool.query(
        `INSERT INTO mensagens_suporte (conversa_id, autor_id, de_admin, texto)
         VALUES ($1, $2, false, $3) RETURNING *`,
        [conversa.id, req.usuario.id, texto]
    );
    await pool.query("UPDATE conversas_suporte SET atualizado_em = now() WHERE id = $1", [conversa.id]);
    resposta.status(201).json(paraMensagem(rows[0]));
}));

router.get("/conversas", exigirLogin, exigirPapel("admin"), asyncHandler(async (req, resposta) => {
    const { rows } = await pool.query(`
        SELECT
            c.id, c.usuario_id, c.atualizado_em,
            u.nome, u.email,
            (SELECT texto FROM mensagens_suporte WHERE conversa_id = c.id ORDER BY criado_em DESC LIMIT 1) AS ultima_mensagem,
            (SELECT COUNT(*)::int FROM mensagens_suporte WHERE conversa_id = c.id AND de_admin = false AND lida = false) AS nao_lidas
        FROM conversas_suporte c
        JOIN usuarios u ON u.id = c.usuario_id
        ORDER BY c.atualizado_em DESC
    `);
    resposta.json(rows.map((linha) => ({
        id: linha.id,
        usuarioId: linha.usuario_id,
        nome: linha.nome,
        email: linha.email,
        ultimaMensagem: linha.ultima_mensagem,
        naoLidas: linha.nao_lidas,
        atualizadoEm: linha.atualizado_em,
    })));
}));

router.get("/conversas/:id", exigirLogin, exigirPapel("admin"), asyncHandler(async (req, resposta) => {
    const { rows: conversas } = await pool.query(
        `SELECT c.*, u.nome, u.email FROM conversas_suporte c JOIN usuarios u ON u.id = c.usuario_id WHERE c.id = $1`,
        [req.params.id]
    );
    const conversa = conversas[0];
    if (!conversa) return resposta.status(404).json({ erro: "Conversa não encontrada." });

    await pool.query(
        "UPDATE mensagens_suporte SET lida = true WHERE conversa_id = $1 AND de_admin = false AND lida = false",
        [conversa.id]
    );
    const { rows } = await pool.query(
        "SELECT * FROM mensagens_suporte WHERE conversa_id = $1 ORDER BY criado_em",
        [conversa.id]
    );
    resposta.json({
        id: conversa.id,
        nome: conversa.nome,
        email: conversa.email,
        mensagens: rows.map(paraMensagem),
    });
}));

router.post("/conversas/:id/mensagens", exigirLogin, exigirPapel("admin"), asyncHandler(async (req, resposta) => {
    const texto = (req.body.texto || "").trim();
    if (!texto) {
        return resposta.status(400).json({ erro: "Escreva uma mensagem antes de enviar." });
    }

    const { rows: conversas } = await pool.query("SELECT id FROM conversas_suporte WHERE id = $1", [req.params.id]);
    if (!conversas[0]) return resposta.status(404).json({ erro: "Conversa não encontrada." });

    const { rows } = await pool.query(
        `INSERT INTO mensagens_suporte (conversa_id, autor_id, de_admin, texto)
         VALUES ($1, $2, true, $3) RETURNING *`,
        [req.params.id, req.usuario.id, texto]
    );
    await pool.query("UPDATE conversas_suporte SET atualizado_em = now() WHERE id = $1", [req.params.id]);
    resposta.status(201).json(paraMensagem(rows[0]));
}));

module.exports = router;
