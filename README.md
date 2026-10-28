# GEM Access

> **Visibilidade para suas conexões.**

## Sobre o projeto

O **GEM Access** é um protótipo de interface web voltado ao monitoramento e à visualização de conexões VPN em uma rede de computadores.

## Objetivo

Criar uma interface centralizada que apresente, de forma organizada e visual, informações relacionadas a conexões VPN, usuários, tráfego, alertas e relatórios.

O projeto é um protótipo acadêmico com as telas de monitoramento conectadas a uma API local do JSON Server. Não há autenticação real nem monitoramento efetivo de uma VPN.

## Principais telas

- **Login:** entrada visual para o sistema.
- **Dashboard:** visão geral com indicadores, gráfico e conexões recentes.
- **Conexões:** tabela de sessões com pesquisa e filtro por status.
- **Localização:** mapa mundial com a origem aproximada das sessões e a localização dos servidores VPN.
- **Usuários:** usuários cadastrados e status calculado a partir das conexões.
- **Alertas:** eventos cadastrados e contador de alertas ativos.
- **Relatórios:** indicadores calculados a partir das conexões e alertas cadastrados.

## Dados dinâmicos

As telas consomem os dados atuais do JSON Server e atualizam automaticamente a cada 15 segundos. Indicadores e gráficos são derivados dos registros existentes; eles não representam histórico real. O mapa usa coordenadas demonstrativas, pois os IPs privados do protótipo não podem ser localizados por GeoIP. O login e o monitoramento efetivo da VPN não fazem parte deste protótipo.

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

## Dados

Os dados de exemplo são mantidos em `data/db.json`. O JSON Server disponibiliza os recursos `connections`, `servers`, `users`, `alerts` e `network`.

## Arquitetura ESM e eventos

O código foi reorganizado em módulos ECMAScript para separar responsabilidades e facilitar a manutenção:

- `assets/js/api.js`: concentrado o acesso à API local com `fetch`, incluindo tratamento de erros e helpers para `GET`, `POST`, `PUT`/`PATCH` e `DELETE`.
- `assets/js/utils.js`: funções utilitárias, sanitização de HTML, conversão de tráfego e formatos de data/hora.
- `assets/js/renderers.js`: renderização de dashboards, tabelas, alertas, relatórios e mapa.
- `assets/js/app.js`: ponto de entrada do sistema, que monta o fluxo de cada página e dispara a inicialização dos elementos da interface.

Todos os scripts carregados nas páginas usam `type="module"` e `import/export`, seguindo o padrão ESM. Isso permite organizar melhor o código, reaproveitar funções e manter a lógica de cada tela isolada.

O tratamento de eventos também foi implementado diretamente no JavaScript:

- formulário de login com `submit` e validação de email/senha;
- campo de pesquisa em `connections.html` com `input`;
- filtro por status com `change`;
- atualização periódica das telas após carregamento dos dados.

## Como executar

1. Inicie a API na raiz do projeto:

	```bash
	npx json-server data/db.json --port 3000
	```

2. Abra `index.html` com a extensão Live Server do VS Code ou outro servidor HTTP local.
3. Acesse `dashboard.html`. A API deve estar disponível em `http://localhost:3000`.

Rotas disponíveis: `http://localhost:3000/connections`, `/servers`, `/users`, `/alerts` e `/network`.

## Estrutura

```text
gem-access/
├── index.html
├── dashboard.html
├── connections.html
├── users.html
├── alerts.html
├── reports.html
├── assets/
│   └── js/
│       └── app.js
├── css/
│   └── style.css
├── data/
│   └── db.json
└── README.md
```

## Benchmarking

O projeto foi inspirado na análise de soluções existentes de gerenciamento e monitoramento de VPN e redes, incluindo OpenVPN Access Server, Pritunl, Netmaker e Zabbix.

A análise serviu como referência para elementos como:

- dashboards;
- gerenciamento de usuários;
- visualização de conexões;
- métricas de tráfego;
- alertas;
- gráficos;
- relatórios.

O objetivo não é reproduzir essas ferramentas, mas utilizar suas características como referência para construir uma interface própria e simplificada.

## Equipe

- Guilherme Manoel da Silva
- Everton Lopes
- Mihael Reinaldo

## Status

**Protótipo conectado ao JSON Server local**
