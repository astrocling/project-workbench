/**
 * Plan how Float clients map onto `Account` rows.
 *
 * `Account.name` and `Account.floatClientId` are both unique, so naively
 * upserting on `floatClientId` while writing `name` fails whenever a name is
 * already held by a different account — which happens routinely when a Float
 * client is deleted and re-created (new `client_id`, same name) or when two
 * clients swap names. A failure there aborts the whole sync, so identity is
 * resolved up front and unsatisfiable names are downgraded to warnings.
 */

export type FloatClientRef = {
  floatClientId: number;
  name: string;
};

export type ExistingAccountRef = {
  id: string;
  name: string;
  floatClientId: number | null;
};

export type FloatAccountPlan = {
  /**
   * Point an existing account at a Float client id: either it had none, or its
   * previous id no longer exists in Float (client deleted and re-created).
   */
  binds: Array<{
    accountId: string;
    floatClientId: number;
    previousFloatClientId: number | null;
  }>;
  /** Float clients with no existing account to reuse. */
  creates: Array<{ floatClientId: number; name: string }>;
  /** Existing accounts whose name should follow the Float client name. */
  renames: Array<{ accountId: string; from: string; to: string }>;
  /**
   * True when some rename target is currently held by another account that is
   * itself being renamed, so renames must be staged through temporary names.
   */
  renamesNeedStaging: boolean;
  /** Float client id -> account id, for clients matched to an existing account. */
  resolved: Array<{ floatClientId: number; accountId: string }>;
  /** Non-fatal problems that previously crashed the sync. */
  warnings: string[];
};

/** Float sends names with stray whitespace; empty names still need a stable label. */
export function normalizeFloatClientName(
  name: string | null | undefined,
  floatClientId: number
): string {
  return (name ?? "").trim() || `Float client ${floatClientId}`;
}

export function planFloatClientAccounts(args: {
  floatClients: FloatClientRef[];
  existingAccounts: ExistingAccountRef[];
}): FloatAccountPlan {
  const { floatClients, existingAccounts } = args;

  const warnings: string[] = [];
  const binds: FloatAccountPlan["binds"] = [];
  const creates: FloatAccountPlan["creates"] = [];
  const resolved: FloatAccountPlan["resolved"] = [];

  const liveFloatClientIds = new Set(floatClients.map((c) => c.floatClientId));
  const accountById = new Map(existingAccounts.map((a) => [a.id, a]));
  const accountByFloatClientId = new Map<number, ExistingAccountRef>();
  for (const a of existingAccounts) {
    if (a.floatClientId != null) accountByFloatClientId.set(a.floatClientId, a);
  }
  const accountByName = new Map(existingAccounts.map((a) => [a.name, a]));

  const claimedAccountIds = new Set<string>();
  const pending: FloatClientRef[] = [];

  for (const client of floatClients) {
    const match = accountByFloatClientId.get(client.floatClientId);
    if (match) {
      resolved.push({ floatClientId: client.floatClientId, accountId: match.id });
      claimedAccountIds.add(match.id);
    } else {
      pending.push(client);
    }
  }

  const stillPending: FloatClientRef[] = [];
  for (const client of pending) {
    const byName = accountByName.get(client.name);
    const reusable =
      byName != null &&
      !claimedAccountIds.has(byName.id) &&
      (byName.floatClientId == null || !liveFloatClientIds.has(byName.floatClientId));

    if (!reusable) {
      stillPending.push(client);
      continue;
    }

    binds.push({
      accountId: byName.id,
      floatClientId: client.floatClientId,
      previousFloatClientId: byName.floatClientId,
    });
    resolved.push({ floatClientId: client.floatClientId, accountId: byName.id });
    claimedAccountIds.add(byName.id);
  }

  const nameByFloatClientId = new Map(
    floatClients.map((c) => [c.floatClientId, c.name])
  );

  const desiredNameByAccountId = new Map<string, string>();
  for (const r of resolved) {
    const desired = nameByFloatClientId.get(r.floatClientId);
    if (desired != null) desiredNameByAccountId.set(r.accountId, desired);
  }

  /** Renames are applied before creates, so a name being vacated is free to reuse. */
  const willVacateName = (account: ExistingAccountRef): boolean => {
    const desired = desiredNameByAccountId.get(account.id);
    return desired != null && desired !== account.name;
  };

  const createdNames = new Set<string>();
  for (const client of stillPending) {
    const blocker = accountByName.get(client.name);
    if (blocker && !willVacateName(blocker)) {
      warnings.push(
        `Float client ${client.floatClientId} ("${client.name}") could not be linked: ` +
          `account ${blocker.id} already uses that name and is linked to Float client ${blocker.floatClientId}.`
      );
      continue;
    }
    if (createdNames.has(client.name)) {
      warnings.push(
        `Float client ${client.floatClientId} ("${client.name}") was skipped: ` +
          `another Float client already claimed that account name in this sync.`
      );
      continue;
    }
    createdNames.add(client.name);
    creates.push({ floatClientId: client.floatClientId, name: client.name });
  }

  // Names that cannot move: accounts untouched by this sync, plus new accounts.
  const immovableNames = new Set<string>(createdNames);
  for (const a of existingAccounts) {
    if (!desiredNameByAccountId.has(a.id)) immovableNames.add(a.name);
  }

  const renames: FloatAccountPlan["renames"] = [];
  const takenTargets = new Set<string>();
  for (const [accountId, to] of desiredNameByAccountId) {
    const current = accountById.get(accountId);
    if (!current || current.name === to) continue;

    if (immovableNames.has(to)) {
      warnings.push(
        `Account ${accountId} ("${current.name}") could not be renamed to "${to}": ` +
          `another account already uses that name.`
      );
      continue;
    }
    if (takenTargets.has(to)) {
      warnings.push(
        `Account ${accountId} ("${current.name}") could not be renamed to "${to}": ` +
          `another account in this sync already claims that name.`
      );
      continue;
    }
    takenTargets.add(to);
    renames.push({ accountId, from: current.name, to });
  }

  const namesBeingVacated = new Set(renames.map((r) => r.from));
  const renamesNeedStaging = renames.some((r) => namesBeingVacated.has(r.to));

  return { binds, creates, renames, renamesNeedStaging, resolved, warnings };
}
