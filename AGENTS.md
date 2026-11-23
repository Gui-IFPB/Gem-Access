# AGENTS.md - Convenções do GEM Access

## Arquitetura

- Front-end estático em HTML, CSS e JavaScript ESM.
- API em Express com rotas, controllers e middleware.
- Persistência em SQLite via Prisma.
- JSON Store disponível para testes e demonstração de front-end.

## Convenções

- JavaScript ESM com imports explícitos.
- Manter respostas de erro no formato `{ "error": { "code", "message" } }`.
- Usar asyncHandler para operações assíncronas nas rotas.
- Validar entrada antes de persistir dados.
- Não registrar nem retornar hashes de senha.
- Não commitar `.env`, bancos SQLite ou `node_modules`.
- Preservar respostas HTTP REST usadas pela aplicação.

## Desenvolvimento assistido por IA

- Aplicar mudanças cirúrgicas.
- Executar `npm test` após alterações no back-end.
- Executar `npm run db:migrate` após alterar o schema Prisma.
- Não remover dados reais ou o banco local sem autorização.
