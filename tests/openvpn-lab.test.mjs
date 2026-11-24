import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const readLabFile = (name) => readFileSync(new URL(`../lab/openvpn/${name}`, import.meta.url), "utf8");

test("OpenVPN lab is isolated to the host-only network", () => {
  const vagrantfile = readLabFile("Vagrantfile");
  const provision = readLabFile("provision.sh");

  assert.match(vagrantfile, /config\.vm\.define "openvpn-lab"/);
  assert.match(vagrantfile, /private_network", ip: "192\.168\.56\.10"/);
  assert.doesNotMatch(vagrantfile, /forwarded_port|public_network/);
  assert.match(provision, /^local 192\.168\.56\.10$/m);
  assert.match(provision, /^port 1194$/m);
  assert.doesNotMatch(provision, /redirect-gateway/);
});

test("OpenVPN lab keeps generated private material outside the repository", () => {
  const provision = readLabFile("provision.sh");
  const ignore = readFileSync(new URL("../.gitignore", import.meta.url), "utf8");

  assert.match(provision, /client_profile=\/root\/gem-access-demo\.ovpn/);
  assert.match(provision, /chmod 600 "\$client_profile"/);
  assert.match(ignore, /^data\/openvpn-lab-client\.ovpn$/m);
  assert.match(ignore, /^\.vagrant\/$/m);
});
