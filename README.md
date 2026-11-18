# GEM Access

> Protótipo web para visualizar conexões VPN, usuários, tráfego, alertas e estado da infraestrutura. O objetivo é reunir essas informações em telas simples para apoiar o acompanhamento demonstrativo de uma rede.

## Ideia, Objetivo Principal & Público-Alvo

- **Ideia & Objetivo:** criar um painel web que reúna informações de sessões VPN, usuários, tráfego, servidores e alertas.
- **Público-Alvo:** administradores de redes e equipes de suporte que acompanham conexões VPN.
- **Problema:** informações de sessões, tráfego e estado da rede podem estar distribuídas entre comandos de terminal, registros de serviço e ferramentas distintas, dificultando uma visão resumida.
- **Solução & Valor:** o GEM Access organiza esses indicadores em dashboard, tabelas, alertas, mapa e relatórios. Nesta versão acadêmica, os dados são fictícios e não há monitoramento efetivo de uma VPN.

## Benchmarking (Análise Comparativa)

Análise qualitativa de referências; não representa testes comparativos nem uma avaliação completa dos produtos.

| Ferramenta | Pontos Fortes | Limitações | Diferencial da Solução |
| ---------- | ------------- | ---------- | ---------------------- |
| Grafana | Dashboards flexíveis e visualização de métricas | Depende da configuração de fontes de dados e painéis | Protótipo com telas pré-organizadas para informações de conexões VPN |
| Zabbix | Monitoramento de infraestrutura, métricas e alertas | Requer configuração dos itens monitorados e da infraestrutura | Interface acadêmica simplificada para demonstrar conexões, usuários e alertas |
| Webmin | Administração de servidores por interface web | É uma ferramenta geral de administração, não focada em relatórios de sessões VPN | Recorte visual centrado em sessões, tráfego e estado da VPN |
| OpenVPN Access Server | Administração de uma infraestrutura OpenVPN | Voltado ao gerenciamento do serviço OpenVPN | O protótipo apresenta uma visão demonstrativa que também inclui registros WireGuard |

O GEM Access não substitui essas ferramentas nem administra servidores VPN nesta etapa.

## Equipe

- **Guilherme Manoel da Silva** - Matrícula: 20232380026 | GitHub: Gui-IFPB
- **Everton Lopes** - Matrícula: 20242380007 a informar | GitHub: Everton-IFPB 
- **Mihael Reinaldo** - Matrícula: 20232380012 a informar | GitHub:Mihael-IFPB

## Documentação & Recursos

- **Pitch / Apresentação:** link dos slides a informar.
- **Protótipos / Design:** [design](assets/design.png) | [preview atual](assets/preview.png) (imagem a revisar para a proporção 16:9) | Figma: link a informar.
- **Workflow / Kanban:** GitHub Projects: link a informar.
- **Documentação do Projeto:** código do [servidor](server/) e [testes](tests/); esta documentação está no README.
- **Repositório:** [Gui-IFPB/Gem-Access](https://github.com/Gui-IFPB/Gem-Access).

### Execução local

1. Instale as dependências, aplique a migration e carregue os dados demonstrativos:

   ```bash
   npm install
   npm run db:setup
   npm run dev
   ```

2. Abra [index.html](index.html) com a extensão Live Server do VS Code ou outro servidor HTTP em `localhost`/`127.0.0.1`.
3. A API fica disponível em `http://localhost:3000`. Verifique `/health`; os recursos de dados exigem autenticação pelo login.
4. Execute os testes com:

   ```bash
   npm test
   ```

Para demonstrar somente a etapa 1.1, pare o Express e execute `npx json-server data/db.json --port 3000`. Os dois servidores não podem ocupar a mesma porta ao mesmo tempo.

### Organização do Back-end Express

- `server/routes/`: define as rotas REST dos recursos.
- `server/controllers/`: coordena requisições, operações do modelo e respostas HTTP.
- `server/models/`: `prismaStore.js` implementa persistência relacional com Prisma; `jsonStore.js` permanece como adapter simples para testes e compatibilidade.
- `server/middleware/validateResource.js`: verifica campos obrigatórios, formatos, valores permitidos e campos desconhecidos.
- `server/middleware/errorHandler.js`: transforma erros de validação, JSON inválido, recurso ou rota inexistente e falhas internas em respostas JSON padronizadas.

### Banco de dados e persistência

O servidor usa SQLite por meio do Prisma ORM. O schema fica em `prisma/schema.prisma`, o client é gerado pelo Prisma e a conexão padrão cria `data/gem-access.sqlite`. O arquivo do banco é local e não deve ser versionado.

O schema define `User`, `Server`, `Connection`, `Alert` e `NetworkComponent` (tabela `network`). Um usuário pode ter várias conexões; cada conexão pertence a um servidor e pode estar associada a um usuário. A associação do usuário é opcional para manter registros demonstrativos que ainda não correspondam a uma conta cadastrada, enquanto o nome original continua preservado na conexão. A exclusão de um usuário mantém as conexões e remove somente a associação; servidores com conexões não podem ser excluídos. E-mail de usuário é único. A localização de origem da conexão é armazenada em colunas próprias e convertida para o objeto `sourceLocation` na API.

As migrations SQL versionadas ficam em `prisma/migrations/`. `npm run db:migrate` aplica migrations pendentes; para evoluir o schema durante o desenvolvimento, altere `prisma/schema.prisma` e gere uma migration com `npx prisma migrate dev --name descricao-da-alteracao`. `npm run db:setup` aplica as migrations e importa `data/db.json` uma única vez para iniciar a demonstração; a carga é ignorada se o banco já contiver registros.

O `prismaStore` integra o client às operações CRUD já expostas pela API. `P2002` (valor único duplicado) vira `409 DUPLICATE_RECORD`; `P2003` (integridade referencial) vira `409 RELATION_CONFLICT`; registro ausente vira `404 NOT_FOUND`. Outros erros do banco são encapsulados como `500 PERSISTENCE_ERROR`, sem expor detalhes internos. A validação de entrada e o middleware central continuam responsáveis pelos erros HTTP padronizados.

Os recursos `connections`, `servers`, `users`, `alerts` e `network` oferecem `GET`, `POST`, `PUT`, `PATCH` e `DELETE`. Crie uma conta em `/auth/register` com nome, e-mail e senha de 10 a 128 caracteres, ou entre em `/auth/login`. O seed também cria a conta demonstrativa `admin@gemaccess.local` / `gemaccess123`. Senhas são derivadas com `scrypt`, salt aleatório e comparação em tempo constante; o hash nunca é retornado pelas rotas de usuários. O login e o cadastro retornam JWT HS256 com validade de oito horas, enviado às rotas protegidas no cabeçalho `Authorization: Bearer <token>`. O logout bloqueia o identificador do token até seu vencimento na instância atual, e o navegador mantém o token em `sessionStorage`.

Em desenvolvimento, se `GEM_ACCESS_JWT_SECRET` não estiver definido, o servidor gera uma chave aleatória para o processo; os tokens deixam de valer após reiniciar. Em produção, configure `GEM_ACCESS_JWT_SECRET` com pelo menos 32 bytes e defina `GEM_ACCESS_ADMIN_EMAIL` / `GEM_ACCESS_ADMIN_PASSWORD` antes da primeira carga do seed. O logout usa uma lista de revogação em memória e, portanto, esta implementação é adequada para execução local ou instância única; uma implantação com várias instâncias deve persistir essa lista em um armazenamento compartilhado.

## Páginas / Telas da Aplicação (GitHub Pages)

O GitHub Pages está configurado. As telas disponíveis no repositório são:

- 🏠 **Índice / Login:** [index.html](index.html)
- 📊 **Dashboard:** [dashboard.html](dashboard.html)
- 🔑 **Autenticação:** [index.html](index.html) (login validado pela API)
- 🔌 **Conexões:** [connections.html](connections.html)
- 🌐 **Localização:** [locations.html](locations.html)
- 🚨 **Alertas:** [alerts.html](alerts.html)
- 📋 **Relatórios:** [reports.html](reports.html)
- 👥 **Usuários:** [users.html](users.html)

## Funcionalidades Planejadas (Features)

- [x] Dashboard com contadores de conexões, usuários, tráfego e alertas usando dados fictícios.
- [x] Layout responsivo para dashboard, conexões, localização, usuários, alertas e relatórios.
- [x] Busca por usuário/IP e filtro por status na tela de conexões.
- [x] Consumo de API simulada com `fetch` e JSON Server para a etapa 1.1.
- [x] API REST Express para os recursos do protótipo, com operações CRUD, validação e tratamento centralizado de erros.
- [x] Persistência relacional SQLite com Prisma, migrations, relacionamentos, seed inicial e tratamento de erros de integridade.
- [x] Login validado pela API, token de sessão no cliente e proteção das rotas de dados.
- [ ] Persistência relacional com Prisma ORM e migrations.
- [ ] Coleta de dados reais de VPN/rede, notificações automáticas e exportação de relatórios.

## Estratégia para Obtenção de Dados Reais (Hipóteses Técnicas)

As opções abaixo são hipóteses para etapas futuras. O protótipo ainda não coleta informações de sistemas VPN ou equipamentos reais.

- **Fontes de Dados & Coleta:**
  - OpenVPN: avaliar registros do serviço, por exemplo com `journalctl -u openvpn-server@server`, para identificar conexões, desconexões, horários e usuários. A unidade e o formato variam conforme a instalação.
  - WireGuard: consultar contadores e handshakes recentes com `wg show all transfer` e `wg show all latest-handshakes`; consultas periódicas seriam necessárias para construir histórico.
  - Infraestrutura: considerar API do Zabbix ou métricas via SNMP para estado de servidores, gateways e alertas.
  - Toda coleta dependeria de autorização, escopo de leitura mínimo e cuidados com IPs, identificadores e retenção de logs.
- **Armazenamento & API:** o serviço Express já normaliza os dados demonstrativos em um modelo relacional SQLite com Prisma. A coleta real das fontes ainda é uma etapa futura; os registros atuais continuam sendo fictícios.
