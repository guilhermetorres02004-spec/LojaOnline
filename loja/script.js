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

const carrosselSecao = document.querySelector(".carrossel");
const carrosselTrilho = document.getElementById("carrossel-trilho");
const carrosselIndicadores = document.getElementById("carrossel-indicadores");
const btnCarrosselAnterior = document.getElementById("carrossel-anterior");
const btnCarrosselProxima = document.getElementById("carrossel-proxima");

const INTERVALO_AUTOPLAY_CARROSSEL = 7000;

let indiceCarrossel = 0;
let autoplayCarrossel = null;
let totalSlidesCarrossel = 0;

function iniciarAutoplayCarrossel() {
    clearInterval(autoplayCarrossel);
    if (totalSlidesCarrossel <= 1) return;
    autoplayCarrossel = setInterval(() => {
        irParaImagemCarrossel(indiceCarrossel + 1);
    }, INTERVALO_AUTOPLAY_CARROSSEL);
}

function atualizarCarrossel() {
    carrosselTrilho.style.transform = `translateX(-${indiceCarrossel * 100}%)`;
    [...carrosselIndicadores.children].forEach((ponto, indice) => {
        ponto.classList.toggle("ativo", indice === indiceCarrossel);
    });
}

function irParaImagemCarrossel(indice) {
    if (totalSlidesCarrossel === 0) return;
    indiceCarrossel = (indice + totalSlidesCarrossel) % totalSlidesCarrossel;
    atualizarCarrossel();
}

function inicializarCarrossel() {
    const produtosNoCarrossel = carregarProdutos().filter((produto) => produto.noCarrossel && produto.foto);

    totalSlidesCarrossel = produtosNoCarrossel.length;
    carrosselSecao.hidden = totalSlidesCarrossel === 0;
    if (totalSlidesCarrossel === 0) return;

    carrosselTrilho.innerHTML = produtosNoCarrossel.map((produto) => {
        const selo = promocaoAtiva(produto) ? `<span class="carrossel-promo">Promo ${produto.promocao}% off</span>` : "";
        return `
            <a class="carrossel-slide" href="produto.html?id=${produto.id}">
                ${selo}
                <img src="${produto.foto}" alt="${produto.nome}">
            </a>
        `;
    }).join("");

    carrosselIndicadores.innerHTML = produtosNoCarrossel.map((_, indice) =>
        `<button type="button" class="carrossel-ponto" data-indice="${indice}" aria-label="Ir para imagem ${indice + 1}"></button>`
    ).join("");

    indiceCarrossel = 0;
    atualizarCarrossel();
    iniciarAutoplayCarrossel();
}

btnCarrosselAnterior.addEventListener("click", () => {
    irParaImagemCarrossel(indiceCarrossel - 1);
    iniciarAutoplayCarrossel();
});

btnCarrosselProxima.addEventListener("click", () => {
    irParaImagemCarrossel(indiceCarrossel + 1);
    iniciarAutoplayCarrossel();
});

carrosselIndicadores.addEventListener("click", (evento) => {
    const botao = evento.target.closest(".carrossel-ponto");
    if (!botao) return;
    irParaImagemCarrossel(Number(botao.dataset.indice));
    iniciarAutoplayCarrossel();
});

inicializarCarrossel();

const gridProdutos = document.getElementById("grid-produtos");
const vazioLoja = document.getElementById("vazio-loja");
const vazioLojaTexto = document.getElementById("vazio-loja-texto");
const buscaProduto = document.getElementById("busca-produto");

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

let termoBusca = "";
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

function renderizarProdutos() {
    const produtos = carregarProdutos();
    const carrinho = carregarCarrinho();

    const termo = termoBusca.trim().toLowerCase();
    const produtosFiltrados = termo
        ? produtos.filter((produto) =>
              produto.nome.toLowerCase().includes(termo) ||
              (produto.tipo || "").toLowerCase().includes(termo) ||
              (produto.marca || "").toLowerCase().includes(termo)
          )
        : produtos;

    gridProdutos.innerHTML = "";

    if (produtosFiltrados.length === 0) {
        vazioLoja.hidden = false;
        if (produtos.length === 0) {
            vazioLojaTexto.innerHTML = `Nenhum produto disponível no momento. Cadastre produtos na <a href="../estoque/index.html">área do estoque</a>.`;
        } else {
            vazioLojaTexto.textContent = "Nenhum produto encontrado para essa busca.";
        }
        return;
    }

    vazioLoja.hidden = true;

    produtosFiltrados.forEach((produto) => {
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

        const card = document.createElement("a");
        card.href = `produto.html?id=${produto.id}`;
        card.className = `produto-card${esgotado ? " esgotado" : ""}`;
        const foto = produto.foto
            ? `<img src="${produto.foto}" class="produto-foto" alt="${produto.nome}">`
            : `<div class="produto-icon">${iconeProduto}</div>`;
        card.innerHTML = `
            ${foto}
            <span class="produto-marca">${produto.marca || "Marca não informada"}</span>
            <h3 class="produto-nome">${produto.nome}</h3>
            <p class="produto-preco">${precoHtml(produto)}</p>
            <p class="produto-estoque ${classeEstoque}">${textoEstoque}</p>
        `;
        gridProdutos.appendChild(card);
    });
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

buscaProduto.addEventListener("input", () => {
    termoBusca = buscaProduto.value;
    renderizarProdutos();
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
    renderizarProdutos();
    renderizarCarrinho();
});

btnAbrirCarrinho.addEventListener("click", () => {
    fecharMenuConta();
    abrirCarrinho();
});
btnFecharCarrinho.addEventListener("click", fecharCarrinho);
overlay.addEventListener("click", fecharCarrinho);

btnFinalizar.addEventListener("click", () => {
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
    renderizarProdutos();
    renderizarCarrinho();
    fecharCarrinho();
    mostrarToast("Pedido realizado com sucesso!");
});

importarSessaoDaUrl();
renderizarProdutos();
renderizarCarrinho();
renderizarConta();
