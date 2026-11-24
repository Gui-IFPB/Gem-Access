function parseCsvRow(line) {
  const fields = [];
  let field = "";
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (character === '"') {
      if (quoted && line[index + 1] === '"') {
        field += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === "," && !quoted) {
      fields.push(field);
      field = "";
    } else {
      field += character;
    }
  }

  if (quoted) throw new Error("Status OpenVPN contém uma linha CSV inválida.");
  fields.push(field);
  return fields;
}

function requiredField(record, name) {
  const value = record[name];
  if (typeof value !== "string" || !value) {
    throw new Error(`Campo obrigatório ausente no status OpenVPN: ${name}.`);
  }
  return value;
}

function parseCounter(record, name) {
  const value = requiredField(record, name);
  if (!/^\d+$/.test(value)) throw new Error(`Contador inválido no status OpenVPN: ${name}.`);
  return BigInt(value);
}

export function parseOpenVpnStatus(content) {
  if (typeof content !== "string" || !content.trim()) {
    throw new Error("Status OpenVPN vazio.");
  }

  const lines = content.trim().split(/\r?\n/);
  const clientHeader = lines.find((line) => line.startsWith("HEADER,CLIENT_LIST,"));
  if (!clientHeader || lines.at(-1) !== "END") {
    throw new Error("Status OpenVPN incompleto ou em formato não suportado.");
  }

  const headers = parseCsvRow(clientHeader).slice(2);
  const rows = lines.filter((line) => line.startsWith("CLIENT_LIST,"));
  return rows.map((line) => {
    const values = parseCsvRow(line).slice(1);
    if (values.length !== headers.length) {
      throw new Error("Linha CLIENT_LIST incompleta no status OpenVPN.");
    }
    const record = Object.fromEntries(headers.map((header, index) => [header, values[index]]));
    const commonName = requiredField(record, "Common Name");
    const realAddress = requiredField(record, "Real Address");
    const vpnAddress = requiredField(record, "Virtual Address");
    const connectedAtEpoch = requiredField(record, "Connected Since (time_t)");
    if (!/^\d+$/.test(connectedAtEpoch) || Number(connectedAtEpoch) > Number.MAX_SAFE_INTEGER / 1000) {
      throw new Error("Horário de conexão inválido no status OpenVPN.");
    }

    const clientId = requiredField(record, "Client ID");
    const peerId = requiredField(record, "Peer ID");
    const connectedAt = new Date(Number(connectedAtEpoch) * 1000);
    if (!Number.isFinite(connectedAt.getTime())) {
      throw new Error("Horário de conexão inválido no status OpenVPN.");
    }

    return {
      sourceSessionId: `${clientId}:${peerId}:${connectedAtEpoch}:${commonName}`,
      commonName,
      realAddress,
      vpnAddress,
      connectedAt,
      bytesReceived: parseCounter(record, "Bytes Received"),
      bytesSent: parseCounter(record, "Bytes Sent")
    };
  });
}
