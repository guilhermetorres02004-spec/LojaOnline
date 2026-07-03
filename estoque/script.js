const CHAVE_ARMAZENAMENTO = "estoque-produtos";
const CHAVE_SESSAO = "loja-usuario-logado";
const LIMIAR_ESTOQUE_BAIXO = 5;

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
document.getElementById("app-estoque").hidden = !autorizado;
document.getElementById("acesso-negado").hidden = autorizado;

if (autorizado) {
    const sessaoAtual = localStorage.getItem(CHAVE_SESSAO);
    document.getElementById("link-usuarios").href = `../usuarios/index.html?sessao=${encodeURIComponent(sessaoAtual)}`;
}

const form = document.getElementById("form-produto");
const formTitulo = document.getElementById("form-titulo");
const campoId = document.getElementById("produto-id");
const campoNome = document.getElementById("nome");
const campoQuantidade = document.getElementById("quantidade");
const campoPreco = document.getElementById("preco");
const btnSalvar = document.getElementById("btn-salvar");
const btnCancelar = document.getElementById("btn-cancelar");
const listaProdutos = document.getElementById("lista-produtos");
const textoVazio = document.getElementById("vazio");
const contadorProdutos = document.getElementById("contador-produtos");
const statTotal = document.getElementById("stat-total");
const statItens = document.getElementById("stat-itens");
const statValor = document.getElementById("stat-valor");
const selecionarTodos = document.getElementById("selecionar-todos");
const btnRemoverSelecionados = document.getElementById("btn-remover-selecionados");
const filtroProduto = document.getElementById("filtro-produto");

const selecionados = new Set();
let filtroAtual = "todos";

function carregarProdutos() {
    const dados = localStorage.getItem(CHAVE_ARMAZENAMENTO);
    return dados ? JSON.parse(dados) : [];
}

function salvarProdutos(produtos) {
    localStorage.setItem(CHAVE_ARMAZENAMENTO, JSON.stringify(produtos));
}

function formatarPreco(valor) {
    return valor.toLocaleString("pt-br", { style: "currency", currency: "BRL" });
}

function atualizarBotaoRemoverSelecionados() {
    const quantidade = selecionados.size;
    btnRemoverSelecionados.hidden = quantidade === 0;
    btnRemoverSelecionados.textContent = quantidade > 1
        ? `Remover selecionados (${quantidade})`
        : "Remover selecionado";
}

function atualizarFiltroProduto(produtos) {
    const nomesUnicos = [...new Set(produtos.map((produto) => produto.nome))].sort((a, b) =>
        a.localeCompare(b, "pt-br")
    );

    if (!nomesUnicos.includes(filtroAtual) && filtroAtual !== "todos") {
        filtroAtual = "todos";
    }

    filtroProduto.innerHTML = `<option value="todos">Todos os produtos</option>`;
    nomesUnicos.forEach((nome) => {
        const opcao = document.createElement("option");
        opcao.value = nome;
        opcao.textContent = nome;
        filtroProduto.appendChild(opcao);
    });
    filtroProduto.value = filtroAtual;
}

function renderizarProdutos() {
    const produtos = carregarProdutos();
    const idsExistentes = new Set(produtos.map((produto) => produto.id));
    selecionados.forEach((id) => {
        if (!idsExistentes.has(id)) selecionados.delete(id);
    });

    atualizarFiltroProduto(produtos);
    const produtosFiltrados = filtroAtual === "todos"
        ? produtos
        : produtos.filter((produto) => produto.nome === filtroAtual);

    listaProdutos.innerHTML = "";
    textoVazio.hidden = produtosFiltrados.length > 0;
    textoVazio.querySelector("p").textContent = produtos.length === 0
        ? "Nenhum produto cadastrado ainda."
        : "Nenhum produto encontrado para esse filtro.";

    contadorProdutos.textContent = `${produtosFiltrados.length} ${produtosFiltrados.length === 1 ? "item" : "itens"}`;
    statTotal.textContent = produtos.length;

    const totalItens = produtos.reduce((soma, produto) => soma + produto.quantidade, 0);
    const valorTotal = produtos.reduce((soma, produto) => soma + produto.quantidade * produto.preco, 0);
    statItens.textContent = totalItens;
    statValor.textContent = formatarPreco(valorTotal);

    produtosFiltrados.forEach((produto) => {
        const estoqueBaixo = produto.quantidade <= LIMIAR_ESTOQUE_BAIXO;
        const marcado = selecionados.has(produto.id);
        const linha = document.createElement("tr");
        linha.className = marcado ? "linha-selecionada" : "";
        linha.innerHTML = `
            <td><input type="checkbox" class="checkbox-produto" data-id="${produto.id}" ${marcado ? "checked" : ""}></td>
            <td class="nome-produto">${produto.nome}</td>
            <td><span class="qtd-badge ${estoqueBaixo ? "qtd-baixa" : ""}">${produto.quantidade}</span></td>
            <td>${formatarPreco(produto.preco)}</td>
            <td>
                <div class="acoes">
                    <button class="acao-btn editar" data-id="${produto.id}">Editar</button>
                    <button class="acao-btn remover" data-id="${produto.id}">Remover</button>
                </div>
            </td>
        `;
        listaProdutos.appendChild(linha);
    });

    selecionarTodos.checked = produtosFiltrados.length > 0 &&
        produtosFiltrados.every((produto) => selecionados.has(produto.id));
    atualizarBotaoRemoverSelecionados();
}

function limparFormulario() {
    form.reset();
    campoId.value = "";
    formTitulo.textContent = "Novo produto";
    btnSalvar.textContent = "Cadastrar";
    btnCancelar.hidden = true;
}

form.addEventListener("submit", (evento) => {
    evento.preventDefault();

    const produtos = carregarProdutos();
    const id = campoId.value;
    const nome = campoNome.value.trim();
    const quantidade = Number(campoQuantidade.value);
    const preco = Number(campoPreco.value);

    if (!nome || quantidade < 0 || preco < 0) {
        return;
    }

    if (id) {
        const produto = produtos.find((item) => item.id === id);
        produto.nome = nome;
        produto.quantidade = quantidade;
        produto.preco = preco;
    } else {
        produtos.push({
            id: Date.now().toString(),
            nome,
            quantidade,
            preco,
        });
    }

    salvarProdutos(produtos);
    renderizarProdutos();
    limparFormulario();
});

listaProdutos.addEventListener("click", (evento) => {
    const id = evento.target.dataset.id;
    if (!id) return;

    const produtos = carregarProdutos();

    if (evento.target.classList.contains("remover")) {
        const restantes = produtos.filter((item) => item.id !== id);
        selecionados.delete(id);
        salvarProdutos(restantes);
        renderizarProdutos();
        limparFormulario();
        return;
    }

    if (evento.target.classList.contains("editar")) {
        const produto = produtos.find((item) => item.id === id);
        campoId.value = produto.id;
        campoNome.value = produto.nome;
        campoQuantidade.value = produto.quantidade;
        campoPreco.value = produto.preco;
        formTitulo.textContent = "Editar produto";
        btnSalvar.textContent = "Salvar alterações";
        btnCancelar.hidden = false;
        campoNome.focus();
    }
});

listaProdutos.addEventListener("change", (evento) => {
    if (!evento.target.classList.contains("checkbox-produto")) return;

    const id = evento.target.dataset.id;
    if (evento.target.checked) {
        selecionados.add(id);
        evento.target.closest("tr").classList.add("linha-selecionada");
    } else {
        selecionados.delete(id);
        evento.target.closest("tr").classList.remove("linha-selecionada");
    }

    const produtosVisiveis = carregarProdutos().filter((produto) =>
        filtroAtual === "todos" || produto.nome === filtroAtual
    );
    selecionarTodos.checked = produtosVisiveis.length > 0 &&
        produtosVisiveis.every((produto) => selecionados.has(produto.id));
    atualizarBotaoRemoverSelecionados();
});

selecionarTodos.addEventListener("change", () => {
    const produtosVisiveis = carregarProdutos().filter((produto) =>
        filtroAtual === "todos" || produto.nome === filtroAtual
    );

    if (selecionarTodos.checked) {
        produtosVisiveis.forEach((produto) => selecionados.add(produto.id));
    } else {
        produtosVisiveis.forEach((produto) => selecionados.delete(produto.id));
    }

    renderizarProdutos();
});

filtroProduto.addEventListener("change", () => {
    filtroAtual = filtroProduto.value;
    renderizarProdutos();
});

btnRemoverSelecionados.addEventListener("click", () => {
    if (selecionados.size === 0) return;

    const produtos = carregarProdutos();
    const restantes = produtos.filter((produto) => !selecionados.has(produto.id));
    selecionados.clear();
    salvarProdutos(restantes);
    renderizarProdutos();
    limparFormulario();
});

btnCancelar.addEventListener("click", limparFormulario);

if (autorizado) {
    renderizarProdutos();
}
