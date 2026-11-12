# GEM Access

> **Visibilidade para suas conexões.**

## Sobre o projeto

O **GEM Access** é um protótipo de interface web voltado ao monitoramento e à visualização de conexões VPN em uma rede de computadores.

## Objetivo

Criar uma interface centralizada que apresente, de forma organizada e visual, informações relacionadas a conexões VPN, usuários, tráfego, alertas e relatórios.

O projeto é um protótipo acadêmico com as telas de monitoramento conectadas a uma API local do JSON Server. Não há autenticação real nem monitoramento efetivo de uma VPN.

## Público-alvo

O público-alvo pretendido são administradores de redes e equipes de suporte de organizações que precisam acompanhar sessões VPN, usuários, tráfego e alertas em um único painel. O protótipo demonstra a experiência de uso; não substitui ferramentas de monitoramento ou administração de VPN.

## Principais telas

- **Login:** entrada visual para o sistema.
- **Dashboard:** visão geral com indicadores, gráfico e conexões recentes.
- **Conexões:** tabela de sessões com pesquisa e filtro por status.
- **Localização:** mapa mundial com a origem aproximada das sessões e a localização dos servidores VPN.
- **Usuários:** usuários cadastrados e status calculado a partir das conexões.
- **Alertas:** eventos cadastrados e contador de alertas ativos.
- **Relatórios:** indicadores calculados a partir das conexões e alertas cadastrados.

## Dados dinâmicos

As telas consomem os dados atuais do JSON Server e atualizam automaticamente a cada 15 segundos. A tela de conexões permite cadastrar, editar e excluir registros de demonstração. Indicadores e gráficos são derivados dos registros existentes; eles não representam histórico real. O mapa usa coordenadas demonstrativas, pois os IPs privados do protótipo não podem ser localizados por GeoIP. O login e o monitoramento efetivo da VPN não fazem parte deste protótipo.

- monitoramento de conexões VPN;
- visualização de usuários conectados;
- acompanhamento de tráfego;
- visualização de status da infraestrutura;
- apresentação de alertas;
- geração de relatórios.

## Tecnologias

Tecnologias utilizadas:

- HTML5
- CSS3
- JavaScript
- JSON Server
- Express.js

## Dados

Os dados de exemplo são mantidos em `data/db.json`. O servidor Express disponibiliza os recursos `connections`, `servers`, `users`, `alerts` e `network`, mantendo as rotas usadas pelo front-end. O JSON Server pode continuar sendo usado isoladamente para demonstrar a etapa 1.1.

## Back-end Express

O servidor é organizado por responsabilidades em `server/`:

- `routes/`: registra as rotas REST para cada recurso.
- `controllers/`: coordena a requisição, chama o modelo e define o status HTTP.
- `models/`: lê e persiste os registros do arquivo JSON existente, com operações serializadas para evitar gravações simultâneas concorrentes no processo.
- `middleware/validateResource.js`: valida campos obrigatórios, formatos, enumerações e campos não permitidos antes de criar ou atualizar registros.
- `middleware/errorHandler.js`: converte erros de validação, recurso/rota inexistente, JSON inválido e falhas internas em respostas JSON consistentes.

Rotas disponíveis por recurso: `GET /:recurso`, `GET /:recurso/:id`, `POST /:recurso`, `PUT /:recurso/:id`, `PATCH /:recurso/:id` e `DELETE /:recurso/:id`. Os erros seguem o formato `{ "error": { "code": "...", "message": "...", "details": [] } }`; `details` aparece quando há erros de validação. O limite do corpo JSON é 100 KB.

Esta camada usa o arquivo JSON como persistência provisória. Prisma, migrations e autenticação não fazem parte desta etapa do trabalho.

## Arquitetura ESM e eventos

O código foi reorganizado em módulos ECMAScript para separar responsabilidades e facilitar a manutenção:

- `assets/js/api.js`: acesso à API local com `fetch` e validação de respostas HTTP. `apiRequest` aceita métodos HTTP configuráveis; a tela de conexões demonstra `GET`, `POST`, `PATCH` e `DELETE`.
- `assets/js/utils.js`: funções utilitárias, sanitização de HTML, conversão de tráfego e formatos de data/hora.
- `assets/js/renderers.js`: renderização de dashboards, tabelas, alertas, relatórios e mapa.
- `assets/js/app.js`: ponto de entrada do sistema, que monta o fluxo de cada página e dispara a inicialização dos elementos da interface.

Todos os scripts carregados nas páginas usam `type="module"` e `import/export`, seguindo o padrão ESM. Isso permite organizar melhor o código, reaproveitar funções e manter a lógica de cada tela isolada.

O tratamento de eventos também foi implementado diretamente no JavaScript:

- formulário de login com `submit` e validação de email/senha;
- campo de pesquisa em `connections.html` com `input`;
- filtro por status com `change`;
- atualização periódica das telas a cada 15 segundos.

## Como executar

1. Instale as dependências e inicie o servidor Express:

	```bash
	npm install
	npm run dev
	```

2. Abra `index.html` com a extensão Live Server do VS Code (porta padrão 5500) ou outro servidor HTTP em `localhost`/`127.0.0.1`.
3. A API estará disponível em `http://localhost:3000`. Verifique o servidor em `/health`.

Para demonstrar apenas a etapa 1.1, pare o Express e inicie o JSON Server no mesmo endereço/porta: `npx json-server data/db.json --port 3000`. Não execute os dois servidores simultaneamente na porta 3000. Rode os testes do back-end com `npm test`.

## Estrutura

```text
gem-access/
├── index.html
├── dashboard.html
├── connections.html
├── users.html
├── alerts.html
├── reports.html
├── locations.html
├── assets/
│   ├── logo.png
│   ├── design.png
│   ├── preview.png
│   ├── js/
│   │   ├── api.js
│   │   ├── app.js
│   │   ├── renderers.js
│   │   └── utils.js
├── css/
│   └── style.css
├── data/
│   └── db.json
├── server/
│   ├── app.js
│   ├── index.js
│   ├── controllers/
│   ├── errors/
│   ├── middleware/
│   ├── models/
│   └── routes/
├── tests/
│   ├── module-structure.test.mjs
│   └── server.test.js
├── package.json
└── README.md
```

## Benchmarking

O benchmarking abaixo é qualitativo e serve para delimitar referências de produto; não é resultado de testes comparativos nem pretende cobrir todas as funções dessas ferramentas.

| Ferramenta | Foco usado como referência | Relação com o GEM Access |
|---|---|---|
| Grafana | Dashboards e visualização de métricas | Referência para apresentar indicadores e gráficos em uma visão consolidada. |
| Zabbix | Monitoramento de infraestrutura, métricas e alertas | Referência para acompanhar estado da rede e chamar atenção para eventos. |
| Webmin | Administração de servidores por interface web | Referência de acesso centralizado a informações e tarefas administrativas. |
| OpenVPN Access Server, Pritunl e Netmaker | Administração e gerenciamento de VPN | Referências mais próximas do domínio VPN, como usuários, servidores e conexões. |

O recorte proposto para o GEM Access é reunir, em uma interface acadêmica simplificada, informações de sessões VPN, usuários, tráfego e alertas. O protótipo ainda não gerencia servidores VPN nem substitui as ferramentas citadas.

## Estratégia para Obtenção de Dados Reais

Esta estratégia é uma hipótese de integração futura; nenhuma coleta real está implementada no protótipo.

1. **OpenVPN:** em uma instalação autorizada, investigar os registros do serviço (por exemplo, `journalctl -u openvpn-server@server`) para identificar eventos de conexão e desconexão, usuário, horário e endereço do cliente. O nome da unidade e o formato dos registros dependem da instalação.
2. **WireGuard:** consultar periodicamente informações operacionais, como `wg show all latest-handshakes` e `wg show all transfer`, para obter últimos handshakes e contadores de tráfego. Essas consultas pontuais não constituem, por si só, histórico.
3. **Infraestrutura e alertas:** avaliar a API do Zabbix ou métricas via SNMP para estado de servidores, gateways e alertas, usando credenciais de leitura e escopo mínimo.
4. **Normalização e persistência:** um serviço de backend autorizado poderia converter fontes diferentes para um modelo comum (usuário, IPs, protocolo, servidor, início/fim da sessão, tráfego e status), persistir eventos com timestamp e disponibilizar uma API para o front-end.
5. **Privacidade e segurança:** restringir acesso a logs e credenciais, minimizar ou anonimizar IPs e identificadores quando possível, definir retenção e obter autorização dos responsáveis pela rede. Não expor credenciais ou logs sensíveis no navegador.

## Roteiro sugerido para o Pitch (5 minutos)

Distribuição inicial para os três integrantes; ensaiem e ajustem o texto para que a demonstração não ultrapasse cinco minutos.

| Tempo | Pessoa | Conteúdo |
|---|---|---|
| 0:00–0:45 | Guilherme | Apresentar o problema, o objetivo do GEM Access e o público-alvo: administradores de rede e suporte. |
| 0:45–1:30 | Everton | Explicar as features: dashboard, conexões, usuários, mapa demonstrativo, alertas e relatórios. |
| 1:30–2:10 | Mihael | Comparar o recorte do projeto com Grafana, Zabbix, Webmin e ferramentas de gerenciamento VPN; destacar que é um protótipo, não um substituto. |
| 2:10–3:35 | Guilherme | Demonstrar as telas e a navegação; mostrar pesquisa/filtro e o cadastro, edição e exclusão de conexões fictícias. |
| 3:35–4:35 | Everton | Explicar a transição hipotética para dados reais: logs OpenVPN, métricas WireGuard e API/SNMP/Zabbix, com persistência e cuidados de privacidade. |
| 4:35–5:00 | Mihael | Reforçar o valor do protótipo, limitações atuais e próximos passos; encerrar. |

## Equipe

- Guilherme Manoel da Silva
- Everton Lopes
- Mihael Reinaldo

## Status

**Protótipo conectado ao JSON Server local**
