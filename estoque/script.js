const CHAVE_TOKEN = "wgstore_token";
const LIMIAR_ESTOQUE_BAIXO = 5;
const LIMITE_PRODUTOS_VENDEDOR_DIA = 30;

const iconeFotoVazia = `
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M3 7L12 3L21 7V17L12 21L3 17V7Z" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/>
        <path d="M3 7L12 11L21 7" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/>
        <path d="M12 11V21" stroke="currentColor" stroke-width="1.4"/>
    </svg>
`;

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
const ehAdmin = Boolean(sessaoUsuario && sessaoUsuario.papel === "admin");
const ehVendedor = Boolean(sessaoUsuario && sessaoUsuario.papel === "vendedor");
const autorizado = ehAdmin || ehVendedor;

document.getElementById("app-estoque").hidden = !autorizado;
document.getElementById("acesso-negado").hidden = autorizado;

const linkCadastros = document.getElementById("link-cadastros");
const linkUsuarios = document.getElementById("link-usuarios");
const linkPromocoes = document.getElementById("link-promocoes");

if (autorizado) {
    linkCadastros.hidden = !ehAdmin;
    linkUsuarios.hidden = !ehAdmin;
    linkPromocoes.hidden = !ehAdmin;
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
const campoCarrossel = document.getElementById("campo-carrossel");
const mensagemProduto = document.getElementById("mensagem-produto");
const limiteVendedorTexto = document.getElementById("limite-vendedor");
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
    return apiFetch("/api/produtos");
}

function formatarPreco(valor) {
    return valor.toLocaleString("pt-br", { style: "currency", currency: "BRL" });
}

function hojeIso() {
    return new Date().toISOString().split("T")[0];
}

function mostrarMensagemProduto(texto, tipo) {
    mensagemProduto.textContent = texto;
    mensagemProduto.className = `mensagem ${tipo}`;
    mensagemProduto.hidden = false;
}

function atualizarLimiteVendedor(produtos) {
    if (!ehVendedor || !sessaoUsuario) {
        limiteVendedorTexto.hidden = true;
        return;
    }
    const hoje = hojeIso();
    const total = produtos.filter((produto) => produto.criadoPorId === sessaoUsuario.id && produto.criadoEm === hoje).length;
    limiteVendedorTexto.hidden = false;
    limiteVendedorTexto.textContent = `Você já anunciou ${total} de ${LIMITE_PRODUTOS_VENDEDOR_DIA} produtos hoje.`;
}

if (ehVendedor) {
    campoCarrossel.hidden = true;
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

async function renderizarProdutos() {
    const produtos = await carregarProdutos();
    const idsExistentes = new Set(produtos.map((produto) => produto.id));
    selecionados.forEach((id) => {
        if (!idsExistentes.has(id)) selecionados.delete(id);
    });

    atualizarFiltroProduto(produtos);
    atualizarLimiteVendedor(produtos);

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
    mensagemProduto.hidden = true;
    formTitulo.textContent = "Novo produto";
    btnSalvar.textContent = "Cadastrar";
    btnCancelar.hidden = true;
}

form.addEventListener("submit", async (evento) => {
    evento.preventDefault();
    mensagemProduto.hidden = true;

    const id = campoId.value;
    const nome = campoNome.value.trim();
    const tipo = campoTipo.value.trim();
    const marca = campoMarca.value.trim();
    const quantidade = Number(campoQuantidade.value);
    const preco = Number(campoPreco.value);
    const descricao = campoDescricao.value.trim();
    const noCarrossel = ehVendedor ? false : campoNoCarrossel.checked;

    if (!nome || !tipo || !marca || quantidade < 0 || preco < 0) {
        mostrarMensagemProduto("Preencha todos os campos corretamente.", "erro");
        return;
    }

    const corpo = { nome, tipo, marca, quantidade, preco, foto: fotoAtual, descricao, noCarrossel };

    try {
        if (id) {
            await apiFetch(`/api/produtos/${id}`, { method: "PUT", body: JSON.stringify(corpo) });
        } else {
            await apiFetch("/api/produtos", { method: "POST", body: JSON.stringify(corpo) });
        }
        await renderizarProdutos();
        limparFormulario();
    } catch (erro) {
        mostrarMensagemProduto(erro.message, "erro");
    }
});

listaProdutos.addEventListener("click", async (evento) => {
    const id = evento.target.dataset.id;
    if (!id) return;

    if (evento.target.classList.contains("remover")) {
        await apiFetch(`/api/produtos/${id}`, { method: "DELETE" });
        selecionados.delete(id);
        await renderizarProdutos();
        limparFormulario();
        return;
    }

    if (evento.target.classList.contains("editar")) {
        const produto = await apiFetch(`/api/produtos/${id}`);
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

listaProdutos.addEventListener("change", async (evento) => {
    if (!evento.target.classList.contains("checkbox-produto")) return;

    const id = evento.target.dataset.id;
    if (evento.target.checked) {
        selecionados.add(id);
        evento.target.closest("tr").classList.add("linha-selecionada");
    } else {
        selecionados.delete(id);
        evento.target.closest("tr").classList.remove("linha-selecionada");
    }

    const produtos = await carregarProdutos();
    const produtosVisiveis = produtos.filter((produto) =>
        filtroAtual === "todos" || obterTipo(produto) === filtroAtual
    );
    selecionarTodos.checked = produtosVisiveis.length > 0 &&
        produtosVisiveis.every((produto) => selecionados.has(produto.id));
    atualizarBotaoRemoverSelecionados();
});

selecionarTodos.addEventListener("change", async () => {
    const produtos = await carregarProdutos();
    const produtosVisiveis = produtos.filter((produto) =>
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

btnRemoverSelecionados.addEventListener("click", async () => {
    if (selecionados.size === 0) return;

    await apiFetch("/api/produtos", { method: "DELETE", body: JSON.stringify({ ids: [...selecionados] }) });
    selecionados.clear();
    await renderizarProdutos();
    limparFormulario();
});

btnCancelar.addEventListener("click", limparFormulario);

if (autorizado) {
    renderizarProdutos();
}
