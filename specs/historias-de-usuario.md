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

## HU05 - Monitorar o laboratório OpenVPN local

Como administrador, quero visualizar no dashboard as sessões e contadores coletados do OpenVPN local para demonstrar o funcionamento real do laboratório sem misturá-los aos registros fictícios.

Critérios:
- A coleta é opcional e só executa quando `GEM_ACCESS_OPENVPN_LAB_ENABLED=true` em desenvolvimento.
- O coletor lê snapshots completos do status OpenVPN pelo SSH gerenciado pelo Vagrant e persiste sessões e contadores no SQLite.
- Snapshots inválidos ou falhas de conexão não encerram sessões históricas.
- Sessões ausentes em snapshot válido são preservadas no histórico e marcadas como desconectadas.
- O endpoint de status exige autenticação e perfil Administrador.
- A interface identifica estado desabilitado, indisponível, sem clientes e com clientes ativos.
- Nenhum certificado/perfil privado é enviado à API ou versionado.
