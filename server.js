const http = require("http");
const fs = require("fs");
const path = require("path");

const PORTA = 8080;
const RAIZ = __dirname;

const TIPOS_MIME = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "application/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".svg": "image/svg+xml",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".ico": "image/x-icon",
};

const servidor = http.createServer((requisicao, resposta) => {
    const urlSemQuery = requisicao.url.split("?")[0];
    let caminhoRelativo = decodeURIComponent(urlSemQuery);
    if (caminhoRelativo === "/") caminhoRelativo = "/index.html";

    const caminhoAbsoluto = path.join(RAIZ, caminhoRelativo);

    if (!caminhoAbsoluto.startsWith(RAIZ)) {
        resposta.writeHead(403);
        resposta.end("Acesso negado.");
        return;
    }

    fs.readFile(caminhoAbsoluto, (erro, conteudo) => {
        if (erro) {
            resposta.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
            resposta.end("Não encontrado: " + caminhoRelativo);
            return;
        }

        const extensao = path.extname(caminhoAbsoluto).toLowerCase();
        resposta.writeHead(200, { "Content-Type": TIPOS_MIME[extensao] || "application/octet-stream" });
        resposta.end(conteudo);
    });
});

servidor.listen(PORTA, () => {
    console.log(`Servidor rodando em http://localhost:${PORTA}/loja/index.html`);
    console.log("Pressione Ctrl+C para parar.");
});
