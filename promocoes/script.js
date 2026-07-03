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
    document.getElementById("link-estoque").href = `../estoque/index.html?sessao=${parametro}`;
    document.getElementById("link-usuarios").href = `../usuarios/index.html?sessao=${parametro}`;
}

const buscaProduto = document.getElementById("busca-produto");
const contadorProdutos = document.getElementById("contador-produtos");
const listaPromocoes = document.getElementById("lista-promocoes");
const vazioPromocoes = document.getElementById("vazio-promocoes");
const vazioPromocoesTexto = document.getElementById("vazio-promocoes-texto");
const toast = document.getElementById("toast");

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

function mostrarToast(mensagem) {
    toast.textContent = mensagem;
    toast.classList.add("visivel");
    clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => {
        toast.classList.remove("visivel");
    }, 2600);
}

function precoComDescontoHtml(preco, promocao) {
    if (!promocao || promocao <= 0) {
        return formatarPreco(preco);
    }
    const precoFinal = preco * (1 - promocao / 100);
    return `<span class="preco-riscado">${formatarPreco(preco)}</span><span class="preco-promocional">${formatarPreco(precoFinal)}</span>`;
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
        const linha = document.createElement("tr");
        linha.dataset.id = produto.id;
        linha.innerHTML = `
            <td class="nome-produto">${produto.nome}</td>
            <td>${produto.marca || "—"}</td>
            <td><span class="carrossel-badge ${produto.noCarrossel ? "sim" : ""}">${produto.noCarrossel ? "Sim" : "Não"}</span></td>
            <td>${formatarPreco(produto.preco)}</td>
            <td>
                <div class="promocao-campo">
                    <input type="number" class="promocao-input" data-id="${produto.id}" min="0" max="${PROMOCAO_MAXIMA}" step="1" value="${produto.promocao || 0}">
                    <span>%</span>
                </div>
            </td>
            <td class="preco-final" data-id="${produto.id}">${precoComDescontoHtml(produto.preco, produto.promocao)}</td>
        `;
        listaPromocoes.appendChild(linha);
    });
}

if (autorizado) {
    buscaProduto.addEventListener("input", () => {
        termoBusca = buscaProduto.value;
        renderizarPromocoes();
    });

    listaPromocoes.addEventListener("input", (evento) => {
        if (!evento.target.classList.contains("promocao-input")) return;

        const id = evento.target.dataset.id;
        const produtos = carregarProdutos();
        const produto = produtos.find((item) => item.id === id);
        if (!produto) return;

        const valor = Math.min(PROMOCAO_MAXIMA, Math.max(0, Number(evento.target.value) || 0));
        const linha = evento.target.closest("tr");
        linha.querySelector(".preco-final").innerHTML = precoComDescontoHtml(produto.preco, valor);
    });

    listaPromocoes.addEventListener("change", (evento) => {
        if (!evento.target.classList.contains("promocao-input")) return;

        const id = evento.target.dataset.id;
        const produtos = carregarProdutos();
        const produto = produtos.find((item) => item.id === id);
        if (!produto) return;

        const valor = Math.min(PROMOCAO_MAXIMA, Math.max(0, Number(evento.target.value) || 0));
        evento.target.value = valor;
        produto.promocao = valor;
        salvarProdutos(produtos);

        mostrarToast(
            valor > 0
                ? `${produto.nome} agora está com ${valor}% de desconto.`
                : `Promoção de ${produto.nome} removida.`
        );
    });

    renderizarPromocoes();
}
