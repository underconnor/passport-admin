export const normalizeServerCommandName = (value: string) => value.normalize("NFC").toLowerCase();

export function serverCommandNameError(value: string, serverId: string, servers: readonly { id: string; commandName?: string }[]): string | null {
  const name = normalizeServerCommandName(value);
  if (!name) return "이동 명령어 이름을 입력해 주세요.";
  if (!/^[a-z0-9가-힣_-]{1,64}$/.test(name)) return "한글, 영문, 숫자, 밑줄(_), 하이픈(-)을 공백 없이 1~64자로 입력해 주세요.";
  if (servers.some(server => server.id !== serverId && (server.id === name || normalizeServerCommandName(server.commandName ?? server.id) === name))) {
    return "다른 서버의 이동 명령어 이름이나 내부 ID와 겹칩니다. 다른 이름을 입력해 주세요.";
  }
  return null;
}
