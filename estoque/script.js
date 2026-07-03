const CHAVE_ARMAZENAMENTO = "estoque-produtos";
const CHAVE_SESSAO = "loja-usuario-logado";
const LIMIAR_ESTOQUE_BAIXO = 5;

const iconeFotoVazia = `
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M3 7L12 3L21 7V17L12 21L3 17V7Z" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/>
        <path d="M3 7L12 11L21 7" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/>
        <path d="M12 11V21" stroke="currentColor" stroke-width="1.4"/>
    </svg>
`;

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
    const parametro = encodeURIComponent(sessaoAtual);
    document.getElementById("link-usuarios").href = `../usuarios/index.html?sessao=${parametro}`;
    document.getElementById("link-promocoes").href = `../promocoes/index.html?sessao=${parametro}`;
}

const form = document.getElementById("form-produto");
const formTitulo = document.getElementById("form-titulo");
const campoId = document.getElementById("produto-id");
const campoNome = document.getElementById("nome");
const campoFoto = document.getElementById("foto");
const fotoPreview = document.getElementById("foto-preview");
const campoTipo = document.getElementById("tipo");
const campoMarca = document.getElementById("marca");
const campoQuantidade = document.getElementById("quantidade");
const campoPreco = document.getElementById("preco");
const campoDescricao = document.getElementById("descricao");
const campoNoCarrossel = document.getElementById("no-carrossel");
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
let fotoAtual = "";

campoFoto.addEventListener("change", () => {
    const arquivo = campoFoto.files[0];
    if (!arquivo) return;

    const leitor = new FileReader();
    leitor.onload = () => {
        fotoAtual = leitor.result;
        fotoPreview.src = fotoAtual;
        fotoPreview.hidden = false;
    };
    leitor.readAsDataURL(arquivo);
});

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

function obterTipo(produto) {
    return produto.tipo || "Sem categoria";
}

function atualizarFiltroProduto(produtos) {
    const tiposUnicos = [...new Set(produtos.map((produto) => obterTipo(produto)))].sort((a, b) =>
        a.localeCompare(b, "pt-br")
    );

    if (!tiposUnicos.includes(filtroAtual) && filtroAtual !== "todos") {
        filtroAtual = "todos";
    }

    filtroProduto.innerHTML = `<option value="todos">Todos os tipos</option>`;
    tiposUnicos.forEach((tipo) => {
        const opcao = document.createElement("option");
        opcao.value = tipo;
        opcao.textContent = tipo;
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
        : produtos.filter((produto) => obterTipo(produto) === filtroAtual);

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
        const foto = produto.foto
            ? `<img src="${produto.foto}" class="foto-miniatura" alt="Foto de ${produto.nome}">`
            : `<span class="foto-miniatura-vazia">${iconeFotoVazia}</span>`;
        linha.innerHTML = `
            <td><input type="checkbox" class="checkbox-produto" data-id="${produto.id}" ${marcado ? "checked" : ""}></td>
            <td>${foto}</td>
            <td class="nome-produto">${produto.nome}</td>
            <td>${produto.tipo || "—"}</td>
            <td>${produto.marca || "—"}</td>
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
    fotoAtual = "";
    fotoPreview.hidden = true;
    fotoPreview.src = "";
    formTitulo.textContent = "Novo produto";
    btnSalvar.textContent = "Cadastrar";
    btnCancelar.hidden = true;
}

form.addEventListener("submit", (evento) => {
    evento.preventDefault();

    const produtos = carregarProdutos();
    const id = campoId.value;
    const nome = campoNome.value.trim();
    const tipo = campoTipo.value.trim();
    const marca = campoMarca.value.trim();
    const quantidade = Number(campoQuantidade.value);
    const preco = Number(campoPreco.value);
    const descricao = campoDescricao.value.trim();
    const noCarrossel = campoNoCarrossel.checked;

    if (!nome || !tipo || !marca || quantidade < 0 || preco < 0) {
        return;
    }

    if (id) {
        const produto = produtos.find((item) => item.id === id);
        produto.nome = nome;
        produto.tipo = tipo;
        produto.marca = marca;
        produto.quantidade = quantidade;
        produto.preco = preco;
        produto.foto = fotoAtual;
        produto.descricao = descricao;
        produto.noCarrossel = noCarrossel;
    } else {
        produtos.push({
            id: Date.now().toString(),
            nome,
            tipo,
            marca,
            quantidade,
            preco,
            foto: fotoAtual,
            descricao,
            noCarrossel,
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
        campoTipo.value = produto.tipo || "";
        campoMarca.value = produto.marca || "";
        campoQuantidade.value = produto.quantidade;
        campoPreco.value = produto.preco;
        campoDescricao.value = produto.descricao || "";
        campoNoCarrossel.checked = Boolean(produto.noCarrossel);
        campoFoto.value = "";
        fotoAtual = produto.foto || "";
        if (fotoAtual) {
            fotoPreview.src = fotoAtual;
            fotoPreview.hidden = false;
        } else {
            fotoPreview.hidden = true;
            fotoPreview.src = "";
        }
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
        filtroAtual === "todos" || obterTipo(produto) === filtroAtual
    );
    selecionarTodos.checked = produtosVisiveis.length > 0 &&
        produtosVisiveis.every((produto) => selecionados.has(produto.id));
    atualizarBotaoRemoverSelecionados();
});

selecionarTodos.addEventListener("change", () => {
    const produtosVisiveis = carregarProdutos().filter((produto) =>
        filtroAtual === "todos" || obterTipo(produto) === filtroAtual
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
