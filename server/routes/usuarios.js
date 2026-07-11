const express = require("express");
const bcrypt = require("bcryptjs");
const pool = require("../db");
const { exigirLogin, exigirPapel } = require("../auth");
const asyncHandler = require("../asyncHandler");

const router = express.Router();

function cpfValido(cpf) {
    cpf = (cpf || "").replace(/\D/g, "");
    if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;

    let soma = 0;
    for (let i = 0; i < 9; i++) soma += Number(cpf[i]) * (10 - i);
    let digito1 = (soma * 10) % 11;
    if (digito1 === 10 || digito1 === 11) digito1 = 0;
    if (digito1 !== Number(cpf[9])) return false;

    soma = 0;
    for (let i = 0; i < 10; i++) soma += Number(cpf[i]) * (11 - i);
    let digito2 = (soma * 10) % 11;
    if (digito2 === 10 || digito2 === 11) digito2 = 0;
    if (digito2 !== Number(cpf[10])) return false;

    return true;
}

function paraUsuario(linha) {
    return {
        id: linha.id,
        nome: linha.nome,
        email: linha.email,
        cpf: linha.cpf,
        cnpj: linha.cnpj,
        telefone: linha.telefone,
        papel: linha.papel,
        statusCadastro: linha.status_cadastro,
        dataCadastro: linha.data_cadastro,
        comprasRealizadas: linha.compras_realizadas,
        totalGasto: Number(linha.total_gasto),
    };
}

router.use(exigirLogin, exigirPapel("admin"));

router.get("/", asyncHandler(async (req, resposta) => {
    const { rows } = await pool.query("SELECT * FROM usuarios ORDER BY nome");
    resposta.json(rows.map(paraUsuario));
}));

router.post("/", asyncHandler(async (req, resposta) => {
    const nome = (req.body.nome || "").trim();
    const email = (req.body.email || "").trim().toLowerCase();
    const cpf = (req.body.cpf || "").replace(/\D/g, "");
    const senha = req.body.senha || "";
    const papel = req.body.papel || "cliente";

    if (!nome || !email || !cpf || !senha) {
        return resposta.status(400).json({ erro: "Preencha todos os campos." });
    }

    if (!cpfValido(cpf)) {
        return resposta.status(400).json({ erro: "Informe um CPF válido." });
    }

    if (senha.length < 4) {
        return resposta.status(400).json({ erro: "A senha deve ter pelo menos 4 caracteres." });
    }

    const existente = await pool.query(
        "SELECT id FROM usuarios WHERE lower(email) = $1 OR cpf = $2",
        [email, cpf]
    );
    if (existente.rows.length > 0) {
        return resposta.status(409).json({ erro: "Já existe um usuário com esse e-mail ou CPF." });
    }

    const senhaHash = await bcrypt.hash(senha, 10);
    const { rows } = await pool.query(
        `INSERT INTO usuarios (nome, email, senha_hash, cpf, papel, status_cadastro)
         VALUES ($1, $2, $3, $4, $5, 'aprovado') RETURNING *`,
        [nome, email, senhaHash, cpf, papel]
    );
    resposta.status(201).json(paraUsuario(rows[0]));
}));

router.put("/:id", asyncHandler(async (req, resposta) => {
    const { rows: existentes } = await pool.query("SELECT * FROM usuarios WHERE id = $1", [req.params.id]);
    const usuarioExistente = existentes[0];
    if (!usuarioExistente) {
        return resposta.status(404).json({ erro: "Usuário não encontrado." });
    }

    const ehContaEmpresa = Boolean(usuarioExistente.cnpj);
    const nome = (req.body.nome || "").trim();
    const email = (req.body.email || "").trim().toLowerCase();
    const cpf = (req.body.cpf || "").replace(/\D/g, "");
    const senha = req.body.senha || "";
    const papel = req.body.papel || usuarioExistente.papel;

    if (!nome || !email || (!ehContaEmpresa && !cpf)) {
        return resposta.status(400).json({ erro: "Preencha todos os campos." });
    }

    if (!ehContaEmpresa && !cpfValido(cpf)) {
        return resposta.status(400).json({ erro: "Informe um CPF válido." });
    }

    if (senha && senha.length < 4) {
        return resposta.status(400).json({ erro: "A senha deve ter pelo menos 4 caracteres." });
    }

    const duplicado = await pool.query(
        "SELECT id FROM usuarios WHERE id <> $1 AND (lower(email) = $2 OR (cpf IS NOT NULL AND cpf = $3))",
        [req.params.id, email, ehContaEmpresa ? null : cpf]
    );
    if (duplicado.rows.length > 0) {
        return resposta.status(409).json({ erro: "Já existe um usuário com esse e-mail ou CPF." });
    }

    const cpfFinal = ehContaEmpresa ? usuarioExistente.cpf : cpf;
    let senhaHash = usuarioExistente.senha_hash;
    if (senha) {
        senhaHash = await bcrypt.hash(senha, 10);
    }

    const { rows } = await pool.query(
        `UPDATE usuarios SET nome = $1, email = $2, cpf = $3, papel = $4, senha_hash = $5 WHERE id = $6 RETURNING *`,
        [nome, email, cpfFinal, papel, senhaHash, req.params.id]
    );
    resposta.json(paraUsuario(rows[0]));
}));

module.exports = router;
