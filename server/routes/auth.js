const express = require("express");
const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const pool = require("../db");
const { gerarToken, exigirLogin } = require("../auth");
const asyncHandler = require("../asyncHandler");

const router = express.Router();
const VALIDADE_TOKEN_RECUPERACAO_MS = 30 * 60 * 1000;
const LIMITE_TENTATIVAS_LOGIN = 5;
const JANELA_TENTATIVAS_LOGIN_MS = 30 * 60 * 1000;

function hashToken(token) {
    return crypto.createHash("sha256").update(token).digest("hex");
}

function minutosRestantes(dataFutura) {
    return Math.max(1, Math.ceil((new Date(dataFutura).getTime() - Date.now()) / 60000));
}

async function obterEstadoTentativas(email) {
    const { rows } = await pool.query("SELECT * FROM tentativas_login WHERE email = $1", [email]);
    const tentativa = rows[0];
    if (!tentativa) return null;

    const janelaExpirada = Date.now() - new Date(tentativa.primeira_tentativa).getTime() > JANELA_TENTATIVAS_LOGIN_MS;
    const bloqueioExpirado = !tentativa.bloqueado_ate || new Date(tentativa.bloqueado_ate).getTime() <= Date.now();

    if (janelaExpirada && bloqueioExpirado) {
        await pool.query("DELETE FROM tentativas_login WHERE email = $1", [email]);
        return null;
    }
    return tentativa;
}

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

    if (!email || !senha) {
        return resposta.status(400).json({ erro: "Informe e-mail e senha." });
    }

    const tentativa = await obterEstadoTentativas(email);
    if (tentativa && tentativa.bloqueado_ate && new Date(tentativa.bloqueado_ate) > new Date()) {
        const minutos = minutosRestantes(tentativa.bloqueado_ate);
        return resposta.status(429).json({
            erro: `Muitas tentativas de login. Tente novamente em ${minutos} minuto${minutos === 1 ? "" : "s"}.`,
        });
    }

    const { rows } = await pool.query("SELECT * FROM usuarios WHERE lower(email) = $1", [email]);
    const usuario = rows[0];

    const senhaOk = usuario ? await bcrypt.compare(senha, usuario.senha_hash) : false;

    if (!usuario || !senhaOk) {
        if (!tentativa) {
            await pool.query(
                "INSERT INTO tentativas_login (email, tentativas, primeira_tentativa) VALUES ($1, 1, now())",
                [email]
            );
            return resposta.status(401).json({ erro: "E-mail ou senha inválidos." });
        }

        const novasTentativas = tentativa.tentativas + 1;
        if (novasTentativas >= LIMITE_TENTATIVAS_LOGIN) {
            const bloqueadoAte = new Date(Date.now() + JANELA_TENTATIVAS_LOGIN_MS);
            await pool.query(
                "UPDATE tentativas_login SET tentativas = $1, bloqueado_ate = $2 WHERE email = $3",
                [novasTentativas, bloqueadoAte, email]
            );
            return resposta.status(429).json({
                erro: `Muitas tentativas de login. Tente novamente em ${minutosRestantes(bloqueadoAte)} minutos.`,
            });
        }

        await pool.query("UPDATE tentativas_login SET tentativas = $1 WHERE email = $2", [novasTentativas, email]);
        return resposta.status(401).json({ erro: "E-mail ou senha inválidos." });
    }

    if (usuario.status_cadastro === "pendente") {
        return resposta.status(403).json({ erro: "Seu cadastro ainda está em análise. Aguarde a aprovação do administrador." });
    }

    await pool.query("DELETE FROM tentativas_login WHERE email = $1", [email]);

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
    const { rows } = await pool.query(
        "SELECT id, nome, email, papel, data_cadastro, compras_realizadas, total_gasto FROM usuarios WHERE id = $1",
        [req.usuario.id]
    );
    if (!rows[0]) return resposta.status(404).json({ erro: "Usuário não encontrado." });
    const usuario = rows[0];
    resposta.json({
        id: usuario.id,
        nome: usuario.nome,
        email: usuario.email,
        papel: usuario.papel,
        dataCadastro: usuario.data_cadastro,
        comprasRealizadas: usuario.compras_realizadas,
        totalGasto: Number(usuario.total_gasto),
    });
}));

router.put("/email", exigirLogin, asyncHandler(async (req, resposta) => {
    const novoEmail = (req.body.novoEmail || "").trim().toLowerCase();
    const senhaAtual = req.body.senhaAtual || "";

    if (!novoEmail || !senhaAtual) {
        return resposta.status(400).json({ erro: "Preencha o novo e-mail e sua senha atual." });
    }

    const { rows } = await pool.query("SELECT * FROM usuarios WHERE id = $1", [req.usuario.id]);
    const usuario = rows[0];
    const senhaOk = await bcrypt.compare(senhaAtual, usuario.senha_hash);
    if (!senhaOk) {
        return resposta.status(401).json({ erro: "Senha atual incorreta." });
    }

    const existente = await pool.query(
        "SELECT id FROM usuarios WHERE lower(email) = $1 AND id <> $2",
        [novoEmail, req.usuario.id]
    );
    if (existente.rows.length > 0) {
        return resposta.status(409).json({ erro: "Já existe uma conta com esse e-mail." });
    }

    const { rows: atualizados } = await pool.query(
        "UPDATE usuarios SET email = $1 WHERE id = $2 RETURNING *",
        [novoEmail, req.usuario.id]
    );
    const atualizado = atualizados[0];

    const token = gerarToken(atualizado);
    resposta.json({ token, usuario: { id: atualizado.id, nome: atualizado.nome, email: atualizado.email, papel: atualizado.papel } });
}));

router.put("/senha", exigirLogin, asyncHandler(async (req, resposta) => {
    const senhaAtual = req.body.senhaAtual || "";
    const novaSenha = req.body.novaSenha || "";

    if (!senhaAtual || !novaSenha) {
        return resposta.status(400).json({ erro: "Preencha a senha atual e a nova senha." });
    }

    if (novaSenha.length < 4) {
        return resposta.status(400).json({ erro: "A nova senha deve ter pelo menos 4 caracteres." });
    }

    const { rows } = await pool.query("SELECT * FROM usuarios WHERE id = $1", [req.usuario.id]);
    const usuario = rows[0];
    const senhaOk = await bcrypt.compare(senhaAtual, usuario.senha_hash);
    if (!senhaOk) {
        return resposta.status(401).json({ erro: "Senha atual incorreta." });
    }

    const novaSenhaHash = await bcrypt.hash(novaSenha, 10);
    await pool.query("UPDATE usuarios SET senha_hash = $1 WHERE id = $2", [novaSenhaHash, req.usuario.id]);
    resposta.json({ mensagem: "Senha atualizada com sucesso." });
}));

router.post("/esqueci-senha", asyncHandler(async (req, resposta) => {
    const email = (req.body.email || "").trim().toLowerCase();
    if (!email) {
        return resposta.status(400).json({ erro: "Informe seu e-mail." });
    }

    const { rows } = await pool.query("SELECT id FROM usuarios WHERE lower(email) = $1", [email]);
    const usuario = rows[0];
    if (!usuario) {
        return resposta.status(404).json({ erro: "Não encontramos nenhuma conta com esse e-mail." });
    }

    const token = crypto.randomBytes(32).toString("hex");
    const expiraEm = new Date(Date.now() + VALIDADE_TOKEN_RECUPERACAO_MS);

    await pool.query(
        "UPDATE usuarios SET reset_token_hash = $1, reset_token_expira = $2 WHERE id = $3",
        [hashToken(token), expiraEm, usuario.id]
    );

    resposta.json({
        mensagem: "Link de recuperação gerado! Como este é um ambiente local, ele aparece abaixo em vez de ser enviado por e-mail.",
        token,
        expiraEm,
    });
}));

router.post("/redefinir-senha", asyncHandler(async (req, resposta) => {
    const token = req.body.token || "";
    const novaSenha = req.body.novaSenha || "";

    if (!token || !novaSenha) {
        return resposta.status(400).json({ erro: "Link inválido." });
    }
    if (novaSenha.length < 4) {
        return resposta.status(400).json({ erro: "A nova senha deve ter pelo menos 4 caracteres." });
    }

    const { rows } = await pool.query(
        "SELECT * FROM usuarios WHERE reset_token_hash = $1",
        [hashToken(token)]
    );
    const usuario = rows[0];
    if (!usuario || !usuario.reset_token_expira || new Date(usuario.reset_token_expira) < new Date()) {
        return resposta.status(400).json({ erro: "Esse link de recuperação é inválido ou expirou. Peça um novo." });
    }

    const novaSenhaHash = await bcrypt.hash(novaSenha, 10);
    await pool.query(
        "UPDATE usuarios SET senha_hash = $1, reset_token_hash = NULL, reset_token_expira = NULL WHERE id = $2",
        [novaSenhaHash, usuario.id]
    );

    resposta.json({ mensagem: "Senha redefinida com sucesso! Você já pode entrar com a nova senha." });
}));

module.exports = router;
