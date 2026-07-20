const CHAVE_TOKEN = "wgstore_token";
const INTERVALO_ATUALIZACAO = 8000;

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

function formatarPreco(valor) {
    return valor.toLocaleString("pt-br", { style: "currency", currency: "BRL" });
}

function formatarData(iso) {
    return new Date(iso).toLocaleDateString("pt-br");
}

const sessaoUsuario = carregarSessao();
const ehAdmin = Boolean(sessaoUsuario && sessaoUsuario.papel === "admin");
const ehVendedor = Boolean(sessaoUsuario && sessaoUsuario.papel === "vendedor");
const autorizado = ehAdmin || ehVendedor;

document.getElementById("app-pedidos").hidden = !autorizado;
document.getElementById("acesso-negado").hidden = autorizado;

if (autorizado) {
    document.getElementById("link-cadastros").hidden = !ehAdmin;
    document.getElementById("link-usuarios").hidden = !ehAdmin;
    document.getElementById("link-promocoes").hidden = !ehAdmin;
    document.getElementById("link-suporte").hidden = !ehAdmin;
}

const toast = document.getElementById("toast");
let toastTimeout = null;

function mostrarToast(mensagem) {
    toast.textContent = mensagem;
    toast.classList.add("visivel");
    clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => {
        toast.classList.remove("visivel");
    }, 2600);
}

const ETAPAS_PEDIDO = [
    { chave: "confirmado", rotulo: "Confirmado" },
    { chave: "preparando", rotulo: "Preparando" },
    { chave: "enviado", rotulo: "Enviado" },
    { chave: "entregue", rotulo: "Entregue" },
];

function renderizarStepper(statusAtual) {
    const indiceAtual = ETAPAS_PEDIDO.findIndex((etapa) => etapa.chave === statusAtual);
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

const listaPedidos = document.getElementById("lista-pedidos");
const vazioPedidos = document.getElementById("vazio-pedidos");
const contadorPedidos = document.getElementById("contador-pedidos");

let itemEmAtualizacao = null;

async function carregarPedidos() {
    const itens = await apiFetch("/api/pedidos/vendedor");

    contadorPedidos.textContent = itens.length;
    vazioPedidos.hidden = itens.length > 0;

    if (itemEmAtualizacao) return;

    listaPedidos.innerHTML = itens.map((item) => {
        const indiceAtual = ETAPAS_PEDIDO.findIndex((etapa) => etapa.chave === item.status);
        const endereco = item.endereco || {};
        const linhaEndereco = [endereco.rua, endereco.numero].filter(Boolean).join(", ");
        const linhaCidade = [endereco.bairro, endereco.cidade, endereco.estado].filter(Boolean).join(" - ");

        const opcoesSelect = ETAPAS_PEDIDO.map((etapa, indice) => `
            <option value="${etapa.chave}" ${indice < indiceAtual ? "disabled" : ""} ${etapa.chave === item.status ? "selected" : ""}>
                ${etapa.rotulo}
            </option>
        `).join("");

        return `
            <article class="item-pedido-card ${item.status === "entregue" ? "item-pedido-entregue" : ""}">
                <div class="item-pedido-topo">
                    <div>
                        <span class="item-pedido-marca">${item.produtoMarca || ""}</span>
                        <span class="item-pedido-produto">${item.produtoNome} <span class="item-pedido-qtd">x${item.quantidade}</span></span>
                    </div>
                    <span class="item-pedido-valor">${formatarPreco(item.precoUnitario * item.quantidade)}</span>
                </div>
                <p class="item-pedido-comprador"><strong>Comprador:</strong> ${item.compradorNome} (${item.compradorEmail}) &middot; Pedido #${item.pedidoId} &middot; ${formatarData(item.criadoEm)}</p>
                <p class="item-pedido-endereco"><strong>Entregar em:</strong> ${linhaEndereco}${endereco.complemento ? ", " + endereco.complemento : ""} - ${linhaCidade}${endereco.cep ? " · CEP " + endereco.cep : ""}</p>
                ${renderizarStepper(item.status)}
                <div class="item-pedido-acoes">
                    <select id="status-${item.id}" ${item.status === "entregue" ? "disabled" : ""}>
                        ${opcoesSelect}
                    </select>
                    <button type="button" class="btn btn-primary" data-id="${item.id}" ${item.status === "entregue" ? "disabled" : ""}>
                        Atualizar status
                    </button>
                </div>
            </article>
        `;
    }).join("");
}

listaPedidos.addEventListener("click", async (evento) => {
    const botao = evento.target.closest("button[data-id]");
    if (!botao) return;

    const id = botao.dataset.id;
    const select = document.getElementById(`status-${id}`);
    const novoStatus = select.value;

    itemEmAtualizacao = id;
    botao.disabled = true;
    try {
        await apiFetch(`/api/pedidos/itens/${id}/status`, {
            method: "PUT",
            body: JSON.stringify({ status: novoStatus }),
        });
        mostrarToast("Status atualizado com sucesso!");
    } catch (erro) {
        mostrarToast(erro.message);
    } finally {
        itemEmAtualizacao = null;
        carregarPedidos();
    }
});

if (autorizado) {
    carregarPedidos();
    setInterval(carregarPedidos, INTERVALO_ATUALIZACAO);
}
