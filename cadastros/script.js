const CHAVE_TOKEN = "wgstore_token";

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
document.getElementById("app-cadastros").hidden = !autorizado;
document.getElementById("acesso-negado").hidden = autorizado;

const listaCadastros = document.getElementById("lista-cadastros");
const vazioCadastros = document.getElementById("vazio-cadastros");
const contadorCadastros = document.getElementById("contador-cadastros");
const toast = document.getElementById("toast");

let toastTimeout = null;

function carregarCadastrosPendentes() {
    return apiFetch("/api/cadastros");
}

function formatarCnpj(cnpj) {
    if (!cnpj) return "—";
    return cnpj.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
}

function formatarTelefone(telefone) {
    if (!telefone) return "—";
    if (telefone.length > 10) {
        return telefone.replace(/(\d{2})(\d{5})(\d{4})/, "($1) $2-$3");
    }
    return telefone.replace(/(\d{2})(\d{4})(\d{4})/, "($1) $2-$3");
}

function formatarDataHora(isoString) {
    const data = new Date(isoString);
    return data.toLocaleDateString("pt-br") + " às " + data.toLocaleTimeString("pt-br", { hour: "2-digit", minute: "2-digit" });
}

function mostrarToast(mensagem) {
    toast.textContent = mensagem;
    toast.classList.add("visivel");
    clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => {
        toast.classList.remove("visivel");
    }, 2600);
}

async function renderizarCadastros() {
    const pendentes = await carregarCadastrosPendentes();

    contadorCadastros.textContent = `${pendentes.length} ${pendentes.length === 1 ? "pendente" : "pendentes"}`;
    listaCadastros.innerHTML = "";

    if (pendentes.length === 0) {
        vazioCadastros.hidden = false;
        return;
    }

    vazioCadastros.hidden = true;

    pendentes.forEach((usuario) => {
        const linha = document.createElement("tr");
        linha.innerHTML = `
            <td class="nome-empresa">${usuario.nome}</td>
            <td>${formatarCnpj(usuario.cnpj)}</td>
            <td>${usuario.email}</td>
            <td>${formatarTelefone(usuario.telefone)}</td>
            <td>${usuario.dataCadastro ? formatarDataHora(usuario.dataCadastro) : "—"}</td>
            <td>
                <div class="acoes-cadastro">
                    <button type="button" class="acao-btn aprovar" data-id="${usuario.id}">Aprovar</button>
                    <button type="button" class="acao-btn rejeitar" data-id="${usuario.id}">Rejeitar</button>
                </div>
            </td>
        `;
        listaCadastros.appendChild(linha);
    });
}

if (autorizado) {
    listaCadastros.addEventListener("click", async (evento) => {
        const id = evento.target.dataset.id;
        if (!id) return;

        const nomeEmpresa = evento.target.closest("tr").querySelector(".nome-empresa").textContent;

        if (evento.target.classList.contains("aprovar")) {
            await apiFetch(`/api/cadastros/${id}/aprovar`, { method: "PUT" });
            await renderizarCadastros();
            mostrarToast(`Cadastro de ${nomeEmpresa} aprovado! Já pode entrar na conta.`);
            return;
        }

        if (evento.target.classList.contains("rejeitar")) {
            await apiFetch(`/api/cadastros/${id}`, { method: "DELETE" });
            await renderizarCadastros();
            mostrarToast(`Cadastro de ${nomeEmpresa} rejeitado.`);
        }
    });

    renderizarCadastros();
}
