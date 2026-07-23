const CHAVE_TOKEN = "wgstore_token";
const DESCONTO_MAXIMO = 90;

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
const autorizado = Boolean(sessaoUsuario && sessaoUsuario.papel === "admin");
document.getElementById("app-descontos").hidden = !autorizado;
document.getElementById("acesso-negado").hidden = autorizado;

const statCompradores = document.getElementById("stat-compradores");
const statReceita = document.getElementById("stat-receita");
const statTicket = document.getElementById("stat-ticket");
const buscaComprador = document.getElementById("busca-comprador");
const ordenarCompradores = document.getElementById("ordenar-compradores");
const contadorCompradores = document.getElementById("contador-compradores");
const listaCompradores = document.getElementById("lista-compradores");
const vazioCompradores = document.getElementById("vazio-compradores");
const vazioCompradoresTexto = document.getElementById("vazio-compradores-texto");
const checkboxSelecionarTodos = document.getElementById("checkbox-selecionar-todos");

const campoIntervaloDe = document.getElementById("intervalo-de");
const campoIntervaloAte = document.getElementById("intervalo-ate");
const intervaloPreview = document.getElementById("intervalo-preview");
const contadorSelecionados = document.getElementById("contador-selecionados");
const btnLimparSelecao = document.getElementById("btn-limpar-selecao");

const formDesconto = document.getElementById("form-desconto");
const campoDescontoPercentual = document.getElementById("desconto-percentual");
const campoDescontoValidade = document.getElementById("desconto-validade");
const mensagemDesconto = document.getElementById("mensagem-desconto");

const toast = document.getElementById("toast");

const overlayHistorico = document.getElementById("overlay-historico");
const historicoNome = document.getElementById("historico-nome");
const historicoEmail = document.getElementById("historico-email");
const historicoTotalPedidos = document.getElementById("historico-total-pedidos");
const historicoTotalGasto = document.getElementById("historico-total-gasto");
const historicoCorpo = document.getElementById("historico-corpo");
const btnFecharHistorico = document.getElementById("btn-fechar-historico");

let termoBusca = "";
let ordenacaoAtual = "gasto";
let compradoresCache = [];
let ordenadosCache = [];
let rankingPorGasto = [];
let rankPorId = new Map();
const selecionados = new Set();
let toastTimeout = null;

function carregarUsuarios() {
    return apiFetch("/api/usuarios");
}

function carregarPedidosUsuario(id) {
    return apiFetch(`/api/usuarios/${id}/pedidos`);
}

function formatarPreco(valor) {
    return valor.toLocaleString("pt-br", { style: "currency", currency: "BRL" });
}

function formatarData(iso) {
    return new Date(iso).toLocaleDateString("pt-br");
}

function hojeIso() {
    return new Date().toISOString().split("T")[0];
}

function descontoAtivo(usuario) {
    return Boolean(usuario.descontoPercentual > 0 && usuario.descontoValidade && usuario.descontoValidade >= hojeIso());
}

function mostrarToast(mensagem) {
    toast.textContent = mensagem;
    toast.classList.add("visivel");
    clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => {
        toast.classList.remove("visivel");
    }, 2600);
}

function mostrarMensagemDesconto(texto, tipo) {
    mensagemDesconto.textContent = texto;
    mensagemDesconto.className = `mensagem ${tipo}`;
    mensagemDesconto.hidden = false;
}

function ordenarLista(compradores) {
    const copia = [...compradores];
    if (ordenacaoAtual === "gasto") {
        copia.sort((a, b) => (b.totalGasto || 0) - (a.totalGasto || 0));
    } else if (ordenacaoAtual === "compras") {
        copia.sort((a, b) => (b.comprasRealizadas || 0) - (a.comprasRealizadas || 0));
    } else {
        copia.sort((a, b) => a.nome.localeCompare(b.nome, "pt-br"));
    }
    return copia;
}

function idsDaFaixa() {
    const de = Number(campoIntervaloDe.value);
    const ate = Number(campoIntervaloAte.value);
    if (!de || !ate || de < 1 || ate < de) return null;
    return rankingPorGasto.slice(de - 1, ate).map((usuario) => usuario.id);
}

function atualizarPreviewIntervalo() {
    const ids = idsDaFaixa();
    if (!campoIntervaloDe.value && !campoIntervaloAte.value) {
        intervaloPreview.textContent = "Preencha a faixa para ver quantos clientes serão afetados.";
    } else if (ids === null) {
        intervaloPreview.textContent = "Informe uma faixa válida (ex: de 1 até 200).";
    } else {
        intervaloPreview.textContent = `Isso vai aplicar o desconto a ${ids.length} cliente(s).`;
    }
}

function atualizarContadorSelecionados() {
    contadorSelecionados.textContent = `${selecionados.size} ${selecionados.size === 1 ? "selecionado" : "selecionados"}`;
    checkboxSelecionarTodos.checked = ordenadosCache.length > 0 && ordenadosCache.every((usuario) => selecionados.has(usuario.id));
}

async function renderizarCompradores() {
    const usuarios = await carregarUsuarios();
    compradoresCache = usuarios.filter((usuario) => (usuario.comprasRealizadas || 0) > 0);

    rankingPorGasto = [...compradoresCache].sort((a, b) => (b.totalGasto || 0) - (a.totalGasto || 0));
    rankPorId = new Map(rankingPorGasto.map((usuario, indice) => [usuario.id, indice + 1]));

    statCompradores.textContent = compradoresCache.length;
    const receitaTotal = compradoresCache.reduce((soma, usuario) => soma + (usuario.totalGasto || 0), 0);
    statReceita.textContent = formatarPreco(receitaTotal);
    const totalPedidos = compradoresCache.reduce((soma, usuario) => soma + (usuario.comprasRealizadas || 0), 0);
    statTicket.textContent = formatarPreco(totalPedidos > 0 ? receitaTotal / totalPedidos : 0);

    const termo = termoBusca.trim().toLowerCase();
    const filtrados = termo
        ? compradoresCache.filter((usuario) =>
              usuario.nome.toLowerCase().includes(termo) || usuario.email.toLowerCase().includes(termo)
          )
        : compradoresCache;

    ordenadosCache = ordenarLista(filtrados);

    contadorCompradores.textContent = `${ordenadosCache.length} ${ordenadosCache.length === 1 ? "cliente" : "clientes"}`;
    listaCompradores.innerHTML = "";

    if (ordenadosCache.length === 0) {
        vazioCompradores.hidden = false;
        vazioCompradoresTexto.textContent = compradoresCache.length === 0
            ? "Nenhum cliente com compras ainda."
            : "Nenhum cliente encontrado para essa busca.";
        atualizarContadorSelecionados();
        return;
    }

    vazioCompradores.hidden = true;

    ordenadosCache.forEach((usuario) => {
        const ativo = descontoAtivo(usuario);
        const linha = document.createElement("tr");
        linha.innerHTML = `
            <td class="col-checkbox"><input type="checkbox" class="checkbox-comprador" data-id="${usuario.id}" ${selecionados.has(usuario.id) ? "checked" : ""}></td>
            <td class="rank-usuario">#${rankPorId.get(usuario.id)}</td>
            <td class="nome-usuario">${usuario.nome}</td>
            <td>${usuario.email}</td>
            <td class="compras-destaque">${usuario.comprasRealizadas || 0}</td>
            <td>${formatarPreco(usuario.totalGasto || 0)}</td>
            <td>${ativo ? `<span class="desconto-tabela-badge">${usuario.descontoPercentual}% até ${formatarData(usuario.descontoValidade)}</span>` : "—"}</td>
            <td class="acoes-linha">
                <button type="button" class="acao-btn ver-historico" data-id="${usuario.id}">Ver histórico</button>
                ${ativo ? `<button type="button" class="acao-btn remover-desconto" data-id="${usuario.id}" data-nome="${usuario.nome}">Remover desconto</button>` : ""}
            </td>
        `;
        listaCompradores.appendChild(linha);
    });

    atualizarContadorSelecionados();
}

function renderizarPedidoCard(pedido) {
    const itensHtml = pedido.itens.map((item) => `
        <div class="pedido-item-linha">
            <span>${item.nome} <span class="pedido-item-qtd">x${item.quantidade}</span></span>
            <span>${formatarPreco(item.precoUnitario * item.quantidade)}</span>
        </div>
    `).join("");

    return `
        <article class="pedido-card">
            <div class="pedido-cabecalho">
                <div>
                    <span class="pedido-numero">Pedido #${pedido.id}</span>
                    <span class="pedido-data">${formatarData(pedido.criadoEm)}</span>
                </div>
                <span class="pedido-total">${formatarPreco(pedido.total)}</span>
            </div>
            <div class="pedido-itens">${itensHtml}</div>
        </article>
    `;
}

async function abrirHistorico(usuario) {
    historicoNome.textContent = usuario.nome;
    historicoEmail.textContent = usuario.email;
    historicoTotalPedidos.textContent = usuario.comprasRealizadas || 0;
    historicoTotalGasto.textContent = formatarPreco(usuario.totalGasto || 0);
    historicoCorpo.innerHTML = "";
    overlayHistorico.hidden = false;

    try {
        const pedidos = await carregarPedidosUsuario(usuario.id);
        if (pedidos.length === 0) {
            historicoCorpo.innerHTML = `<p class="modal-vazio">Nenhum pedido encontrado para este cliente.</p>`;
            return;
        }
        historicoCorpo.innerHTML = pedidos.map(renderizarPedidoCard).join("");
    } catch (erro) {
        historicoCorpo.innerHTML = `<p class="modal-vazio">${erro.message}</p>`;
    }
}

function fecharHistorico() {
    overlayHistorico.hidden = true;
    historicoCorpo.innerHTML = "";
}

if (autorizado) {
    buscaComprador.addEventListener("input", () => {
        termoBusca = buscaComprador.value;
        renderizarCompradores();
    });

    ordenarCompradores.addEventListener("change", () => {
        ordenacaoAtual = ordenarCompradores.value;
        renderizarCompradores();
    });

    checkboxSelecionarTodos.addEventListener("change", () => {
        if (checkboxSelecionarTodos.checked) {
            ordenadosCache.forEach((usuario) => selecionados.add(usuario.id));
        } else {
            ordenadosCache.forEach((usuario) => selecionados.delete(usuario.id));
        }
        renderizarCompradores();
    });

    [campoIntervaloDe, campoIntervaloAte].forEach((campo) => {
        campo.addEventListener("input", atualizarPreviewIntervalo);
    });

    btnLimparSelecao.addEventListener("click", () => {
        selecionados.clear();
        campoIntervaloDe.value = "";
        campoIntervaloAte.value = "";
        atualizarPreviewIntervalo();
        renderizarCompradores();
    });

    listaCompradores.addEventListener("change", (evento) => {
        const checkbox = evento.target.closest(".checkbox-comprador");
        if (!checkbox) return;

        const id = Number(checkbox.dataset.id);
        if (checkbox.checked) {
            selecionados.add(id);
        } else {
            selecionados.delete(id);
        }
        atualizarContadorSelecionados();
    });

    listaCompradores.addEventListener("click", async (evento) => {
        const botaoHistorico = evento.target.closest(".ver-historico");
        if (botaoHistorico) {
            const usuario = compradoresCache.find((item) => item.id === Number(botaoHistorico.dataset.id));
            if (usuario) abrirHistorico(usuario);
            return;
        }

        const botaoRemover = evento.target.closest(".remover-desconto");
        if (botaoRemover) {
            const id = botaoRemover.dataset.id;
            const nome = botaoRemover.dataset.nome;
            await apiFetch(`/api/usuarios/${id}/desconto`, { method: "DELETE" });
            await renderizarCompradores();
            mostrarToast(`Desconto de ${nome} removido.`);
        }
    });

    btnFecharHistorico.addEventListener("click", fecharHistorico);
    overlayHistorico.addEventListener("click", (evento) => {
        if (evento.target === overlayHistorico) fecharHistorico();
    });
    document.addEventListener("keydown", (evento) => {
        if (evento.key === "Escape" && !overlayHistorico.hidden) fecharHistorico();
    });

    formDesconto.addEventListener("submit", async (evento) => {
        evento.preventDefault();
        mensagemDesconto.hidden = true;

        const idsFaixa = idsDaFaixa();
        const usandoFaixa = idsFaixa !== null;
        const idsAlvo = usandoFaixa ? idsFaixa : [...selecionados];

        if (idsAlvo.length === 0) {
            mostrarMensagemDesconto("Informe uma faixa do ranking (de-até) ou marque clientes na tabela.", "erro");
            return;
        }

        const percentual = Number(campoDescontoPercentual.value);
        const validade = campoDescontoValidade.value;

        if (!percentual || percentual < 1 || percentual > DESCONTO_MAXIMO) {
            mostrarMensagemDesconto(`Informe um desconto entre 1% e ${DESCONTO_MAXIMO}%.`, "erro");
            return;
        }

        if (!validade) {
            mostrarMensagemDesconto("Escolha a data em que o desconto termina.", "erro");
            return;
        }

        if (validade < hojeIso()) {
            mostrarMensagemDesconto("A data de término não pode ser no passado.", "erro");
            return;
        }

        try {
            await apiFetch("/api/usuarios/descontos", {
                method: "PUT",
                body: JSON.stringify({ ids: idsAlvo, percentual, validade }),
            });
            mostrarMensagemDesconto(`Desconto aplicado a ${idsAlvo.length} cliente(s)!`, "sucesso");
            selecionados.clear();
            campoIntervaloDe.value = "";
            campoIntervaloAte.value = "";
            atualizarPreviewIntervalo();
            await renderizarCompradores();
        } catch (erro) {
            mostrarMensagemDesconto(erro.message, "erro");
        }
    });

    campoDescontoValidade.min = hojeIso();
    renderizarCompradores();
}
