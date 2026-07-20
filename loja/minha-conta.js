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

function formatarPreco(valor) {
    return valor.toLocaleString("pt-br", { style: "currency", currency: "BRL" });
}

function formatarData(iso) {
    return new Date(iso).toLocaleDateString("pt-br");
}

const contaLogada = document.getElementById("conta-logada");
const contaNome = document.getElementById("conta-nome");
const btnSair = document.getElementById("btn-sair");
const btnContaMenu = document.getElementById("btn-conta-menu");
const contaMenu = document.getElementById("conta-menu");
const linkEntrarMenu = document.getElementById("link-entrar-menu");
const linkMinhaContaMenu = document.getElementById("link-minha-conta-menu");
const linkEstoqueMenu = document.getElementById("link-estoque-menu");
const linkUsuariosMenu = document.getElementById("link-usuarios-menu");
const linkPromocoesMenu = document.getElementById("link-promocoes-menu");
const linkCadastrosMenu = document.getElementById("link-cadastros-menu");
const linkSuporteMenu = document.getElementById("link-suporte-menu");

function fecharMenuConta() {
    contaMenu.hidden = true;
    contaLogada.classList.remove("aberta");
}

function renderizarConta() {
    const usuario = carregarSessao();
    const logado = Boolean(usuario);
    fecharMenuConta();

    contaNome.textContent = logado ? `Olá, ${usuario.nome}` : "Minha conta";
    linkEntrarMenu.hidden = logado;
    linkMinhaContaMenu.hidden = !logado;
    btnSair.hidden = !logado;

    const ehAdmin = logado && usuario.papel === "admin";
    const ehVendedor = logado && usuario.papel === "vendedor";
    linkEstoqueMenu.hidden = !(ehAdmin || ehVendedor);
    linkUsuariosMenu.hidden = !ehAdmin;
    linkPromocoesMenu.hidden = !ehAdmin;
    linkCadastrosMenu.hidden = !ehAdmin;
    linkSuporteMenu.hidden = !ehAdmin;
}

btnContaMenu.addEventListener("click", (evento) => {
    evento.stopPropagation();
    const estaAberto = !contaMenu.hidden;
    if (estaAberto) {
        fecharMenuConta();
    } else {
        contaMenu.hidden = false;
        contaLogada.classList.add("aberta");
    }
});

document.addEventListener("click", (evento) => {
    if (!contaLogada.hidden && !contaLogada.contains(evento.target)) {
        fecharMenuConta();
    }
});

btnSair.addEventListener("click", () => {
    localStorage.removeItem(CHAVE_TOKEN);
    window.location.href = "index.html";
});

function rotuloPapel(papel) {
    if (papel === "admin") return "Admin";
    if (papel === "vendedor") return "Vendedor";
    return "Cliente";
}

async function renderizarPerfil() {
    const dados = await apiFetch("/api/auth/me");

    document.getElementById("perfil-nome").textContent = dados.nome;
    document.getElementById("perfil-email").textContent = dados.email;

    const badgePapel = document.getElementById("perfil-papel");
    badgePapel.textContent = rotuloPapel(dados.papel);
    badgePapel.className = `papel-badge ${dados.papel}`;

    document.getElementById("stat-compras").textContent = dados.comprasRealizadas;
    document.getElementById("stat-gasto").textContent = formatarPreco(dados.totalGasto);

    document.getElementById("email-novo").placeholder = dados.email;
}

const ETAPAS_PEDIDO = [
    { chave: "confirmado", rotulo: "Confirmado" },
    { chave: "preparando", rotulo: "Preparando" },
    { chave: "enviado", rotulo: "Enviado" },
    { chave: "entregue", rotulo: "Entregue" },
];

function calcularEtapaAtual(itens) {
    const indices = itens
        .map((item) => ETAPAS_PEDIDO.findIndex((etapa) => etapa.chave === item.status))
        .filter((indice) => indice >= 0);
    return indices.length > 0 ? Math.min(...indices) : 0;
}

function renderizarStepper(indiceAtual) {
    return `
        <div class="pedido-status">
            ${ETAPAS_PEDIDO.map((etapa, indice) => `
                <div class="pedido-etapa ${indice <= indiceAtual ? "concluida" : ""} ${indice === indiceAtual ? "atual" : ""}">
                    <span class="pedido-etapa-ponto"></span>
                    <span class="pedido-etapa-rotulo">${etapa.rotulo}</span>
                </div>
            `).join("")}
        </div>
    `;
}

async function renderizarPedidos() {
    const pedidos = await apiFetch("/api/pedidos");

    const listaPedidos = document.getElementById("lista-pedidos");
    const vazio = document.getElementById("pedidos-vazio");

    if (pedidos.length === 0) {
        vazio.hidden = false;
        listaPedidos.innerHTML = "";
        return;
    }

    vazio.hidden = true;
    listaPedidos.innerHTML = pedidos.map((pedido) => {
        const etapaAtual = calcularEtapaAtual(pedido.itens);
        const itensHtml = pedido.itens.map((item) => `
            <div class="pedido-item-linha">
                <span>${item.nome} <span class="pedido-item-qtd">x${item.quantidade}</span></span>
                <span>${formatarPreco(item.precoUnitario * item.quantidade)}</span>
            </div>
        `).join("");

        return `
            <article class="pedido-card">
                <div class="pedido-cabecalho">
                    <div>
                        <span class="pedido-numero">Pedido #${pedido.id}</span>
                        <span class="pedido-data">${formatarData(pedido.criadoEm)}</span>
                    </div>
                    <span class="pedido-total">${formatarPreco(pedido.total)}</span>
                </div>
                ${renderizarStepper(etapaAtual)}
                <div class="pedido-itens">${itensHtml}</div>
            </article>
        `;
    }).join("");
}

const formEmail = document.getElementById("form-email");
const mensagemEmail = document.getElementById("mensagem-email");

function mostrarMensagem(elemento, texto, tipo) {
    elemento.textContent = texto;
    elemento.className = `mensagem ${tipo}`;
    elemento.hidden = false;
}

formEmail.addEventListener("submit", async (evento) => {
    evento.preventDefault();
    mensagemEmail.hidden = true;

    const novoEmail = document.getElementById("email-novo").value.trim().toLowerCase();
    const senhaAtual = document.getElementById("email-senha").value;

    try {
        const dados = await apiFetch("/api/auth/email", {
            method: "PUT",
            body: JSON.stringify({ novoEmail, senhaAtual }),
        });
        salvarToken(dados.token);
        mostrarMensagem(mensagemEmail, "E-mail atualizado com sucesso!", "sucesso");
        formEmail.reset();
        await renderizarPerfil();
    } catch (erro) {
        mostrarMensagem(mensagemEmail, erro.message, "erro");
    }
});

const formSenha = document.getElementById("form-senha");
const mensagemSenha = document.getElementById("mensagem-senha");

formSenha.addEventListener("submit", async (evento) => {
    evento.preventDefault();
    mensagemSenha.hidden = true;

    const senhaAtual = document.getElementById("senha-atual").value;
    const novaSenha = document.getElementById("senha-nova").value;
    const confirmar = document.getElementById("senha-confirmar").value;

    if (novaSenha !== confirmar) {
        mostrarMensagem(mensagemSenha, "As senhas não coincidem.", "erro");
        return;
    }

    try {
        await apiFetch("/api/auth/senha", {
            method: "PUT",
            body: JSON.stringify({ senhaAtual, novaSenha }),
        });
        mostrarMensagem(mensagemSenha, "Senha atualizada com sucesso!", "sucesso");
        formSenha.reset();
    } catch (erro) {
        mostrarMensagem(mensagemSenha, erro.message, "erro");
    }
});

const sessaoAtual = carregarSessao();
if (!sessaoAtual) {
    window.location.href = "../login/index.html";
} else {
    renderizarConta();
    renderizarPerfil();
    renderizarPedidos();
}
