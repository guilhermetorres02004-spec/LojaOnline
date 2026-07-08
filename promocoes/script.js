const CHAVE_PRODUTOS = "estoque-produtos";
const CHAVE_SESSAO = "loja-usuario-logado";
const PROMOCAO_MAXIMA = 90;

function importarSessaoDaUrl() {
    const parametros = new URLSearchParams(window.location.search);
    const sessaoCodificada = parametros.get("sessao");
    if (!sessaoCodificada) return;

    localStorage.setItem(CHAVE_SESSAO, sessaoCodificada);
    parametros.delete("sessao");
    const query = parametros.toString();
    window.history.replaceState({}, "", window.location.pathname + (query ? `?${query}` : ""));
}

function usuarioEhAdmin() {
    const dados = localStorage.getItem(CHAVE_SESSAO);
    if (!dados) return false;
    try {
        return JSON.parse(dados).papel === "admin";
    } catch (erro) {
        return false;
    }
}

importarSessaoDaUrl();
const autorizado = usuarioEhAdmin();
document.getElementById("app-promocoes").hidden = !autorizado;
document.getElementById("acesso-negado").hidden = autorizado;

if (autorizado) {
    const sessaoAtual = localStorage.getItem(CHAVE_SESSAO);
    const parametro = encodeURIComponent(sessaoAtual);
    document.getElementById("link-cadastros").href = `../cadastros/index.html?sessao=${parametro}`;
    document.getElementById("link-estoque").href = `../estoque/index.html?sessao=${parametro}`;
    document.getElementById("link-usuarios").href = `../usuarios/index.html?sessao=${parametro}`;
}

const buscaProduto = document.getElementById("busca-produto");
const contadorProdutos = document.getElementById("contador-produtos");
const listaPromocoes = document.getElementById("lista-promocoes");
const vazioPromocoes = document.getElementById("vazio-promocoes");
const vazioPromocoesTexto = document.getElementById("vazio-promocoes-texto");
const toast = document.getElementById("toast");

const btnAbrirFormPromocao = document.getElementById("btn-abrir-form-promocao");
const btnCancelarPromocao = document.getElementById("btn-cancelar-promocao");
const formPromocao = document.getElementById("form-promocao");
const campoPromoProduto = document.getElementById("promo-produto");
const campoPromoPercentual = document.getElementById("promo-percentual");
const campoPromoValidade = document.getElementById("promo-validade");
const mensagemPromocao = document.getElementById("mensagem-promocao");

let termoBusca = "";
let toastTimeout = null;

function carregarProdutos() {
    const dados = localStorage.getItem(CHAVE_PRODUTOS);
    return dados ? JSON.parse(dados) : [];
}

function salvarProdutos(produtos) {
    localStorage.setItem(CHAVE_PRODUTOS, JSON.stringify(produtos));
}

function formatarPreco(valor) {
    return valor.toLocaleString("pt-br", { style: "currency", currency: "BRL" });
}

function formatarData(dataIso) {
    const [ano, mes, dia] = dataIso.split("-");
    return `${dia}/${mes}/${ano}`;
}

function hojeIso() {
    return new Date().toISOString().split("T")[0];
}

function promocaoAtiva(produto) {
    return Boolean(produto.promocao > 0 && produto.promocaoValidade && produto.promocaoValidade >= hojeIso());
}

function mostrarToast(mensagem) {
    toast.textContent = mensagem;
    toast.classList.add("visivel");
    clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => {
        toast.classList.remove("visivel");
    }, 2600);
}

function mostrarMensagemPromocao(texto, tipo) {
    mensagemPromocao.textContent = texto;
    mensagemPromocao.className = `mensagem ${tipo}`;
    mensagemPromocao.hidden = false;
}

function precoComDescontoHtml(produto) {
    if (!promocaoAtiva(produto)) {
        return formatarPreco(produto.preco);
    }
    const precoFinal = produto.preco * (1 - produto.promocao / 100);
    return `<span class="preco-riscado">${formatarPreco(produto.preco)}</span><span class="preco-promocional">${formatarPreco(precoFinal)}</span>`;
}

function abrirFormPromocao() {
    const produtos = carregarProdutos();
    campoPromoProduto.innerHTML = `<option value="">Selecione um produto</option>` + produtos.map((produto) =>
        `<option value="${produto.id}">${produto.nome}</option>`
    ).join("");
    campoPromoValidade.min = hojeIso();

    formPromocao.reset();
    mensagemPromocao.hidden = true;
    formPromocao.hidden = false;
    btnAbrirFormPromocao.hidden = true;
}

function fecharFormPromocao() {
    formPromocao.reset();
    formPromocao.hidden = true;
    mensagemPromocao.hidden = true;
    btnAbrirFormPromocao.hidden = false;
}

function renderizarPromocoes() {
    const produtos = carregarProdutos();

    const termo = termoBusca.trim().toLowerCase();
    const filtrados = termo
        ? produtos.filter((produto) =>
              produto.nome.toLowerCase().includes(termo) ||
              (produto.tipo || "").toLowerCase().includes(termo) ||
              (produto.marca || "").toLowerCase().includes(termo)
          )
        : produtos;

    contadorProdutos.textContent = `${filtrados.length} ${filtrados.length === 1 ? "produto" : "produtos"}`;
    listaPromocoes.innerHTML = "";

    if (filtrados.length === 0) {
        vazioPromocoes.hidden = false;
        vazioPromocoesTexto.textContent = produtos.length === 0
            ? "Nenhum produto cadastrado ainda."
            : "Nenhum produto encontrado para essa busca.";
        return;
    }

    vazioPromocoes.hidden = true;

    filtrados.forEach((produto) => {
        const ativa = promocaoAtiva(produto);
        const expirada = Boolean(produto.promocao > 0 && produto.promocaoValidade && !ativa);
        const linha = document.createElement("tr");
        linha.innerHTML = `
            <td class="nome-produto">${produto.nome}</td>
            <td>${produto.marca || "—"}</td>
            <td><span class="carrossel-badge ${produto.noCarrossel ? "sim" : ""}">${produto.noCarrossel ? "Sim" : "Não"}</span></td>
            <td>${formatarPreco(produto.preco)}</td>
            <td>${ativa ? `${produto.promocao}%` : "—"}</td>
            <td class="${expirada ? "validade-expirada" : ""}">${produto.promocaoValidade ? formatarData(produto.promocaoValidade) + (expirada ? " (expirada)" : "") : "—"}</td>
            <td>${precoComDescontoHtml(produto)}</td>
            <td>${produto.promocao > 0 ? `<button type="button" class="acao-btn remover-promocao" data-id="${produto.id}">Remover</button>` : ""}</td>
        `;
        listaPromocoes.appendChild(linha);
    });
}

if (autorizado) {
    buscaProduto.addEventListener("input", () => {
        termoBusca = buscaProduto.value;
        renderizarPromocoes();
    });

    btnAbrirFormPromocao.addEventListener("click", abrirFormPromocao);
    btnCancelarPromocao.addEventListener("click", fecharFormPromocao);

    formPromocao.addEventListener("submit", (evento) => {
        evento.preventDefault();
        mensagemPromocao.hidden = true;

        const produtoId = campoPromoProduto.value;
        const percentual = Number(campoPromoPercentual.value);
        const validade = campoPromoValidade.value;

        if (!produtoId) {
            mostrarMensagemPromocao("Selecione um produto.", "erro");
            return;
        }

        if (!percentual || percentual < 1 || percentual > PROMOCAO_MAXIMA) {
            mostrarMensagemPromocao(`Informe um desconto entre 1% e ${PROMOCAO_MAXIMA}%.`, "erro");
            return;
        }

        if (!validade) {
            mostrarMensagemPromocao("Escolha a data em que a promoção termina.", "erro");
            return;
        }

        if (validade < hojeIso()) {
            mostrarMensagemPromocao("A data de término não pode ser no passado.", "erro");
            return;
        }

        const produtos = carregarProdutos();
        const produto = produtos.find((item) => item.id === produtoId);
        if (!produto) {
            mostrarMensagemPromocao("Produto não encontrado.", "erro");
            return;
        }

        produto.promocao = percentual;
        produto.promocaoValidade = validade;
        salvarProdutos(produtos);
        renderizarPromocoes();

        mostrarMensagemPromocao(`Promoção aplicada em ${produto.nome}!`, "sucesso");
        setTimeout(fecharFormPromocao, 1200);
    });

    listaPromocoes.addEventListener("click", (evento) => {
        const botao = evento.target.closest(".remover-promocao");
        if (!botao) return;

        const id = botao.dataset.id;
        const produtos = carregarProdutos();
        const produto = produtos.find((item) => item.id === id);
        if (!produto) return;

        produto.promocao = 0;
        produto.promocaoValidade = "";
        salvarProdutos(produtos);
        renderizarPromocoes();
        mostrarToast(`Promoção de ${produto.nome} removida.`);
    });

    renderizarPromocoes();
}
