const CHAVE_USUARIOS = "loja-usuarios";
const CHAVE_SESSAO = "loja-usuario-logado";

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
document.getElementById("app-cadastros").hidden = !autorizado;
document.getElementById("acesso-negado").hidden = autorizado;

if (autorizado) {
    const sessaoAtual = localStorage.getItem(CHAVE_SESSAO);
    const parametro = encodeURIComponent(sessaoAtual);
    document.getElementById("link-estoque").href = `../estoque/index.html?sessao=${parametro}`;
    document.getElementById("link-usuarios").href = `../usuarios/index.html?sessao=${parametro}`;
    document.getElementById("link-promocoes").href = `../promocoes/index.html?sessao=${parametro}`;
    document.getElementById("link-loja").href = `../loja/index.html?sessao=${parametro}`;
}

const listaCadastros = document.getElementById("lista-cadastros");
const vazioCadastros = document.getElementById("vazio-cadastros");
const contadorCadastros = document.getElementById("contador-cadastros");
const toast = document.getElementById("toast");

let toastTimeout = null;

function carregarUsuarios() {
    const dados = localStorage.getItem(CHAVE_USUARIOS);
    return dados ? JSON.parse(dados) : [];
}

function salvarUsuarios(usuarios) {
    localStorage.setItem(CHAVE_USUARIOS, JSON.stringify(usuarios));
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

function renderizarCadastros() {
    const pendentes = carregarUsuarios().filter(
        (usuario) => usuario.papel === "vendedor" && usuario.statusCadastro === "pendente"
    );

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
    listaCadastros.addEventListener("click", (evento) => {
        const id = evento.target.dataset.id;
        if (!id) return;

        const usuarios = carregarUsuarios();
        const usuario = usuarios.find((item) => item.id === id);
        if (!usuario) return;

        if (evento.target.classList.contains("aprovar")) {
            usuario.statusCadastro = "aprovado";
            salvarUsuarios(usuarios);
            renderizarCadastros();
            mostrarToast(`Cadastro de ${usuario.nome} aprovado! Já pode entrar na conta.`);
            return;
        }

        if (evento.target.classList.contains("rejeitar")) {
            const restantes = usuarios.filter((item) => item.id !== id);
            salvarUsuarios(restantes);
            renderizarCadastros();
            mostrarToast(`Cadastro de ${usuario.nome} rejeitado.`);
        }
    });

    renderizarCadastros();
}
