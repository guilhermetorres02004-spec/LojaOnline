const express = require("express");
const pool = require("../db");
const { exigirLogin, exigirPapel } = require("../auth");
const asyncHandler = require("../asyncHandler");

const router = express.Router();

function paraCadastro(linha) {
    return {
        id: linha.id,
        nome: linha.nome,
        email: linha.email,
        cnpj: linha.cnpj,
        telefone: linha.telefone,
        dataCadastro: linha.data_cadastro,
    };
}

router.use(exigirLogin, exigirPapel("admin"));

router.get("/", asyncHandler(async (req, resposta) => {
    const { rows } = await pool.query(
        "SELECT * FROM usuarios WHERE papel = 'vendedor' AND status_cadastro = 'pendente' ORDER BY data_cadastro"
    );
    resposta.json(rows.map(paraCadastro));
}));

router.put("/:id/aprovar", asyncHandler(async (req, resposta) => {
    const { rows } = await pool.query(
        "UPDATE usuarios SET status_cadastro = 'aprovado' WHERE id = $1 AND papel = 'vendedor' RETURNING *",
        [req.params.id]
    );
    if (!rows[0]) return resposta.status(404).json({ erro: "Cadastro não encontrado." });
    resposta.json(paraCadastro(rows[0]));
}));

router.delete("/:id", asyncHandler(async (req, resposta) => {
    await pool.query("DELETE FROM usuarios WHERE id = $1 AND papel = 'vendedor' AND status_cadastro = 'pendente'", [
        req.params.id,
    ]);
    resposta.json({ removido: true });
}));

module.exports = router;
