<!DOCTYPE html>

<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>GEM Access | Conexões</title>
  <link rel="stylesheet" href="css/style.css">
</head>

<body>
  <div class="app">
    <aside class="sidebar">
      <a class="brand" href="dashboard.html">
        <img class="brand-logo" src="assets/logo.png" alt="Logo GEM Access">
        <div>
          <strong>GEM Access</strong>
          <span>VPN Monitoring</span>
        </div>
      </a>

```
  <nav>
    <a href="dashboard.html">Dashboard</a>
    <a class="active" href="connections.html">Conexões</a>
    <a href="users.html">Usuários</a>
    <a href="alerts.html">Alertas <span class="badge">3</span></a>
    <a href="reports.html">Relatórios</a>
  </nav>

  <div class="sidebar-bottom">
    <a href="#">Configurações</a>
    <a href="index.html">Sair</a>
  </div>
</aside>

<main class="content">
  <header class="topbar">
    <div>
      <p class="eyebrow">MONITORAMENTO</p>
      <h1>Conexões VPN</h1>
      <p class="subtitle">Sessões ativas e recentes da infraestrutura.</p>
    </div>
    <div class="user-chip">
      <span class="status-dot"></span> Administrador
    </div>
  </header>

  <section class="panel">
    <div class="toolbar">
      <input class="search" type="text" placeholder="Pesquisar usuário ou IP...">
      <select>
        <option>Todos os status</option>
        <option>Ativo</option>
        <option>Alerta</option>
      </select>
    </div>

    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Usuário</th>
            <th>IP de origem</th>
            <th>IP VPN</th>
            <th>Protocolo</th>
            <th>Duração</th>
            <th>Tráfego</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody id="connections-table">
          <tr>
            <td colspan="7">Carregando conexões...</td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</main>
```

  </div>

  <script>
    async function carregarConexoes() {
      const tabela = document.getElementById("connections-table");

      try {
        const resposta = await fetch("http://localhost:3000/api/connections");

        if (!resposta.ok) {
          throw new Error("Não foi possível carregar as conexões.");
        }

        const dados = await resposta.json();
        tabela.innerHTML = "";

        dados.forEach(conexao => {
          const linha = document.createElement("tr");

          const statusClasse =
            conexao.status === "active" ? "success" : "warning";

          const statusTexto =
            conexao.status === "active" ? "Ativo" : "Alerta";

          linha.innerHTML = `
            <td>${conexao.user}</td>
            <td>${conexao.sourceIp}</td>
            <td>${conexao.vpnIp}</td>
            <td>${conexao.protocol}</td>
            <td>--</td>
            <td>${conexao.traffic}</td>
            <td>
              <span class="tag ${statusClasse}">${statusTexto}</span>
            </td>
          `;

          tabela.appendChild(linha);
        });
      } catch (erro) {
        console.error(erro);

        tabela.innerHTML = `
          <tr>
            <td colspan="7">Erro ao carregar as conexões.</td>
          </tr>
        `;
      }
    }

    carregarConexoes();
  </script>

</body>
</html>
