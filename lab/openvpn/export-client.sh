#!/usr/bin/env bash
set -euo pipefail

project_root="$(cd -- "$(dirname -- "$0")/../.." && pwd)"
cd "$project_root/lab/openvpn"

if ! command -v vagrant >/dev/null 2>&1; then
  echo "Vagrant não está instalado." >&2
  exit 1
fi

profile="$project_root/data/openvpn-lab-client.ovpn"
temporary_profile="$(mktemp "$project_root/data/.openvpn-lab-client.XXXXXX")"
trap 'rm -f "$temporary_profile"' EXIT

vagrant ssh openvpn-lab -c "sudo cat /root/gem-access-demo.ovpn" > "$temporary_profile"
chmod 600 "$temporary_profile"
mv "$temporary_profile" "$profile"
trap - EXIT

printf 'Perfil de demonstração salvo em %s com permissão restrita.\n' "$profile"
