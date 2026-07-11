const bcrypt = require("bcryptjs");
const pool = require("./db");

async function garantirAdminMestre() {
    const { rows } = await pool.query("SELECT id FROM usuarios WHERE email = $1", ["admin@local.net"]);
    if (rows.length > 0) {
        console.log("Admin mestre já existe.");
        return;
    }

    const senhaHash = await bcrypt.hash("capela9797", 10);
    await pool.query(
        `INSERT INTO usuarios (nome, email, senha_hash, papel, status_cadastro)
         VALUES ($1, $2, $3, 'admin', 'aprovado')`,
        ["Administrador", "admin@local.net", senhaHash]
    );
    console.log("Admin mestre criado: admin@local.net / capela9797");
}

garantirAdminMestre()
    .catch((erro) => {
        console.error("Erro ao criar admin mestre:", erro);
        process.exitCode = 1;
    })
    .finally(() => pool.end());
