const CHAVE_TOKEN = "wgstore_token";
const CHAVE_CARRINHO = "loja-carrinho";
const CHAVE_CHECKOUT_ENDERECO = "loja-checkout-endereco";

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

function carregarCarrinho() {
    const dados = localStorage.getItem(CHAVE_CARRINHO);
    return dados ? JSON.parse(dados) : [];
}

function carregarEnderecoCheckout() {
    const dados = localStorage.getItem(CHAVE_CHECKOUT_ENDERECO);
    return dados ? JSON.parse(dados) : null;
}

function formatarPreco(valor) {
    return valor.toLocaleString("pt-br", { style: "currency", currency: "BRL" });
}

function promocaoAtiva(produto) {
    const hoje = new Date().toISOString().split("T")[0];
    return Boolean(produto.promocao > 0 && produto.promocaoValidade && produto.promocaoValidade >= hoje);
}

function precoEfetivo(produto) {
    if (!promocaoAtiva(produto)) return produto.preco;
    return produto.preco * (1 - produto.promocao / 100);
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

const resumoItens = document.getElementById("resumo-itens");
const resumoTotal = document.getElementById("resumo-total");
let totalPedido = 0;

async function renderizarResumo() {
    const carrinho = carregarCarrinho();
    const produtos = await apiFetch("/api/produtos");
    const produtosPorId = new Map(produtos.map((produto) => [produto.id, produto]));

    let total = 0;
    resumoItens.innerHTML = carrinho.map((item) => {
        const produto = produtosPorId.get(item.produtoId);
        if (!produto) return "";
        const subtotal = precoEfetivo(produto) * item.quantidade;
        total += subtotal;
        return `
            <div class="checkout-resumo-item">
                <span>
                    <span class="checkout-resumo-item-nome">${produto.nome}</span><br>
                    <span class="checkout-resumo-item-qtd">Qtd: ${item.quantidade}</span>
                </span>
                <span class="checkout-resumo-item-preco">${formatarPreco(subtotal)}</span>
            </div>
        `;
    }).join("");

    totalPedido = total;
    resumoTotal.textContent = formatarPreco(total);
}

const radiosMetodo = document.querySelectorAll('input[name="metodo"]');
const detalhePix = document.getElementById("detalhe-pix");
const detalheCartao = document.getElementById("detalhe-cartao");
const detalheBoleto = document.getElementById("detalhe-boleto");
const campoCartaoNumero = document.getElementById("cartao-numero");
const campoCartaoNome = document.getElementById("cartao-nome");
const campoCartaoValidade = document.getElementById("cartao-validade");
const campoCartaoCvv = document.getElementById("cartao-cvv");
const mensagemPagamento = document.getElementById("mensagem-pagamento");
const btnConfirmarPagamento = document.getElementById("btn-confirmar-pagamento");

radiosMetodo.forEach((radio) => {
    radio.addEventListener("change", () => {
        detalhePix.hidden = radio.value !== "pix" || !radio.checked;
        detalheCartao.hidden = radio.value !== "cartao" || !radio.checked;
        detalheBoleto.hidden = radio.value !== "boleto" || !radio.checked;
    });
});

campoCartaoNumero.addEventListener("input", () => {
    campoCartaoNumero.value = campoCartaoNumero.value
        .replace(/\D/g, "")
        .slice(0, 16)
        .replace(/(\d{4})(?=\d)/g, "$1 ");
});

campoCartaoValidade.addEventListener("input", () => {
    campoCartaoValidade.value = campoCartaoValidade.value
        .replace(/\D/g, "")
        .slice(0, 4)
        .replace(/(\d{2})(\d{1,2})/, "$1/$2");
});

campoCartaoCvv.addEventListener("input", () => {
    campoCartaoCvv.value = campoCartaoCvv.value.replace(/\D/g, "").slice(0, 4);
});

function mostrarMensagemPagamento(texto) {
    mensagemPagamento.textContent = texto;
    mensagemPagamento.className = "mensagem erro";
    mensagemPagamento.hidden = false;
}

function metodoSelecionado() {
    const radio = [...radiosMetodo].find((r) => r.checked);
    return radio ? radio.value : null;
}

btnConfirmarPagamento.addEventListener("click", async () => {
    mensagemPagamento.hidden = true;

    const metodo = metodoSelecionado();
    if (!metodo) {
        mostrarMensagemPagamento("Escolha uma forma de pagamento.");
        return;
    }

    if (metodo === "cartao") {
        const numero = campoCartaoNumero.value.replace(/\D/g, "");
        if (numero.length < 16 || !campoCartaoNome.value.trim() || campoCartaoValidade.value.length < 5 || campoCartaoCvv.value.length < 3) {
            mostrarMensagemPagamento("Preencha todos os dados do cartão.");
            return;
        }
    }

    const endereco = carregarEnderecoCheckout();
    const carrinho = carregarCarrinho();
    if (!endereco || carrinho.length === 0) {
        window.location.href = "endereco.html";
        return;
    }

    btnConfirmarPagamento.disabled = true;
    try {
        const itens = carrinho.map((item) => ({ produtoId: Number(item.produtoId), quantidade: item.quantidade }));
        const pedido = await apiFetch("/api/pedidos", {
            method: "POST",
            body: JSON.stringify({ itens, endereco, metodoPagamento: metodo }),
        });

        localStorage.removeItem(CHAVE_CARRINHO);
        localStorage.removeItem(CHAVE_CHECKOUT_ENDERECO);
        window.location.href = `pedido-confirmado.html?id=${pedido.pedidoId}`;
    } catch (erro) {
        mostrarMensagemPagamento(erro.message);
        btnConfirmarPagamento.disabled = false;
    }
});

const sessaoAtual = carregarSessao();
const carrinhoAtual = carregarCarrinho();
const enderecoAtual = carregarEnderecoCheckout();

if (!sessaoAtual) {
    window.location.href = "../login/index.html";
} else if (carrinhoAtual.length === 0) {
    window.location.href = "index.html";
} else if (!enderecoAtual) {
    window.location.href = "endereco.html";
} else {
    renderizarConta();
    renderizarResumo();
}
