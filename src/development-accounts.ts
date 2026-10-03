export interface DevelopmentAccount {
  id: string;
  minecraft: { uuid: string; name: string };
  displayName: "개발용 계정";
  member: boolean;
  discordLinked: boolean;
  enabled: boolean;
  revision: number;
  createdAt: string;
  updatedAt: string;
  allowedServerIds: string[];
  presence: { online: boolean; serverId: string | null; serverLabel: string | null; lastSeenAt: string | null };
}

export const DEVELOPMENT_PAGE_SIZE = 20;

export function filterDevelopmentAccounts(accounts: DevelopmentAccount[], query: string) {
  const normalized = query.trim().toLowerCase();
  return accounts.filter(account => !normalized || account.minecraft.name.toLowerCase().includes(normalized)
    || account.minecraft.uuid.toLowerCase().includes(normalized));
}

export function validMinecraftName(value: string) {
  return /^[a-zA-Z0-9_]{1,16}$/.test(value.trim());
}
