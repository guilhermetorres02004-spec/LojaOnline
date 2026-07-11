const CHAVE_TOKEN = "wgstore_token";

function decodificarToken(token) {
    try {
        const payload = token.split(".")[1];
        const json = decodeURIComponent(
            atob(payload.replace(/-/g, "+").replace(/_/g, "/"))
                .split("")
                .map((c) => "%" + c.charCodeAt(0).toString(16).padStart(2, "0"))
                .join("")
        );
        return JSON.parse(json);
    } catch (erro) {
        return null;
    }
}

function carregarSessao() {
    const token = localStorage.getItem(CHAVE_TOKEN);
    if (!token) return null;
    const payload = decodificarToken(token);
    if (!payload) return null;
    return { id: payload.id, nome: payload.nome, email: payload.email, papel: payload.papel, token };
}

function salvarToken(token) {
    localStorage.setItem(CHAVE_TOKEN, token);
}

async function apiFetch(caminho, opcoes) {
    const sessao = carregarSessao();
    const cabecalhos = Object.assign({ "Content-Type": "application/json" }, (opcoes && opcoes.headers) || {});
    if (sessao) cabecalhos.Authorization = `Bearer ${sessao.token}`;

    const resposta = await fetch(caminho, { ...opcoes, headers: cabecalhos });
    const dados = await resposta.json().catch(() => ({}));
    if (!resposta.ok) {
        throw new Error(dados.erro || "Erro inesperado. Tente novamente.");
    }
    return dados;
}

const abaEntrar = document.getElementById("aba-entrar");
const abaCadastrar = document.getElementById("aba-cadastrar");
const abaEmpresa = document.getElementById("aba-empresa");
const formEntrar = document.getElementById("form-entrar");
const formCadastrar = document.getElementById("form-cadastrar");
const formEmpresa = document.getElementById("form-empresa");
const mensagem = document.getElementById("mensagem");
const campoCpf = document.getElementById("cadastro-cpf");
const campoCnpj = document.getElementById("empresa-cnpj");
const campoTelefone = document.getElementById("empresa-telefone");

if (carregarSessao()) {
    window.location.href = "../loja/index.html";
}

function irParaLoja() {
    window.location.href = "../loja/index.html";
}

function mascararCpf(valor) {
    return valor
        .replace(/\D/g, "")
        .slice(0, 11)
        .replace(/(\d{3})(\d)/, "$1.$2")
        .replace(/(\d{3})(\d)/, "$1.$2")
        .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
}

function cpfValido(cpf) {
    cpf = cpf.replace(/\D/g, "");
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

campoCpf.addEventListener("input", () => {
    campoCpf.value = mascararCpf(campoCpf.value);
});

function mascararCnpj(valor) {
    return valor
        .replace(/\D/g, "")
        .slice(0, 14)
        .replace(/(\d{2})(\d)/, "$1.$2")
        .replace(/(\d{3})(\d)/, "$1.$2")
        .replace(/(\d{3})(\d)/, "$1/$2")
        .replace(/(\d{4})(\d{1,2})$/, "$1-$2");
}

function cnpjValido(cnpj) {
    cnpj = cnpj.replace(/\D/g, "");
    if (cnpj.length !== 14 || /^(\d)\1{13}$/.test(cnpj)) return false;

    const calcularDigito = (base, pesos) => {
        let soma = 0;
        for (let i = 0; i < base.length; i++) soma += Number(base[i]) * pesos[i];
        const resto = soma % 11;
        return resto < 2 ? 0 : 11 - resto;
    };

    const pesos1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const digito1 = calcularDigito(cnpj.slice(0, 12), pesos1);
    if (digito1 !== Number(cnpj[12])) return false;

    const pesos2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const digito2 = calcularDigito(cnpj.slice(0, 13), pesos2);
    if (digito2 !== Number(cnpj[13])) return false;

    return true;
}

function mascararTelefone(valor) {
    const digitos = valor.replace(/\D/g, "").slice(0, 11);
    if (digitos.length > 10) {
        return digitos.replace(/(\d{2})(\d{5})(\d{0,4})/, (m, ddd, parte1, parte2) =>
            parte2 ? `(${ddd}) ${parte1}-${parte2}` : `(${ddd}) ${parte1}`
        );
    }
    return digitos.replace(/(\d{2})(\d{0,4})(\d{0,4})/, (m, ddd, parte1, parte2) => {
        let resultado = ddd ? `(${ddd}` : "";
        if (ddd.length === 2) resultado += ") ";
        resultado += parte1;
        if (parte2) resultado += `-${parte2}`;
        return resultado;
    });
}

campoCnpj.addEventListener("input", () => {
    campoCnpj.value = mascararCnpj(campoCnpj.value);
});

campoTelefone.addEventListener("input", () => {
    campoTelefone.value = mascararTelefone(campoTelefone.value);
});

function mostrarMensagem(texto, tipo) {
    mensagem.textContent = texto;
    mensagem.className = `mensagem ${tipo}`;
    mensagem.hidden = false;
}

function esconderMensagem() {
    mensagem.hidden = true;
}

function mostrarAba(aba) {
    esconderMensagem();
    abaEntrar.classList.toggle("ativa", aba === "entrar");
    abaCadastrar.classList.toggle("ativa", aba === "cadastrar");
    abaEmpresa.classList.toggle("ativa", aba === "empresa");
    formEntrar.hidden = aba !== "entrar";
    formCadastrar.hidden = aba !== "cadastrar";
    formEmpresa.hidden = aba !== "empresa";
}

abaEntrar.addEventListener("click", () => mostrarAba("entrar"));
abaCadastrar.addEventListener("click", () => mostrarAba("cadastrar"));
abaEmpresa.addEventListener("click", () => mostrarAba("empresa"));

formEntrar.addEventListener("submit", async (evento) => {
    evento.preventDefault();
    esconderMensagem();

    const email = document.getElementById("entrar-email").value.trim().toLowerCase();
    const senha = document.getElementById("entrar-senha").value;

    try {
        const dados = await apiFetch("/api/auth/login", {
            method: "POST",
            body: JSON.stringify({ email, senha }),
        });
        salvarToken(dados.token);
        mostrarMensagem(`Bem-vindo(a), ${dados.usuario.nome}! Redirecionando...`, "sucesso");
        setTimeout(irParaLoja, 600);
    } catch (erro) {
        mostrarMensagem(erro.message, "erro");
    }
});

formCadastrar.addEventListener("submit", async (evento) => {
    evento.preventDefault();
    esconderMensagem();

    const nome = document.getElementById("cadastro-nome").value.trim();
    const email = document.getElementById("cadastro-email").value.trim().toLowerCase();
    const cpf = campoCpf.value.replace(/\D/g, "");
    const senha = document.getElementById("cadastro-senha").value;
    const confirmar = document.getElementById("cadastro-confirmar").value;

    if (!nome || !email || !cpf || !senha) {
        mostrarMensagem("Preencha todos os campos.", "erro");
        return;
    }

    if (!cpfValido(cpf)) {
        mostrarMensagem("Informe um CPF válido.", "erro");
        return;
    }

    if (senha.length < 4) {
        mostrarMensagem("A senha deve ter pelo menos 4 caracteres.", "erro");
        return;
    }

    if (senha !== confirmar) {
        mostrarMensagem("As senhas não coincidem.", "erro");
        return;
    }

    try {
        const dados = await apiFetch("/api/auth/cadastro", {
            method: "POST",
            body: JSON.stringify({ nome, email, cpf, senha }),
        });
        salvarToken(dados.token);
        mostrarMensagem("Conta criada com sucesso! Redirecionando...", "sucesso");
        setTimeout(irParaLoja, 600);
    } catch (erro) {
        mostrarMensagem(erro.message, "erro");
    }
});

formEmpresa.addEventListener("submit", async (evento) => {
    evento.preventDefault();
    esconderMensagem();

    const nomeEmpresa = document.getElementById("empresa-nome").value.trim();
    const email = document.getElementById("empresa-email").value.trim().toLowerCase();
    const cnpj = campoCnpj.value.replace(/\D/g, "");
    const telefone = campoTelefone.value.replace(/\D/g, "");
    const senha = document.getElementById("empresa-senha").value;
    const confirmar = document.getElementById("empresa-confirmar").value;

    if (!nomeEmpresa || !email || !cnpj || !telefone || !senha) {
        mostrarMensagem("Preencha todos os campos.", "erro");
        return;
    }

    if (!cnpjValido(cnpj)) {
        mostrarMensagem("Informe um CNPJ válido.", "erro");
        return;
    }

    if (telefone.length < 10) {
        mostrarMensagem("Informe um número de contato válido.", "erro");
        return;
    }

    if (senha.length < 4) {
        mostrarMensagem("A senha deve ter pelo menos 4 caracteres.", "erro");
        return;
    }

    if (senha !== confirmar) {
        mostrarMensagem("As senhas não coincidem.", "erro");
        return;
    }

    try {
        await apiFetch("/api/auth/cadastro-empresa", {
            method: "POST",
            body: JSON.stringify({ nomeEmpresa, email, cnpj, telefone, senha }),
        });
        formEmpresa.reset();
        mostrarMensagem("Cadastro enviado! Você poderá entrar assim que o administrador aprovar.", "sucesso");
        setTimeout(() => mostrarAba("entrar"), 2200);
    } catch (erro) {
        mostrarMensagem(erro.message, "erro");
    }
});
