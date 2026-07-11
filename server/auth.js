require("dotenv").config();
const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET;

function gerarToken(usuario) {
    return jwt.sign(
        {
            id: usuario.id,
            nome: usuario.nome,
            email: usuario.email,
            papel: usuario.papel,
        },
        JWT_SECRET,
        { expiresIn: "7d" }
    );
}

function exigirLogin(req, resposta, proximo) {
    const cabecalho = req.headers.authorization || "";
    const token = cabecalho.startsWith("Bearer ") ? cabecalho.slice(7) : null;

    if (!token) {
        return resposta.status(401).json({ erro: "Faça login para continuar." });
    }

    try {
        req.usuario = jwt.verify(token, JWT_SECRET);
        proximo();
    } catch (erro) {
        return resposta.status(401).json({ erro: "Sessão inválida ou expirada. Faça login novamente." });
    }
}

function exigirPapel(...papeis) {
    return (req, resposta, proximo) => {
        if (!req.usuario || !papeis.includes(req.usuario.papel)) {
            return resposta.status(403).json({ erro: "Você não tem permissão para acessar este recurso." });
        }
        proximo();
    };
}

// Middleware opcional: preenche req.usuario se houver token válido, mas não bloqueia se não houver.
function loginOpcional(req, resposta, proximo) {
    const cabecalho = req.headers.authorization || "";
    const token = cabecalho.startsWith("Bearer ") ? cabecalho.slice(7) : null;

    if (token) {
        try {
            req.usuario = jwt.verify(token, JWT_SECRET);
        } catch (erro) {
            req.usuario = null;
        }
    }
    proximo();
}

module.exports = { gerarToken, exigirLogin, exigirPapel, loginOpcional };
