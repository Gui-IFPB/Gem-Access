# Histórias de usuário

## HU01 - Entrar no sistema

Como administrador, quero autenticar minhas credenciais para acessar o painel.

Critérios:
- Login válido redireciona para o dashboard.
- Login inválido apresenta mensagem de erro.
- Sem token o usuário é redirecionado para login.

## HU02 - Gerenciar conexões

Como administrador, quero cadastrar e atualizar conexões para acompanhar sessões VPN.

Critérios:
- Usuário comum não pode criar ou alterar registros.
- Dados obrigatórios são validados.
- Exclusão exige confirmação.

## HU03 - Consultar alertas

Como usuário autenticado, quero visualizar alertas ativos e resolvidos.

Critérios:
- A lista deve refletir o banco.
- Usuário comum pode consultar.
- Somente administrador pode alterar.

## HU04 - Visualizar localização

Como administrador, quero visualizar origem aproximada e servidor associado.

Critérios:
- O mapa deve indicar sessões ativas.
- Coordenadas devem ser tratadas como demonstrativas.
