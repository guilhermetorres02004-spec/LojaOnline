const express = require("express");
const bcrypt = require("bcryptjs");
const pool = require("../db");
const { gerarToken, exigirLogin } = require("../auth");
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

function cnpjValido(cnpj) {
    cnpj = (cnpj || "").replace(/\D/g, "");
    if (cnpj.length !== 14 || /^(\d)\1{13}$/.test(cnpj)) return false;

    const calcularDigito = (base, pesos) => {
        let soma = 0;
        for (let i = 0; i < base.length; i++) soma += Number(base[i]) * pesos[i];
        const resto = soma % 11;
        return resto < 2 ? 0 : 11 - resto;
    };

    const digito1 = calcularDigito(cnpj.slice(0, 12), [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
    if (digito1 !== Number(cnpj[12])) return false;

    const digito2 = calcularDigito(cnpj.slice(0, 13), [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
    if (digito2 !== Number(cnpj[13])) return false;

    return true;
}

router.post("/login", asyncHandler(async (req, resposta) => {
    const email = (req.body.email || "").trim().toLowerCase();
    const senha = req.body.senha || "";

    const { rows } = await pool.query("SELECT * FROM usuarios WHERE lower(email) = $1", [email]);
    const usuario = rows[0];

    if (!usuario) {
        return resposta.status(401).json({ erro: "E-mail ou senha inválidos." });
    }

    const senhaOk = await bcrypt.compare(senha, usuario.senha_hash);
    if (!senhaOk) {
        return resposta.status(401).json({ erro: "E-mail ou senha inválidos." });
    }

    if (usuario.status_cadastro === "pendente") {
        return resposta.status(403).json({ erro: "Seu cadastro ainda está em análise. Aguarde a aprovação do administrador." });
    }

    const token = gerarToken(usuario);
    resposta.json({ token, usuario: { id: usuario.id, nome: usuario.nome, email: usuario.email, papel: usuario.papel } });
}));

router.post("/cadastro", asyncHandler(async (req, resposta) => {
    const nome = (req.body.nome || "").trim();
    const email = (req.body.email || "").trim().toLowerCase();
    const cpf = (req.body.cpf || "").replace(/\D/g, "");
    const senha = req.body.senha || "";

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
        return resposta.status(409).json({ erro: "Já existe uma conta com esse e-mail ou CPF." });
    }

    const senhaHash = await bcrypt.hash(senha, 10);
    const { rows } = await pool.query(
        `INSERT INTO usuarios (nome, email, senha_hash, cpf, papel, status_cadastro)
         VALUES ($1, $2, $3, $4, 'cliente', 'aprovado') RETURNING *`,
        [nome, email, senhaHash, cpf]
    );
    const usuario = rows[0];

    const token = gerarToken(usuario);
    resposta.status(201).json({ token, usuario: { id: usuario.id, nome: usuario.nome, email: usuario.email, papel: usuario.papel } });
}));

router.post("/cadastro-empresa", asyncHandler(async (req, resposta) => {
    const nomeEmpresa = (req.body.nomeEmpresa || "").trim();
    const email = (req.body.email || "").trim().toLowerCase();
    const cnpj = (req.body.cnpj || "").replace(/\D/g, "");
    const telefone = (req.body.telefone || "").replace(/\D/g, "");
    const senha = req.body.senha || "";

    if (!nomeEmpresa || !email || !cnpj || !telefone || !senha) {
        return resposta.status(400).json({ erro: "Preencha todos os campos." });
    }

    if (!cnpjValido(cnpj)) {
        return resposta.status(400).json({ erro: "Informe um CNPJ válido." });
    }

    if (telefone.length < 10) {
        return resposta.status(400).json({ erro: "Informe um número de contato válido." });
    }

    if (senha.length < 4) {
        return resposta.status(400).json({ erro: "A senha deve ter pelo menos 4 caracteres." });
    }

    const existente = await pool.query(
        "SELECT id FROM usuarios WHERE lower(email) = $1 OR cnpj = $2",
        [email, cnpj]
    );
    if (existente.rows.length > 0) {
        return resposta.status(409).json({ erro: "Já existe um cadastro com esse e-mail ou CNPJ." });
    }

    const senhaHash = await bcrypt.hash(senha, 10);
    await pool.query(
        `INSERT INTO usuarios (nome, email, senha_hash, cnpj, telefone, papel, status_cadastro)
         VALUES ($1, $2, $3, $4, $5, 'vendedor', 'pendente')`,
        [nomeEmpresa, email, senhaHash, cnpj, telefone]
    );

    resposta.status(201).json({ mensagem: "Cadastro enviado! Você poderá entrar assim que o administrador aprovar." });
}));

router.get("/me", exigirLogin, asyncHandler(async (req, resposta) => {
    const { rows } = await pool.query("SELECT id, nome, email, papel FROM usuarios WHERE id = $1", [req.usuario.id]);
    if (!rows[0]) return resposta.status(404).json({ erro: "Usuário não encontrado." });
    resposta.json(rows[0]);
}));

module.exports = router;
