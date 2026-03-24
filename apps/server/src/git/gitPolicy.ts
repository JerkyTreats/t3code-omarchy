export interface ResolvePublishRemoteNameInput {
  readonly branchPushRemote: string | null;
  readonly pushDefaultRemote: string | null;
  readonly primaryRemoteName: string | null;
}

export function isProtectedRemoteName(remoteName: string | null | undefined): boolean {
  return remoteName?.trim().toLowerCase() === "upstream";
}

export function selectPrimaryRemoteName(remoteNames: ReadonlyArray<string>): string | null {
  if (remoteNames.includes("origin")) {
    return "origin";
  }

  return remoteNames[0] ?? null;
}

export function resolvePublishRemoteName(input: ResolvePublishRemoteNameInput): string | null {
  const branchPushRemote = input.branchPushRemote?.trim() ?? "";
  if (branchPushRemote.length > 0) {
    return branchPushRemote;
  }

  const pushDefaultRemote = input.pushDefaultRemote?.trim() ?? "";
  if (pushDefaultRemote.length > 0) {
    return pushDefaultRemote;
  }

  return input.primaryRemoteName;
}

export function buildBlockedPushDetail(): string {
  return "Push to the upstream remote is blocked. Push to the fork remote instead.";
}

export function buildBlockedPullDetail(): string {
  return "Pull from the upstream remote is blocked in the Git UI. Use the upstream sync workflow instead.";
}
