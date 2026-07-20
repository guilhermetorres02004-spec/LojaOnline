require("dotenv").config();
const path = require("path");
const express = require("express");

const app = express();
const PORTA = process.env.PORT || 8080;
const RAIZ = path.join(__dirname, "..");

app.use(express.json({ limit: "10mb" }));

app.use("/api/auth", require("./routes/auth"));
app.use("/api/produtos", require("./routes/produtos"));
app.use("/api/usuarios", require("./routes/usuarios"));
app.use("/api/cadastros", require("./routes/cadastros"));
app.use("/api/pedidos", require("./routes/pedidos"));
app.use("/api/suporte", require("./routes/suporte"));

app.use(express.static(RAIZ));

app.use((erro, req, resposta, proximo) => {
    console.error(erro);
    resposta.status(500).json({ erro: "Erro interno do servidor." });
});

app.listen(PORTA, () => {
    console.log(`Servidor rodando em http://localhost:${PORTA}/loja/index.html`);
});
