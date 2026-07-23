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

const contaLogada = document.getElementById("conta-logada");
const contaNome = document.getElementById("conta-nome");
const btnSair = document.getElementById("btn-sair");
const btnContaMenu = document.getElementById("btn-conta-menu");
const contaMenu = document.getElementById("conta-menu");
const linkEntrarMenu = document.getElementById("link-entrar-menu");
const linkMinhaContaMenu = document.getElementById("link-minha-conta-menu");
const linkEstoqueMenu = document.getElementById("link-estoque-menu");
const linkUsuariosMenu = document.getElementById("link-usuarios-menu");
const linkDescontosMenu = document.getElementById("link-descontos-menu");
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
    linkDescontosMenu.hidden = !ehAdmin;
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

const ROTULOS_PAGAMENTO = {
    pix: "Pix",
    cartao: "Cartão de crédito",
    boleto: "Boleto bancário",
};

function obterIdPedidoDaUrl() {
    const parametros = new URLSearchParams(window.location.search);
    return parametros.get("id");
}

async function carregarPedido() {
    const id = obterIdPedidoDaUrl();
    if (!id) {
        document.getElementById("confirmacao-vazio").hidden = false;
        return;
    }

    try {
        const pedido = await apiFetch(`/api/pedidos/${id}`);

        document.getElementById("confirmacao-card").hidden = false;
        document.getElementById("confirmacao-numero").textContent = `#${pedido.id}`;
        document.getElementById("confirmacao-pagamento").textContent = ROTULOS_PAGAMENTO[pedido.metodoPagamento] || pedido.metodoPagamento;

        const endereco = pedido.endereco || {};
        const linhaEndereco = [endereco.rua, endereco.numero].filter(Boolean).join(", ");
        const linhaCidade = [endereco.bairro, endereco.cidade, endereco.estado].filter(Boolean).join(" - ");

        const itensHtml = pedido.itens.map((item) => `
            <div class="checkout-resumo-item">
                <span>
                    <span class="checkout-resumo-item-nome">${item.nome}</span><br>
                    <span class="checkout-resumo-item-qtd">Qtd: ${item.quantidade}</span>
                </span>
                <span class="checkout-resumo-item-preco">${formatarPreco(item.precoUnitario * item.quantidade)}</span>
            </div>
        `).join("");

        document.getElementById("confirmacao-resumo").innerHTML = `
            <p><strong>Entrega para:</strong> ${endereco.destinatario || "-"}<br>
            ${linhaEndereco}${endereco.complemento ? ", " + endereco.complemento : ""}<br>
            ${linhaCidade}${endereco.cep ? " · CEP " + endereco.cep : ""}</p>
            <div class="checkout-resumo-itens">${itensHtml}</div>
            <div class="checkout-resumo-total">
                <span>Total</span>
                <span>${formatarPreco(pedido.total)}</span>
            </div>
        `;
    } catch (erro) {
        document.getElementById("confirmacao-vazio").hidden = false;
    }
}

renderizarConta();
carregarPedido();
