const CHAVE_PRODUTOS = "estoque-produtos";
const CHAVE_CARRINHO = "loja-carrinho";
const CHAVE_SESSAO = "loja-usuario-logado";
const CHAVE_USUARIOS = "loja-usuarios";
const LIMIAR_ESTOQUE_BAIXO = 5;

const contaLogada = document.getElementById("conta-logada");
const contaNome = document.getElementById("conta-nome");
const btnSair = document.getElementById("btn-sair");
const btnContaMenu = document.getElementById("btn-conta-menu");
const contaMenu = document.getElementById("conta-menu");
const btnAbrirCarrinho = document.getElementById("btn-abrir-carrinho");
const linkEntrarMenu = document.getElementById("link-entrar-menu");
const linkEstoqueMenu = document.getElementById("link-estoque-menu");
const linkUsuariosMenu = document.getElementById("link-usuarios-menu");
const linkPromocoesMenu = document.getElementById("link-promocoes-menu");
const linkCadastrosMenu = document.getElementById("link-cadastros-menu");

const produtoDetalhe = document.getElementById("produto-detalhe");
const produtoNaoEncontrado = document.getElementById("produto-nao-encontrado");
const produtosRelacionados = document.getElementById("produtos-relacionados");
const gridRelacionados = document.getElementById("grid-relacionados");

const carrinhoContador = document.getElementById("carrinho-contador");
const carrinhoDrawer = document.getElementById("carrinho-drawer");
const overlay = document.getElementById("overlay");
const btnFecharCarrinho = document.getElementById("btn-fechar-carrinho");
const carrinhoItensEl = document.getElementById("carrinho-itens");
const carrinhoVazioEl = document.getElementById("carrinho-vazio");
const carrinhoTotalValor = document.getElementById("carrinho-total-valor");
const btnFinalizar = document.getElementById("btn-finalizar");
const toast = document.getElementById("toast");

const iconeProduto = `
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M3 7L12 3L21 7V17L12 21L3 17V7Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>
        <path d="M3 7L12 11L21 7" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>
        <path d="M12 11V21" stroke="currentColor" stroke-width="1.6"/>
    </svg>
`;

let toastTimeout = null;

function carregarProdutos() {
    const dados = localStorage.getItem(CHAVE_PRODUTOS);
    return dados ? JSON.parse(dados) : [];
}

function salvarProdutos(produtos) {
    localStorage.setItem(CHAVE_PRODUTOS, JSON.stringify(produtos));
}

function carregarCarrinho() {
    const dados = localStorage.getItem(CHAVE_CARRINHO);
    return dados ? JSON.parse(dados) : [];
}

function salvarCarrinho(carrinho) {
    localStorage.setItem(CHAVE_CARRINHO, JSON.stringify(carrinho));
}

function formatarPreco(valor) {
    return valor.toLocaleString("pt-br", { style: "currency", currency: "BRL" });
}

function formatarData(dataIso) {
    const [ano, mes, dia] = dataIso.split("-");
    return `${dia}/${mes}/${ano}`;
}

function promocaoAtiva(produto) {
    const hoje = new Date().toISOString().split("T")[0];
    return Boolean(produto.promocao > 0 && produto.promocaoValidade && produto.promocaoValidade >= hoje);
}

function precoEfetivo(produto) {
    if (!promocaoAtiva(produto)) return produto.preco;
    return produto.preco * (1 - produto.promocao / 100);
}

function precoHtml(produto) {
    if (!promocaoAtiva(produto)) return formatarPreco(produto.preco);
    return `<span class="preco-riscado">${formatarPreco(produto.preco)}</span> ${formatarPreco(precoEfetivo(produto))} <span class="promocao-tag">-${produto.promocao}%</span>`;
}

function mostrarToast(mensagem) {
    toast.textContent = mensagem;
    toast.classList.add("visivel");
    clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => {
        toast.classList.remove("visivel");
    }, 2600);
}

function quantidadeNoCarrinho(id, carrinho) {
    const item = carrinho.find((item) => item.produtoId === id);
    return item ? item.quantidade : 0;
}

function obterIdProdutoDaUrl() {
    const parametros = new URLSearchParams(window.location.search);
    return parametros.get("id");
}

function renderizarProdutoDetalhe() {
    const produtoId = obterIdProdutoDaUrl();
    const produtos = carregarProdutos();
    const produto = produtos.find((item) => item.id === produtoId);

    if (!produto) {
        produtoDetalhe.hidden = true;
        produtoNaoEncontrado.hidden = false;
        return;
    }

    produtoDetalhe.hidden = false;
    produtoNaoEncontrado.hidden = true;

    const carrinho = carregarCarrinho();
    const jaNoCarrinho = quantidadeNoCarrinho(produto.id, carrinho);
    const disponivel = produto.quantidade - jaNoCarrinho;
    const esgotado = disponivel <= 0;

    let textoEstoque = `Em estoque: ${produto.quantidade}`;
    let classeEstoque = "";
    if (esgotado) {
        textoEstoque = "Esgotado";
        classeEstoque = "esgotado";
    } else if (disponivel <= LIMIAR_ESTOQUE_BAIXO) {
        textoEstoque = `Últimas unidades (${disponivel} disponíveis)`;
        classeEstoque = "baixo";
    } else if (jaNoCarrinho > 0) {
        textoEstoque = `${disponivel} disponíveis (${jaNoCarrinho} no carrinho)`;
    }

    const midia = produto.foto
        ? `<img src="${produto.foto}" class="produto-detalhe-foto" alt="${produto.nome}">`
        : `<div class="produto-detalhe-icone">${iconeProduto}</div>`;

    const descricao = produto.descricao
        ? `<p class="produto-detalhe-descricao">${produto.descricao}</p>`
        : "";

    const validadePromocao = promocaoAtiva(produto)
        ? `<p class="promocao-validade">Promoção válida até ${formatarData(produto.promocaoValidade)}</p>`
        : "";

    produtoDetalhe.innerHTML = `
        ${midia}
        <div class="produto-detalhe-info">
            <span class="produto-marca">${produto.marca || "Marca não informada"}</span>
            <h1 class="produto-detalhe-nome">${produto.nome}</h1>
            <span class="produto-detalhe-tipo">${produto.tipo || "Sem categoria"}</span>
            <p class="produto-detalhe-preco">${precoHtml(produto)}</p>
            ${validadePromocao}
            <p class="produto-estoque ${classeEstoque}">${textoEstoque}</p>
            <div class="produto-acoes">
                <input type="number" class="produto-qtd" id="detalhe-qtd" min="1" max="${Math.max(disponivel, 1)}" value="1" ${esgotado ? "disabled" : ""}>
                <button type="button" class="btn btn-primary btn-finalizar-produto" id="detalhe-btn-finalizar" ${esgotado ? "disabled" : ""}>
                    ${esgotado ? "Esgotado" : "Finalizar compra"}
                </button>
                <button type="button" class="btn-icone-carrinho" id="detalhe-btn-add" aria-label="Adicionar ao carrinho" title="Adicionar ao carrinho" ${esgotado ? "disabled" : ""}>
                    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M3 4H5L6.2 6M6.2 6H20L18 13H7.5M6.2 6L8.2 16H18" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
                        <circle cx="9" cy="20" r="1.3" fill="currentColor"/>
                        <circle cx="17" cy="20" r="1.3" fill="currentColor"/>
                    </svg>
                </button>
            </div>
            ${descricao}
        </div>
    `;
}

function calcularSimilaridade(produtoAtual, produto) {
    let pontuacao = 0;
    if (produto.tipo && produtoAtual.tipo && produto.tipo.toLowerCase() === produtoAtual.tipo.toLowerCase()) {
        pontuacao += 2;
    }
    if (produto.marca && produtoAtual.marca && produto.marca.toLowerCase() === produtoAtual.marca.toLowerCase()) {
        pontuacao += 1;
    }
    return pontuacao;
}

function renderizarRelacionados() {
    const produtoId = obterIdProdutoDaUrl();
    const todosProdutos = carregarProdutos();
    const produtoAtual = todosProdutos.find((produto) => produto.id === produtoId);
    const produtos = todosProdutos.filter((produto) => produto.id !== produtoId);

    if (produtos.length === 0) {
        produtosRelacionados.hidden = true;
        return;
    }

    if (produtoAtual) {
        produtos.sort((a, b) => calcularSimilaridade(produtoAtual, b) - calcularSimilaridade(produtoAtual, a));
    }

    produtosRelacionados.hidden = false;
    gridRelacionados.innerHTML = produtos.map((produto) => {
        const foto = produto.foto
            ? `<img src="${produto.foto}" class="produto-foto" alt="${produto.nome}">`
            : `<div class="produto-icon">${iconeProduto}</div>`;
        return `
            <a class="produto-card" href="produto.html?id=${produto.id}">
                ${foto}
                <span class="produto-marca">${produto.marca || "Marca não informada"}</span>
                <h3 class="produto-nome">${produto.nome}</h3>
                <p class="produto-preco">${precoHtml(produto)}</p>
            </a>
        `;
    }).join("");
}

function renderizarCarrinho() {
    const produtos = carregarProdutos();
    const produtosPorId = new Map(produtos.map((produto) => [produto.id, produto]));
    let carrinho = carregarCarrinho();

    const carrinhoValido = carrinho.filter((item) => produtosPorId.has(item.produtoId));
    if (carrinhoValido.length !== carrinho.length) {
        carrinho = carrinhoValido;
        salvarCarrinho(carrinho);
    }

    const totalItens = carrinho.reduce((soma, item) => soma + item.quantidade, 0);
    carrinhoContador.hidden = totalItens === 0;
    carrinhoContador.textContent = totalItens;

    carrinhoItensEl.innerHTML = "";
    const temItens = carrinho.length > 0;
    carrinhoVazioEl.style.display = temItens ? "none" : "flex";
    btnFinalizar.disabled = !temItens;

    let total = 0;

    carrinho.forEach((item) => {
        const produto = produtosPorId.get(item.produtoId);
        const subtotal = precoEfetivo(produto) * item.quantidade;
        total += subtotal;
        const noLimite = item.quantidade >= produto.quantidade;

        const linha = document.createElement("div");
        linha.className = "carrinho-item";
        linha.innerHTML = `
            <div class="carrinho-item-info">
                <span class="carrinho-item-nome">${produto.nome}</span>
                <span class="carrinho-item-preco">${formatarPreco(precoEfetivo(produto))} un.</span>
            </div>
            <div class="carrinho-item-qtd">
                <button type="button" class="qtd-btn diminuir" data-id="${item.produtoId}">-</button>
                <span>${item.quantidade}</span>
                <button type="button" class="qtd-btn aumentar" data-id="${item.produtoId}" ${noLimite ? "disabled" : ""}>+</button>
            </div>
            <button type="button" class="carrinho-item-remover" data-id="${item.produtoId}" aria-label="Remover">&times;</button>
        `;
        carrinhoItensEl.appendChild(linha);
    });

    carrinhoTotalValor.textContent = formatarPreco(total);
}

function importarSessaoDaUrl() {
    const parametros = new URLSearchParams(window.location.search);
    const sessaoCodificada = parametros.get("sessao");
    if (!sessaoCodificada) return;

    localStorage.setItem(CHAVE_SESSAO, sessaoCodificada);
    parametros.delete("sessao");
    const query = parametros.toString();
    window.history.replaceState({}, "", window.location.pathname + (query ? `?${query}` : ""));
}

function carregarSessao() {
    const dados = localStorage.getItem(CHAVE_SESSAO);
    return dados ? JSON.parse(dados) : null;
}

function carregarUsuarios() {
    const dados = localStorage.getItem(CHAVE_USUARIOS);
    return dados ? JSON.parse(dados) : [];
}

function salvarUsuarios(usuarios) {
    localStorage.setItem(CHAVE_USUARIOS, JSON.stringify(usuarios));
}

function registrarCompraUsuario(usuarioId, totalPedido) {
    const usuarios = carregarUsuarios();
    const usuario = usuarios.find((item) => item.id === usuarioId);
    if (!usuario) return;

    usuario.comprasRealizadas = (usuario.comprasRealizadas || 0) + 1;
    usuario.totalGasto = (usuario.totalGasto || 0) + totalPedido;
    salvarUsuarios(usuarios);
}

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
    btnSair.hidden = !logado;

    const ehAdmin = logado && usuario.papel === "admin";
    const ehVendedor = logado && usuario.papel === "vendedor";
    linkEstoqueMenu.hidden = !(ehAdmin || ehVendedor);
    linkUsuariosMenu.hidden = !ehAdmin;
    linkPromocoesMenu.hidden = !ehAdmin;
    linkCadastrosMenu.hidden = !ehAdmin;

    if (ehAdmin || ehVendedor) {
        const dados = localStorage.getItem(CHAVE_SESSAO);
        const parametro = encodeURIComponent(dados);
        linkEstoqueMenu.href = `../estoque/index.html?sessao=${parametro}`;
    }

    if (ehAdmin) {
        const dados = localStorage.getItem(CHAVE_SESSAO);
        const parametro = encodeURIComponent(dados);
        linkUsuariosMenu.href = `../usuarios/index.html?sessao=${parametro}`;
        linkPromocoesMenu.href = `../promocoes/index.html?sessao=${parametro}`;
        linkCadastrosMenu.href = `../cadastros/index.html?sessao=${parametro}`;
    }
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
    localStorage.removeItem(CHAVE_SESSAO);
    renderizarConta();
    mostrarToast("Você saiu da sua conta.");
});

function abrirCarrinho() {
    carrinhoDrawer.classList.add("aberto");
    overlay.classList.add("aberto");
}

function fecharCarrinho() {
    carrinhoDrawer.classList.remove("aberto");
    overlay.classList.remove("aberto");
}

function adicionarProdutoAtualAoCarrinho() {
    const produtoId = obterIdProdutoDaUrl();
    const produtos = carregarProdutos();
    const produto = produtos.find((item) => item.id === produtoId);
    if (!produto) return null;

    const campoQtd = document.getElementById("detalhe-qtd");
    const quantidadeDesejada = Math.max(1, Number(campoQtd.value) || 1);

    const carrinho = carregarCarrinho();
    const jaNoCarrinho = quantidadeNoCarrinho(produto.id, carrinho);
    const disponivel = produto.quantidade - jaNoCarrinho;
    if (disponivel <= 0) return null;

    const quantidadeAdicionar = Math.min(quantidadeDesejada, disponivel);
    const itemExistente = carrinho.find((item) => item.produtoId === produto.id);
    if (itemExistente) {
        itemExistente.quantidade += quantidadeAdicionar;
    } else {
        carrinho.push({ produtoId: produto.id, quantidade: quantidadeAdicionar });
    }

    salvarCarrinho(carrinho);
    return produto;
}

produtoDetalhe.addEventListener("click", (evento) => {
    if (evento.target.closest("#detalhe-btn-add")) {
        const produto = adicionarProdutoAtualAoCarrinho();
        if (!produto) return;
        renderizarProdutoDetalhe();
        renderizarCarrinho();
        mostrarToast(`${produto.nome} adicionado ao carrinho.`);
        return;
    }

    if (evento.target.closest("#detalhe-btn-finalizar")) {
        const produto = adicionarProdutoAtualAoCarrinho();
        if (!produto) return;
        renderizarProdutoDetalhe();
        renderizarCarrinho();
        finalizarCompra();
    }
});

carrinhoItensEl.addEventListener("click", (evento) => {
    const id = evento.target.dataset.id;
    if (!id) return;

    const carrinho = carregarCarrinho();
    const item = carrinho.find((item) => item.produtoId === id);
    if (!item) return;

    if (evento.target.classList.contains("aumentar")) {
        const produtos = carregarProdutos();
        const produto = produtos.find((produto) => produto.id === id);
        if (produto && item.quantidade < produto.quantidade) {
            item.quantidade += 1;
        }
    } else if (evento.target.classList.contains("diminuir")) {
        item.quantidade -= 1;
        if (item.quantidade <= 0) {
            const indice = carrinho.indexOf(item);
            carrinho.splice(indice, 1);
        }
    } else if (evento.target.classList.contains("carrinho-item-remover")) {
        const indice = carrinho.indexOf(item);
        carrinho.splice(indice, 1);
    } else {
        return;
    }

    salvarCarrinho(carrinho);
    renderizarProdutoDetalhe();
    renderizarCarrinho();
});

btnAbrirCarrinho.addEventListener("click", () => {
    fecharMenuConta();
    abrirCarrinho();
});
btnFecharCarrinho.addEventListener("click", fecharCarrinho);
overlay.addEventListener("click", fecharCarrinho);

function finalizarCompra() {
    const carrinho = carregarCarrinho();
    if (carrinho.length === 0) return;

    const usuario = carregarSessao();
    if (!usuario) {
        mostrarToast("Faça login para finalizar sua compra. Redirecionando...");
        setTimeout(() => {
            window.location.href = "../login/index.html";
        }, 900);
        return;
    }

    const produtos = carregarProdutos();
    let totalPedido = 0;

    carrinho.forEach((item) => {
        const produto = produtos.find((produto) => produto.id === item.produtoId);
        if (!produto) return;
        const quantidadeComprada = Math.min(item.quantidade, produto.quantidade);
        totalPedido += quantidadeComprada * precoEfetivo(produto);
        produto.quantidade -= quantidadeComprada;
    });

    salvarProdutos(produtos);
    registrarCompraUsuario(usuario.id, totalPedido);
    salvarCarrinho([]);
    renderizarProdutoDetalhe();
    renderizarCarrinho();
    fecharCarrinho();
    mostrarToast("Pedido realizado com sucesso!");
}

btnFinalizar.addEventListener("click", finalizarCompra);

importarSessaoDaUrl();
renderizarProdutoDetalhe();
renderizarRelacionados();
renderizarCarrinho();
renderizarConta();
