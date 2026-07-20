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

const form = document.getElementById("form-esqueci-senha");
const mensagem = document.getElementById("mensagem");
const caixaLink = document.getElementById("link-recuperacao-caixa");
const linkRecuperacao = document.getElementById("link-recuperacao");

function mostrarMensagem(texto, tipo) {
    mensagem.textContent = texto;
    mensagem.className = `mensagem ${tipo}`;
    mensagem.hidden = false;
}

form.addEventListener("submit", async (evento) => {
    evento.preventDefault();
    mensagem.hidden = true;
    caixaLink.hidden = true;

    const email = document.getElementById("email").value.trim().toLowerCase();

    try {
        const dados = await apiFetch("/api/auth/esqueci-senha", {
            method: "POST",
            body: JSON.stringify({ email }),
        });

        mostrarMensagem(dados.mensagem, "sucesso");

        const url = `${window.location.origin}/login/redefinir-senha.html?token=${dados.token}`;
        linkRecuperacao.href = url;
        linkRecuperacao.textContent = url;
        caixaLink.hidden = false;
    } catch (erro) {
        mostrarMensagem(erro.message, "erro");
    }
});
