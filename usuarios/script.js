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
document.getElementById("app-usuarios").hidden = !autorizado;
document.getElementById("acesso-negado").hidden = autorizado;

const linkEstoque = document.getElementById("link-estoque");
const linkLoja = document.getElementById("link-loja");

if (autorizado) {
    const sessaoAtual = localStorage.getItem(CHAVE_SESSAO);
    linkEstoque.href = `../estoque/index.html?sessao=${encodeURIComponent(sessaoAtual)}`;
    linkLoja.href = `../loja/index.html?sessao=${encodeURIComponent(sessaoAtual)}`;
}

const statTotal = document.getElementById("stat-total");
const statCompradores = document.getElementById("stat-compradores");
const statReceita = document.getElementById("stat-receita");
const buscaUsuario = document.getElementById("busca-usuario");
const ordenarUsuarios = document.getElementById("ordenar-usuarios");
const contadorUsuarios = document.getElementById("contador-usuarios");
const listaUsuarios = document.getElementById("lista-usuarios");
const vazioUsuarios = document.getElementById("vazio-usuarios");
const vazioUsuariosTexto = document.getElementById("vazio-usuarios-texto");

let termoBusca = "";
let ordenacaoAtual = "compras";

function carregarUsuarios() {
    const dados = localStorage.getItem(CHAVE_USUARIOS);
    return dados ? JSON.parse(dados) : [];
}

function salvarUsuarios(usuarios) {
    localStorage.setItem(CHAVE_USUARIOS, JSON.stringify(usuarios));
}

function mascararCpf(valor) {
    return valor
        .replace(/\D/g, "")
        .slice(0, 11)
        .replace(/(\d{3})(\d)/, "$1.$2")
        .replace(/(\d{3})(\d)/, "$1.$2")
        .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
}

function cpfValido(cpf) {
    cpf = cpf.replace(/\D/g, "");
    if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;

    let soma = 0;
    for (let i = 0; i < 9; i++) soma += Number(cpf[i]) * (10 - i);
    let digito1 = (soma * 10) % 11;
    if (digito1 === 10 || digito1 === 11) digito1 = 0;
    if (digito1 !== Number(cpf[9])) return false;

    soma = 0;
    for (let i = 0; i < 10; i++) soma += Number(cpf[i]) * (11 - i);
    let digito2 = (soma * 10) % 11;
    if (digito2 === 10 || digito2 === 11) digito2 = 0;
    if (digito2 !== Number(cpf[10])) return false;

    return true;
}

function formatarPreco(valor) {
    return valor.toLocaleString("pt-br", { style: "currency", currency: "BRL" });
}

function formatarCpf(cpf) {
    if (!cpf) return "—";
    return cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
}

function ordenarLista(usuarios) {
    const copia = [...usuarios];
    if (ordenacaoAtual === "compras") {
        copia.sort((a, b) => (b.comprasRealizadas || 0) - (a.comprasRealizadas || 0));
    } else if (ordenacaoAtual === "gasto") {
        copia.sort((a, b) => (b.totalGasto || 0) - (a.totalGasto || 0));
    } else {
        copia.sort((a, b) => a.nome.localeCompare(b.nome, "pt-br"));
    }
    return copia;
}

function renderizarUsuarios() {
    const usuarios = carregarUsuarios();

    statTotal.textContent = usuarios.length;
    statCompradores.textContent = usuarios.filter((usuario) => (usuario.comprasRealizadas || 0) > 0).length;
    const receitaTotal = usuarios.reduce((soma, usuario) => soma + (usuario.totalGasto || 0), 0);
    statReceita.textContent = formatarPreco(receitaTotal);

    const termo = termoBusca.trim().toLowerCase();
    const filtrados = termo
        ? usuarios.filter((usuario) =>
              usuario.nome.toLowerCase().includes(termo) || usuario.email.toLowerCase().includes(termo)
          )
        : usuarios;

    const ordenados = ordenarLista(filtrados);

    contadorUsuarios.textContent = `${ordenados.length} ${ordenados.length === 1 ? "usuário" : "usuários"}`;
    listaUsuarios.innerHTML = "";

    if (ordenados.length === 0) {
        vazioUsuarios.hidden = false;
        vazioUsuariosTexto.textContent = usuarios.length === 0
            ? "Nenhum usuário cadastrado ainda."
            : "Nenhum usuário encontrado para essa busca.";
        return;
    }

    vazioUsuarios.hidden = true;

    ordenados.forEach((usuario) => {
        const linha = document.createElement("tr");
        const compras = usuario.comprasRealizadas || 0;
        linha.innerHTML = `
            <td class="nome-usuario">${usuario.nome}</td>
            <td>${usuario.email}</td>
            <td>${formatarCpf(usuario.cpf)}</td>
            <td><span class="papel-badge ${usuario.papel === "admin" ? "admin" : ""}">${usuario.papel === "admin" ? "Admin" : "Cliente"}</span></td>
            <td class="${compras > 0 ? "compras-destaque" : ""}">${compras}</td>
            <td>${formatarPreco(usuario.totalGasto || 0)}</td>
        `;
        listaUsuarios.appendChild(linha);
    });
}

const formCriarUsuario = document.getElementById("form-criar-usuario");
const campoNovoCpf = document.getElementById("novo-cpf");
const mensagemCriarUsuario = document.getElementById("mensagem-criar-usuario");
const btnAbrirFormUsuario = document.getElementById("btn-abrir-form-usuario");
const btnCancelarFormUsuario = document.getElementById("btn-cancelar-form-usuario");

function mostrarMensagemCriarUsuario(texto, tipo) {
    mensagemCriarUsuario.textContent = texto;
    mensagemCriarUsuario.className = `mensagem ${tipo}`;
    mensagemCriarUsuario.hidden = false;
}

function abrirFormUsuario() {
    formCriarUsuario.reset();
    formCriarUsuario.hidden = false;
    btnAbrirFormUsuario.hidden = true;
    setTimeout(() => formCriarUsuario.reset(), 60);
}

function fecharFormUsuario() {
    formCriarUsuario.reset();
    formCriarUsuario.hidden = true;
    mensagemCriarUsuario.hidden = true;
    btnAbrirFormUsuario.hidden = false;
}

if (autorizado) {
    buscaUsuario.addEventListener("input", () => {
        termoBusca = buscaUsuario.value;
        renderizarUsuarios();
    });

    ordenarUsuarios.addEventListener("change", () => {
        ordenacaoAtual = ordenarUsuarios.value;
        renderizarUsuarios();
    });

    btnAbrirFormUsuario.addEventListener("click", abrirFormUsuario);
    btnCancelarFormUsuario.addEventListener("click", fecharFormUsuario);

    campoNovoCpf.addEventListener("input", () => {
        campoNovoCpf.value = mascararCpf(campoNovoCpf.value);
    });

    formCriarUsuario.addEventListener("submit", (evento) => {
        evento.preventDefault();
        mensagemCriarUsuario.hidden = true;

        const nome = document.getElementById("novo-nome").value.trim();
        const email = document.getElementById("novo-email").value.trim().toLowerCase();
        const cpf = campoNovoCpf.value.replace(/\D/g, "");
        const senha = document.getElementById("novo-senha").value;
        const papel = document.getElementById("novo-papel").value;

        if (!nome || !email || !cpf || !senha) {
            mostrarMensagemCriarUsuario("Preencha todos os campos.", "erro");
            return;
        }

        if (!cpfValido(cpf)) {
            mostrarMensagemCriarUsuario("Informe um CPF válido.", "erro");
            return;
        }

        if (senha.length < 4) {
            mostrarMensagemCriarUsuario("A senha deve ter pelo menos 4 caracteres.", "erro");
            return;
        }

        const usuarios = carregarUsuarios();

        if (usuarios.some((usuario) => usuario.email.toLowerCase() === email)) {
            mostrarMensagemCriarUsuario("Já existe um usuário com esse e-mail.", "erro");
            return;
        }

        if (usuarios.some((usuario) => usuario.cpf === cpf)) {
            mostrarMensagemCriarUsuario("Já existe um usuário com esse CPF.", "erro");
            return;
        }

        usuarios.push({
            id: Date.now().toString(),
            nome,
            email,
            cpf,
            senha,
            papel,
            comprasRealizadas: 0,
            totalGasto: 0,
        });

        salvarUsuarios(usuarios);
        mostrarMensagemCriarUsuario("Usuário criado com sucesso!", "sucesso");
        renderizarUsuarios();
        setTimeout(fecharFormUsuario, 1200);
    });

    renderizarUsuarios();
}
