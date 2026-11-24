#!/usr/bin/env bash
set -euo pipefail

export DEBIAN_FRONTEND=noninteractive

apt-get update
apt-get install --yes --no-install-recommends easy-rsa openvpn

if ! ip -4 address show | grep -q "192.168.56.10/"; then
  echo "A interface privada da VM não recebeu 192.168.56.10." >&2
  exit 1
fi

easyrsa_dir=/etc/openvpn/easy-rsa
server_dir=/etc/openvpn/server

install -d -m 700 "$easyrsa_dir"
cp -a /usr/share/easy-rsa/. "$easyrsa_dir/"

if [[ ! -f "$easyrsa_dir/pki/ca.crt" ]]; then
  cd "$easyrsa_dir"
  ./easyrsa --batch init-pki
  EASYRSA_REQ_CN="GEM Access Local Lab CA" ./easyrsa --batch build-ca nopass
  ./easyrsa --batch build-server-full gem-openvpn-server nopass
  ./easyrsa --batch build-client-full gem-access-demo nopass
fi

install -d -m 750 "$server_dir"
install -d -o nobody -g nogroup -m 750 /var/log/openvpn /var/lib/openvpn
install -m 644 "$easyrsa_dir/pki/ca.crt" "$server_dir/ca.crt"
install -m 644 "$easyrsa_dir/pki/issued/gem-openvpn-server.crt" "$server_dir/server.crt"
install -m 600 "$easyrsa_dir/pki/private/gem-openvpn-server.key" "$server_dir/server.key"
if [[ ! -f "$server_dir/ta.key" ]]; then
  openvpn --genkey secret "$server_dir/ta.key"
fi
chmod 600 "$server_dir/ta.key"

cat > "$server_dir/server.conf" <<'EOF'
local 192.168.56.10
port 1194
proto udp4
dev tun
topology subnet
server 10.77.0.0 255.255.255.0
keepalive 10 60
persist-key
persist-tun
user nobody
group nogroup
ca /etc/openvpn/server/ca.crt
cert /etc/openvpn/server/server.crt
key /etc/openvpn/server/server.key
dh none
ecdh-curve prime256v1
tls-crypt /etc/openvpn/server/ta.key
status /var/log/openvpn/status.log 10
status-version 2
log-append /var/log/openvpn/server.log
verb 3
explicit-exit-notify 1
EOF

client_profile=/root/gem-access-demo.ovpn
{
  cat <<'EOF'
client
dev tun
proto udp4
remote 192.168.56.10 1194
nobind
persist-key
persist-tun
remote-cert-tls server
verify-x509-name gem-openvpn-server name
auth-nocache
verb 3
<ca>
EOF
  cat "$easyrsa_dir/pki/ca.crt"
  cat <<'EOF'
</ca>
<cert>
EOF
  sed -n '/BEGIN CERTIFICATE/,/END CERTIFICATE/p' "$easyrsa_dir/pki/issued/gem-access-demo.crt"
  cat <<'EOF'
</cert>
<key>
EOF
  cat "$easyrsa_dir/pki/private/gem-access-demo.key"
  cat <<'EOF'
</key>
<tls-crypt>
EOF
  cat "$server_dir/ta.key"
  cat <<'EOF'
</tls-crypt>
EOF
} > "$client_profile"
chmod 600 "$client_profile"

systemctl enable --now openvpn-server@server
systemctl is-active --quiet openvpn-server@server
