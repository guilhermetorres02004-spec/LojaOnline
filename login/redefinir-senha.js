async function apiFetch(caminho, opcoes) {
    const resposta = await fetch(caminho, {
        ...opcoes,
        headers: Object.assign({ "Content-Type": "application/json" }, (opcoes && opcoes.headers) || {}),
    });
    const dados = await resposta.json().catch(() => ({}));
    if (!resposta.ok) {
        throw new Error(dados.erro || "Erro inesperado. Tente novamente.");
    }
    return dados;
}

function obterTokenDaUrl() {
    const parametros = new URLSearchParams(window.location.search);
    return parametros.get("token");
}

const form = document.getElementById("form-redefinir-senha");
const mensagem = document.getElementById("mensagem");
const linkInvalido = document.getElementById("link-invalido");

function mostrarMensagem(texto, tipo) {
    mensagem.textContent = texto;
    mensagem.className = `mensagem ${tipo}`;
    mensagem.hidden = false;
}

const token = obterTokenDaUrl();
if (!token) {
    form.hidden = true;
    linkInvalido.hidden = false;
}

form.addEventListener("submit", async (evento) => {
    evento.preventDefault();
    mensagem.hidden = true;

    const novaSenha = document.getElementById("nova-senha").value;
    const confirmarSenha = document.getElementById("confirmar-senha").value;

    if (novaSenha !== confirmarSenha) {
        mostrarMensagem("As senhas não coincidem.", "erro");
        return;
    }

    try {
        const dados = await apiFetch("/api/auth/redefinir-senha", {
            method: "POST",
            body: JSON.stringify({ token, novaSenha }),
        });
        mostrarMensagem(dados.mensagem, "sucesso");
        form.hidden = true;
        setTimeout(() => {
            window.location.href = "index.html";
        }, 1800);
    } catch (erro) {
        mostrarMensagem(erro.message, "erro");
    }
});
