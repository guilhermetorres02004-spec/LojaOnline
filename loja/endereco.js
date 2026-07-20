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

    resumoTotal.textContent = formatarPreco(total);
}

const campoCep = document.getElementById("endereco-cep");
const campoRua = document.getElementById("endereco-rua");
const campoBairro = document.getElementById("endereco-bairro");
const campoCidade = document.getElementById("endereco-cidade");
const campoEstado = document.getElementById("endereco-estado");
const campoNumero = document.getElementById("endereco-numero");
const campoComplemento = document.getElementById("endereco-complemento");
const campoDestinatario = document.getElementById("endereco-destinatario");
const mensagemEndereco = document.getElementById("mensagem-endereco");
const formEndereco = document.getElementById("form-endereco");

function mascararCep(valor) {
    return valor.replace(/\D/g, "").slice(0, 8).replace(/(\d{5})(\d{1,3})/, "$1-$2");
}

campoCep.addEventListener("input", () => {
    campoCep.value = mascararCep(campoCep.value);
});

campoCep.addEventListener("blur", async () => {
    const cep = campoCep.value.replace(/\D/g, "");
    if (cep.length !== 8) return;

    try {
        const resposta = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
        const dados = await resposta.json();
        if (dados.erro) return;

        campoRua.value = dados.logradouro || campoRua.value;
        campoBairro.value = dados.bairro || campoBairro.value;
        campoCidade.value = dados.localidade || campoCidade.value;
        if (dados.uf) campoEstado.value = dados.uf;
        if (dados.logradouro) campoNumero.focus();
    } catch (erro) {
        /* busca de CEP é apenas uma conveniência; falha silenciosa não bloqueia o checkout */
    }
});

function mostrarMensagemEndereco(texto) {
    mensagemEndereco.textContent = texto;
    mensagemEndereco.className = "mensagem erro";
    mensagemEndereco.hidden = false;
}

formEndereco.addEventListener("submit", (evento) => {
    evento.preventDefault();

    const cep = campoCep.value.replace(/\D/g, "");
    if (cep.length !== 8) {
        mostrarMensagemEndereco("Informe um CEP válido.");
        return;
    }

    const endereco = {
        destinatario: campoDestinatario.value.trim(),
        cep: campoCep.value.trim(),
        rua: campoRua.value.trim(),
        numero: campoNumero.value.trim(),
        complemento: campoComplemento.value.trim(),
        bairro: campoBairro.value.trim(),
        cidade: campoCidade.value.trim(),
        estado: campoEstado.value,
    };

    const obrigatorios = ["destinatario", "cep", "rua", "numero", "bairro", "cidade", "estado"];
    if (obrigatorios.some((campo) => !endereco[campo])) {
        mostrarMensagemEndereco("Preencha todos os campos obrigatórios.");
        return;
    }

    localStorage.setItem(CHAVE_CHECKOUT_ENDERECO, JSON.stringify(endereco));
    window.location.href = "pagamento.html";
});

const sessaoAtual = carregarSessao();
const carrinhoAtual = carregarCarrinho();

if (!sessaoAtual) {
    window.location.href = "../login/index.html";
} else if (carrinhoAtual.length === 0) {
    window.location.href = "index.html";
} else {
    renderizarConta();
    renderizarResumo();
}
