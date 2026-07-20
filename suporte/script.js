const CHAVE_TOKEN = "wgstore_token";
const INTERVALO_LISTA = 6000;
const INTERVALO_CONVERSA = 4000;

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

const sessaoUsuario = carregarSessao();
const autorizado = Boolean(sessaoUsuario && sessaoUsuario.papel === "admin");
document.getElementById("app-suporte").hidden = !autorizado;
document.getElementById("acesso-negado").hidden = autorizado;

const listaConversas = document.getElementById("lista-conversas");
const vazioConversas = document.getElementById("vazio-conversas");
const contadorConversas = document.getElementById("contador-conversas");
const conversaVazia = document.getElementById("conversa-vazia");
const conversaAtiva = document.getElementById("conversa-ativa");
const conversaNome = document.getElementById("conversa-nome");
const conversaEmail = document.getElementById("conversa-email");
const conversaMensagens = document.getElementById("conversa-mensagens");
const conversaForm = document.getElementById("conversa-form");
const conversaInput = document.getElementById("conversa-input");

let conversaSelecionadaId = null;
let intervaloConversa = null;

function formatarHora(iso) {
    return new Date(iso).toLocaleString("pt-br", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

async function carregarConversas() {
    const conversas = await apiFetch("/api/suporte/conversas");

    contadorConversas.textContent = conversas.length;
    vazioConversas.hidden = conversas.length > 0;
    listaConversas.innerHTML = "";

    conversas.forEach((conversa) => {
        const item = document.createElement("button");
        item.type = "button";
        item.className = `conversa-item${conversa.id === conversaSelecionadaId ? " ativa" : ""}`;
        item.dataset.id = conversa.id;
        item.innerHTML = `
            <div class="conversa-item-topo">
                <span class="conversa-item-nome">${conversa.nome}</span>
                ${conversa.naoLidas > 0 ? `<span class="conversa-item-badge">${conversa.naoLidas > 9 ? "9+" : conversa.naoLidas}</span>` : ""}
            </div>
            <p class="conversa-item-preview">${conversa.ultimaMensagem || "Sem mensagens ainda"}</p>
        `;
        listaConversas.appendChild(item);
    });
}

function renderizarMensagens(mensagens) {
    conversaMensagens.innerHTML = mensagens.map((mensagem) => `
        <div class="msg ${mensagem.deAdmin ? "admin" : "cliente"}">${mensagem.texto.replace(/</g, "&lt;")}</div>
    `).join("");
    conversaMensagens.scrollTop = conversaMensagens.scrollHeight;
}

async function abrirConversa(id) {
    conversaSelecionadaId = id;

    [...listaConversas.children].forEach((item) => {
        item.classList.toggle("ativa", Number(item.dataset.id) === id);
    });

    const dados = await apiFetch(`/api/suporte/conversas/${id}`);
    conversaVazia.hidden = true;
    conversaAtiva.hidden = false;
    conversaNome.textContent = dados.nome;
    conversaEmail.textContent = dados.email;
    renderizarMensagens(dados.mensagens);

    clearInterval(intervaloConversa);
    intervaloConversa = setInterval(async () => {
        const atualizacao = await apiFetch(`/api/suporte/conversas/${id}`);
        renderizarMensagens(atualizacao.mensagens);
        carregarConversas();
    }, INTERVALO_CONVERSA);

    carregarConversas();
}

listaConversas.addEventListener("click", (evento) => {
    const item = evento.target.closest(".conversa-item");
    if (!item) return;
    abrirConversa(Number(item.dataset.id));
});

conversaForm.addEventListener("submit", async (evento) => {
    evento.preventDefault();
    const texto = conversaInput.value.trim();
    if (!texto || !conversaSelecionadaId) return;

    conversaInput.value = "";
    await apiFetch(`/api/suporte/conversas/${conversaSelecionadaId}/mensagens`, {
        method: "POST",
        body: JSON.stringify({ texto }),
    });

    const atualizacao = await apiFetch(`/api/suporte/conversas/${conversaSelecionadaId}`);
    renderizarMensagens(atualizacao.mensagens);
    carregarConversas();
});

if (autorizado) {
    carregarConversas();
    setInterval(carregarConversas, INTERVALO_LISTA);
}
