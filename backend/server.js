const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = 3000;

const DB_PATH = path.join(__dirname, "..", "data", "db.json");

app.use(cors());
app.use(express.json());

function lerBanco() {
  const dados = fs.readFileSync(DB_PATH, "utf8");
  return JSON.parse(dados);
}

function salvarBanco(dados) {
  fs.writeFileSync(DB_PATH, JSON.stringify(dados, null, 2));
}

app.get("/api/connections", (req, res) => {
  const dados = lerBanco();
  res.json(dados.connections);
});

app.get("/api/connections/:id", (req, res) => {
  const dados = lerBanco();

  const conexao = dados.connections.find(
    item => item.id === Number(req.params.id)
  );

  if (!conexao) {
    return res.status(404).json({
      error: "Conexão não encontrada"
    });
  }

  res.json(conexao);
});

app.post("/api/connections", (req, res) => {
  const dados = lerBanco();

  const novaConexao = {
    id: dados.connections.length
      ? Math.max(...dados.connections.map(item => item.id)) + 1
      : 1,
    ...req.body
  };

  dados.connections.push(novaConexao);
  salvarBanco(dados);

  res.status(201).json(novaConexao);
});

app.put("/api/connections/:id", (req, res) => {
  const dados = lerBanco();

  const index = dados.connections.findIndex(
    item => item.id === Number(req.params.id)
  );

  if (index === -1) {
    return res.status(404).json({
      error: "Conexão não encontrada"
    });
  }

  dados.connections[index] = {
    ...dados.connections[index],
    ...req.body,
    id: Number(req.params.id)
  };

  salvarBanco(dados);

  res.json(dados.connections[index]);
});

app.delete("/api/connections/:id", (req, res) => {
  const dados = lerBanco();

  const index = dados.connections.findIndex(
    item => item.id === Number(req.params.id)
  );

  if (index === -1) {
    return res.status(404).json({
      error: "Conexão não encontrada"
    });
  }

  const removida = dados.connections.splice(index, 1)[0];

  salvarBanco(dados);

  res.json(removida);
});

app.listen(PORT, () => {
  console.log(`GEM Access API rodando em http://localhost:${PORT}`);
});
