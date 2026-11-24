# Product Requirements Document - GEM Access

## Produto

GEM Access é um painel acadêmico para visualizar conexões VPN, usuários, servidores, tráfego, alertas e estado da infraestrutura.

## Objetivos

- Consolidar informações demonstrativas e sessões de um laboratório VPN local em uma interface única.
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
- Integração opcional com o status de uma instância OpenVPN local gerenciada por Vagrant.
- Histórico persistido de sessões, horários de conexão/desconexão e contadores de bytes do laboratório.

## Requisitos

- O sistema deve responder pelos recursos protegidos apenas com JWT válido.
- Operações de escrita devem exigir perfil Administrador.
- Senhas devem ser armazenadas com derivação criptográfica.
- Dados devem ser persistidos em SQLite por Prisma.
- A interface deve ser responsiva e apresentar erros da API.
- O estado do laboratório e seus endereços operacionais só podem ser consultados por administradores.
- A coleta via Vagrant só é habilitada explicitamente em desenvolvimento.

## Restrições

- Os registros legados permanecem demonstrativos; o laboratório é local e não representa dados institucionais ou de produção.
- O coletor atual é específico ao Vagrant/OpenVPN do projeto e não substitui OpenVPN, WireGuard ou ferramentas de monitoramento reais.
- A integração local não é habilitada pelo Docker Compose e não deve ser implantada em produção.
