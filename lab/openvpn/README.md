# Laboratório local OpenVPN

Este laboratório prepara uma instância descartável de OpenVPN em uma VM do VirtualBox. É um ambiente acadêmico local, não uma implantação de produção.

## Limites e requisitos

- Usa software gratuito, Vagrant, VirtualBox e uma imagem Ubuntu baixada pelo Vagrant.
- A VM tem uma interface host-only em `192.168.56.10`; não há redirecionamento de portas para a rede local ou para a Internet.
- A interface NAT padrão do VirtualBox permite baixar pacotes durante o provisionamento. O OpenVPN escuta somente no endereço host-only.
- O computador hospedeiro atua como cliente e precisa ter o cliente OpenVPN instalado.
- O provisionamento cria uma CA e chaves de demonstração dentro da VM. Não reutilize essas chaves fora deste laboratório.
- O perfil exportado contém uma chave privada. Ele fica em `data/openvpn-lab-client.ovpn`, é ignorado pelo Git e deve permanecer apenas no computador local.
- A API do GEM Access ainda não recebe dados deste laboratório. Integração, histórico, alertas e coleta permanecem etapas futuras.

Não use este laboratório para tráfego real, não encaminhe portas do roteador e não reutilize certificados ou chaves em sistemas externos.

## Preparação

Instale Vagrant e VirtualBox no computador hospedeiro. A instalação e o download da imagem não são iniciados por este repositório.

Para criar e iniciar a VM:

```bash
cd lab/openvpn
vagrant up
vagrant status
```

O primeiro início baixa a imagem da VM e os pacotes do Ubuntu. O provisionamento configura o serviço e um cliente de demonstração. Para parar a VM:

```bash
vagrant halt
```

## Perfil do cliente

Com a VM ativa, exporte o perfil privado local:

```bash
bash export-client.sh
```

O hospedeiro precisa de privilégios para iniciar a interface de túnel do OpenVPN. A configuração não redireciona a rota padrão da máquina. Conecte apenas enquanto a VM estiver ativa e encerre o cliente depois do teste.

## Coleta que será feita depois

O servidor grava o estado de clientes em `/var/log/openvpn/status.log` usando o formato versão 2, além de registrar eventos em `/var/log/openvpn/server.log`. Esses arquivos servirão como fonte local para projetar um coletor de sessões e contadores; nenhum coletor ou envio para a API está configurado neste primeiro passo.

## Remover o laboratório

`vagrant destroy` remove a VM e os certificados gerados dentro dela. O perfil exportado no hospedeiro não é removido automaticamente; apague `data/openvpn-lab-client.ovpn` quando não precisar mais dele.
