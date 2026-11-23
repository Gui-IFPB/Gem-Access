# Product Requirements Document - GEM Access

## Produto

GEM Access é um painel acadêmico para visualizar conexões VPN, usuários, servidores, tráfego, alertas e estado da infraestrutura.

## Objetivos

- Consolidar informações demonstrativas de VPN em uma interface única.
- Permitir autenticação e controle administrativo.
- Disponibilizar CRUD e persistência por uma API REST.
- Registrar consultas, alertas e indicadores em SQLite.

## Público

Administradores de redes e equipes de suporte que acompanham infraestrutura VPN.

## Funcionalidades

- Login e cadastro.
- Dashboard com indicadores e gráficos.
- Conexões com busca e filtro.
- Mapa de origem das sessões.
- Usuários e perfis.
- Alertas com criação, edição e exclusão.
- Relatórios com tráfego e duração.

## Requisitos

- O sistema deve responder pelos recursos protegidos apenas com JWT válido.
- Operações de escrita devem exigir perfil Administrador.
- Senhas devem ser armazenadas com derivação criptográfica.
- Dados devem ser persistidos em SQLite por Prisma.
- A interface deve ser responsiva e apresentar erros da API.

## Restrições

- Dados são demonstrativos.
- Não substitui OpenVPN, WireGuard ou ferramentas de monitoramento reais.
