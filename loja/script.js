const CHAVE_TOKEN = "wgstore_token";
const CHAVE_CARRINHO = "loja-carrinho";
const LIMIAR_ESTOQUE_BAIXO = 5;

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

const contaLogada = document.getElementById("conta-logada");
const contaNome = document.getElementById("conta-nome");
const btnSair = document.getElementById("btn-sair");
const btnContaMenu = document.getElementById("btn-conta-menu");
const contaMenu = document.getElementById("conta-menu");
const btnAbrirCarrinho = document.getElementById("btn-abrir-carrinho");
const linkEntrarMenu = document.getElementById("link-entrar-menu");
const linkMinhaContaMenu = document.getElementById("link-minha-conta-menu");
const linkEstoqueMenu = document.getElementById("link-estoque-menu");
const linkUsuariosMenu = document.getElementById("link-usuarios-menu");
const linkDescontosMenu = document.getElementById("link-descontos-menu");
const linkPromocoesMenu = document.getElementById("link-promocoes-menu");
const linkCadastrosMenu = document.getElementById("link-cadastros-menu");
const linkSuporteMenu = document.getElementById("link-suporte-menu");

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

function inicializarCarrossel(produtos) {
    const produtosNoCarrossel = produtos.filter((produto) => produto.noCarrossel && produto.foto);

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

const gridProdutos = document.getElementById("grid-produtos");
const vazioLoja = document.getElementById("vazio-loja");
const vazioLojaTexto = document.getElementById("vazio-loja-texto");
const buscaProduto = document.getElementById("busca-produto");

const campoPrecoMin = document.getElementById("filtro-preco-min");
const campoPrecoMax = document.getElementById("filtro-preco-max");
const filtroTiposEl = document.getElementById("filtro-tipos");
const filtroMarcasEl = document.getElementById("filtro-marcas");
const filtroEmEstoque = document.getElementById("filtro-em-estoque");
const filtroPromocaoEl = document.getElementById("filtro-promocao");
const btnLimparFiltros = document.getElementById("btn-limpar-filtros");

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
const tiposSelecionados = new Set();
const marcasSelecionadas = new Set();

function carregarProdutos() {
    return apiFetch("/api/produtos");
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

function renderizarFiltrosLaterais(produtos) {
    const tiposUnicos = [...new Set(produtos.map((produto) => produto.tipo).filter(Boolean))]
        .sort((a, b) => a.localeCompare(b, "pt-br"));
    const marcasUnicas = [...new Set(produtos.map((produto) => produto.marca).filter(Boolean))]
        .sort((a, b) => a.localeCompare(b, "pt-br"));

    [...tiposSelecionados].forEach((tipo) => {
        if (!tiposUnicos.includes(tipo)) tiposSelecionados.delete(tipo);
    });
    [...marcasSelecionadas].forEach((marca) => {
        if (!marcasUnicas.includes(marca)) marcasSelecionadas.delete(marca);
    });

    filtroTiposEl.innerHTML = tiposUnicos.length
        ? tiposUnicos.map((tipo) => `
            <label class="filtro-checkbox">
                <input type="checkbox" class="filtro-tipo-check" value="${tipo}" ${tiposSelecionados.has(tipo) ? "checked" : ""}>
                ${tipo}
            </label>
        `).join("")
        : `<p class="filtro-vazio">Nenhuma categoria ainda.</p>`;

    filtroMarcasEl.innerHTML = marcasUnicas.length
        ? marcasUnicas.map((marca) => `
            <label class="filtro-checkbox">
                <input type="checkbox" class="filtro-marca-check" value="${marca}" ${marcasSelecionadas.has(marca) ? "checked" : ""}>
                ${marca}
            </label>
        `).join("")
        : `<p class="filtro-vazio">Nenhuma marca ainda.</p>`;
}

async function renderizarProdutos() {
    const produtos = await carregarProdutos();
    const carrinho = carregarCarrinho();

    renderizarFiltrosLaterais(produtos);

    const termo = termoBusca.trim().toLowerCase();
    const precoMin = campoPrecoMin.value !== "" ? Number(campoPrecoMin.value) : null;
    const precoMax = campoPrecoMax.value !== "" ? Number(campoPrecoMax.value) : null;

    const produtosFiltrados = produtos.filter((produto) => {
        if (termo) {
            const combina = produto.nome.toLowerCase().includes(termo) ||
                (produto.tipo || "").toLowerCase().includes(termo) ||
                (produto.marca || "").toLowerCase().includes(termo);
            if (!combina) return false;
        }

        const precoConsiderado = precoEfetivo(produto);
        if (precoMin !== null && precoConsiderado < precoMin) return false;
        if (precoMax !== null && precoConsiderado > precoMax) return false;

        if (tiposSelecionados.size > 0 && !tiposSelecionados.has(produto.tipo)) return false;
        if (marcasSelecionadas.size > 0 && !marcasSelecionadas.has(produto.marca)) return false;

        if (filtroEmEstoque.checked) {
            const jaNoCarrinho = quantidadeNoCarrinho(produto.id, carrinho);
            if (produto.quantidade - jaNoCarrinho <= 0) return false;
        }

        if (filtroPromocaoEl.checked && !promocaoAtiva(produto)) return false;

        return true;
    });

    gridProdutos.innerHTML = "";

    if (produtosFiltrados.length === 0) {
        vazioLoja.hidden = false;
        if (produtos.length === 0) {
            vazioLojaTexto.innerHTML = `Nenhum produto disponível no momento. Cadastre produtos na <a href="../estoque/index.html">área do estoque</a>.`;
        } else {
            vazioLojaTexto.textContent = "Nenhum produto encontrado com esses filtros.";
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

    inicializarCarrossel(produtos);
}

async function renderizarCarrinho() {
    const produtos = await carregarProdutos();
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

campoPrecoMin.addEventListener("input", renderizarProdutos);
campoPrecoMax.addEventListener("input", renderizarProdutos);
filtroEmEstoque.addEventListener("change", renderizarProdutos);
filtroPromocaoEl.addEventListener("change", renderizarProdutos);

filtroTiposEl.addEventListener("change", (evento) => {
    if (!evento.target.classList.contains("filtro-tipo-check")) return;
    if (evento.target.checked) {
        tiposSelecionados.add(evento.target.value);
    } else {
        tiposSelecionados.delete(evento.target.value);
    }
    renderizarProdutos();
});

filtroMarcasEl.addEventListener("change", (evento) => {
    if (!evento.target.classList.contains("filtro-marca-check")) return;
    if (evento.target.checked) {
        marcasSelecionadas.add(evento.target.value);
    } else {
        marcasSelecionadas.delete(evento.target.value);
    }
    renderizarProdutos();
});

btnLimparFiltros.addEventListener("click", () => {
    campoPrecoMin.value = "";
    campoPrecoMax.value = "";
    tiposSelecionados.clear();
    marcasSelecionadas.clear();
    filtroEmEstoque.checked = false;
    filtroPromocaoEl.checked = false;
    termoBusca = "";
    buscaProduto.value = "";
    renderizarProdutos();
});

carrinhoItensEl.addEventListener("click", async (evento) => {
    const id = evento.target.dataset.id;
    if (!id) return;
    const idProduto = Number(id);

    const carrinho = carregarCarrinho();
    const item = carrinho.find((item) => item.produtoId === idProduto);
    if (!item) return;

    if (evento.target.classList.contains("aumentar")) {
        const produtos = await carregarProdutos();
        const produto = produtos.find((produto) => produto.id === idProduto);
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

    window.location.href = "endereco.html";
});

renderizarProdutos();
renderizarCarrinho();
renderizarConta();
