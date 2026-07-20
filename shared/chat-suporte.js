(function () {
    const CHAVE_TOKEN = "wgstore_token";
    const INTERVALO_FECHADO = 10000;
    const INTERVALO_ABERTO = 4000;

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

    const iconeChat = `
        <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M4 12C4 7.58 7.8 4 12.5 4S21 7.58 21 12s-3.8 8-8.5 8c-1.02 0-2-.17-2.9-.49L5 21l1.3-3.9C4.86 15.77 4 13.98 4 12Z" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/>
        </svg>
    `;
    const iconeEnviar = `
        <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M4 20L21 12L4 4L4 10.5L15 12L4 13.5L4 20Z" fill="currentColor"/>
        </svg>
    `;

    const raiz = document.createElement("div");
    raiz.className = "chat-suporte";
    raiz.innerHTML = `
        <button type="button" class="chat-suporte-bolha" id="chat-suporte-bolha" aria-label="Abrir chat de suporte">
            ${iconeChat}
            <span class="chat-suporte-badge" id="chat-suporte-badge" hidden></span>
        </button>
        <div class="chat-suporte-painel" id="chat-suporte-painel" hidden>
            <div class="chat-suporte-cabecalho">
                <span id="chat-suporte-titulo">Fale com o suporte</span>
                <button type="button" class="chat-suporte-fechar" id="chat-suporte-fechar" aria-label="Fechar">&times;</button>
            </div>
            <div class="chat-suporte-login" id="chat-suporte-login" hidden>
                <p>Faça login para conversar com o nosso suporte.</p>
                <a href="../login/index.html" class="chat-suporte-btn-login">Entrar</a>
            </div>
            <div class="chat-suporte-corpo" id="chat-suporte-corpo" hidden>
                <div class="chat-suporte-mensagens" id="chat-suporte-mensagens"></div>
                <form class="chat-suporte-form" id="chat-suporte-form">
                    <input type="text" id="chat-suporte-input" placeholder="Escreva sua mensagem..." autocomplete="off" maxlength="1000">
                    <button type="submit" aria-label="Enviar">${iconeEnviar}</button>
                </form>
            </div>
            <div class="chat-suporte-admin-lista" id="chat-suporte-admin-lista" hidden>
                <div class="chat-suporte-admin-itens" id="chat-suporte-admin-itens"></div>
                <p class="chat-suporte-vazio" id="chat-suporte-admin-vazio" hidden>Nenhuma conversa ainda.</p>
            </div>
            <div class="chat-suporte-admin-thread" id="chat-suporte-admin-thread" hidden>
                <button type="button" class="chat-suporte-voltar" id="chat-suporte-voltar">&larr; Conversas</button>
                <div class="chat-suporte-mensagens" id="chat-suporte-admin-mensagens"></div>
                <form class="chat-suporte-form" id="chat-suporte-admin-form">
                    <input type="text" id="chat-suporte-admin-input" placeholder="Escreva uma resposta..." autocomplete="off" maxlength="1000">
                    <button type="submit" aria-label="Enviar">${iconeEnviar}</button>
                </form>
            </div>
        </div>
    `;
    document.body.appendChild(raiz);

    const bolha = document.getElementById("chat-suporte-bolha");
    const painel = document.getElementById("chat-suporte-painel");
    const fechar = document.getElementById("chat-suporte-fechar");
    const badge = document.getElementById("chat-suporte-badge");
    const titulo = document.getElementById("chat-suporte-titulo");
    const areaLogin = document.getElementById("chat-suporte-login");
    const areaCorpo = document.getElementById("chat-suporte-corpo");
    const listaMensagens = document.getElementById("chat-suporte-mensagens");
    const form = document.getElementById("chat-suporte-form");
    const input = document.getElementById("chat-suporte-input");

    const areaAdminLista = document.getElementById("chat-suporte-admin-lista");
    const itensAdmin = document.getElementById("chat-suporte-admin-itens");
    const vazioAdmin = document.getElementById("chat-suporte-admin-vazio");
    const areaAdminThread = document.getElementById("chat-suporte-admin-thread");
    const btnVoltar = document.getElementById("chat-suporte-voltar");
    const mensagensAdmin = document.getElementById("chat-suporte-admin-mensagens");
    const formAdmin = document.getElementById("chat-suporte-admin-form");
    const inputAdmin = document.getElementById("chat-suporte-admin-input");

    const ehAdmin = Boolean(carregarSessao() && carregarSessao().papel === "admin");

    let aberto = false;
    let intervaloId = null;
    let conversaAdminId = null;

    function renderizarBolhas(container, mensagens, vazioTexto) {
        if (mensagens.length === 0) {
            container.innerHTML = `<p class="chat-suporte-vazio">${vazioTexto}</p>`;
            return;
        }

        const estavaNoFim = container.scrollTop + container.clientHeight >= container.scrollHeight - 20;

        container.innerHTML = mensagens.map((mensagem) => `
            <div class="chat-suporte-msg ${mensagem.deAdmin === ehAdmin ? "eu" : "outro"}">
                ${mensagem.texto.replace(/</g, "&lt;")}
            </div>
        `).join("");

        if (estavaNoFim || mensagens.length <= 1) {
            container.scrollTop = container.scrollHeight;
        }
    }

    function pararPolling() {
        clearInterval(intervaloId);
        intervaloId = null;
    }

    function iniciarPolling(intervalo, funcao) {
        pararPolling();
        intervaloId = setInterval(funcao, intervalo);
    }

    // --- Cliente ---

    async function atualizarBadgeCliente() {
        try {
            const dados = await apiFetch("/api/suporte/conversa/nao-lidas");
            if (dados.naoLidas > 0) {
                badge.textContent = dados.naoLidas > 9 ? "9+" : String(dados.naoLidas);
                badge.hidden = false;
            } else {
                badge.hidden = true;
            }
        } catch (erro) {
            /* silencioso: nao interrompe a navegacao por causa do widget */
        }
    }

    async function carregarConversaCliente() {
        try {
            const dados = await apiFetch("/api/suporte/conversa");
            renderizarBolhas(listaMensagens, dados.mensagens, "Envie uma mensagem e nossa equipe vai te responder por aqui.");
            badge.hidden = true;
        } catch (erro) {
            /* silencioso */
        }
    }

    form.addEventListener("submit", async (evento) => {
        evento.preventDefault();
        const texto = input.value.trim();
        if (!texto) return;

        input.value = "";
        try {
            await apiFetch("/api/suporte/conversa/mensagens", {
                method: "POST",
                body: JSON.stringify({ texto }),
            });
            await carregarConversaCliente();
        } catch (erro) {
            input.value = texto;
        }
    });

    // --- Admin ---

    async function atualizarBadgeAdmin() {
        try {
            const conversas = await apiFetch("/api/suporte/conversas");
            const total = conversas.reduce((soma, c) => soma + c.naoLidas, 0);
            if (total > 0) {
                badge.textContent = total > 9 ? "9+" : String(total);
                badge.hidden = false;
            } else {
                badge.hidden = true;
            }
            return conversas;
        } catch (erro) {
            return [];
        }
    }

    async function carregarListaAdmin() {
        const conversas = await atualizarBadgeAdmin();
        vazioAdmin.hidden = conversas.length > 0;
        itensAdmin.innerHTML = conversas.map((c) => `
            <button type="button" class="chat-suporte-admin-item" data-id="${c.id}">
                <span class="chat-suporte-admin-item-topo">
                    <span class="chat-suporte-admin-item-nome">${c.nome}</span>
                    ${c.naoLidas > 0 ? `<span class="chat-suporte-item-badge">${c.naoLidas > 9 ? "9+" : c.naoLidas}</span>` : ""}
                </span>
                <span class="chat-suporte-admin-item-preview">${c.ultimaMensagem || "Sem mensagens ainda"}</span>
            </button>
        `).join("");
    }

    function mostrarListaAdmin() {
        conversaAdminId = null;
        titulo.textContent = "Conversas";
        areaAdminThread.hidden = true;
        areaAdminLista.hidden = false;
        carregarListaAdmin();
        iniciarPolling(INTERVALO_ABERTO, carregarListaAdmin);
    }

    async function abrirConversaAdmin(id, nome) {
        conversaAdminId = id;
        titulo.textContent = nome;
        areaAdminLista.hidden = true;
        areaAdminThread.hidden = false;

        const dados = await apiFetch(`/api/suporte/conversas/${id}`);
        renderizarBolhas(mensagensAdmin, dados.mensagens, "Nenhuma mensagem ainda.");

        iniciarPolling(INTERVALO_ABERTO, async () => {
            const atualizacao = await apiFetch(`/api/suporte/conversas/${id}`);
            renderizarBolhas(mensagensAdmin, atualizacao.mensagens, "Nenhuma mensagem ainda.");
        });
    }

    itensAdmin.addEventListener("click", (evento) => {
        const item = evento.target.closest(".chat-suporte-admin-item");
        if (!item) return;
        const nome = item.querySelector(".chat-suporte-admin-item-nome").textContent;
        abrirConversaAdmin(Number(item.dataset.id), nome);
    });

    btnVoltar.addEventListener("click", mostrarListaAdmin);

    formAdmin.addEventListener("submit", async (evento) => {
        evento.preventDefault();
        const texto = inputAdmin.value.trim();
        if (!texto || !conversaAdminId) return;

        inputAdmin.value = "";
        await apiFetch(`/api/suporte/conversas/${conversaAdminId}/mensagens`, {
            method: "POST",
            body: JSON.stringify({ texto }),
        });
        const atualizacao = await apiFetch(`/api/suporte/conversas/${conversaAdminId}`);
        renderizarBolhas(mensagensAdmin, atualizacao.mensagens, "Nenhuma mensagem ainda.");
    });

    // --- Controle geral do painel ---

    function abrirPainel() {
        aberto = true;
        painel.hidden = false;

        const sessaoAtual = carregarSessao();
        if (!sessaoAtual) {
            areaLogin.hidden = false;
            areaCorpo.hidden = true;
            pararPolling();
            return;
        }

        areaLogin.hidden = true;

        if (ehAdmin) {
            areaCorpo.hidden = true;
            mostrarListaAdmin();
            return;
        }

        areaCorpo.hidden = false;
        titulo.textContent = "Fale com o suporte";
        carregarConversaCliente();
        iniciarPolling(INTERVALO_ABERTO, carregarConversaCliente);
        setTimeout(() => input.focus(), 50);
    }

    function fecharPainel() {
        aberto = false;
        painel.hidden = true;
        if (!carregarSessao()) return;

        if (ehAdmin) {
            iniciarPolling(INTERVALO_FECHADO, atualizarBadgeAdmin);
        } else {
            iniciarPolling(INTERVALO_FECHADO, atualizarBadgeCliente);
        }
    }

    bolha.addEventListener("click", () => {
        if (aberto) {
            fecharPainel();
        } else {
            abrirPainel();
        }
    });

    fechar.addEventListener("click", fecharPainel);

    if (carregarSessao()) {
        if (ehAdmin) {
            atualizarBadgeAdmin();
            iniciarPolling(INTERVALO_FECHADO, atualizarBadgeAdmin);
        } else {
            atualizarBadgeCliente();
            iniciarPolling(INTERVALO_FECHADO, atualizarBadgeCliente);
        }
    }
})();
