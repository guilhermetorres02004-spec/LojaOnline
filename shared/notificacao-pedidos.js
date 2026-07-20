(function () {
    const CHAVE_TOKEN = "wgstore_token";
    const INTERVALO = 10000;

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
        return { id: payload.id, papel: payload.papel, token };
    }

    const sessao = carregarSessao();
    if (!sessao || (sessao.papel !== "admin" && sessao.papel !== "vendedor")) return;

    const badge = document.getElementById("badge-pedidos");
    if (!badge) return;

    async function atualizarBadge() {
        try {
            const resposta = await fetch("/api/pedidos/vendedor/nao-processados", {
                headers: { Authorization: `Bearer ${sessao.token}` },
            });
            if (!resposta.ok) return;
            const dados = await resposta.json();
            if (dados.naoProcessados > 0) {
                badge.textContent = dados.naoProcessados > 9 ? "9+" : String(dados.naoProcessados);
                badge.hidden = false;
            } else {
                badge.hidden = true;
            }
        } catch (erro) {
            /* silencioso: nao interrompe a navegacao por causa da notificacao */
        }
    }

    atualizarBadge();
    setInterval(atualizarBadge, INTERVALO);
})();
