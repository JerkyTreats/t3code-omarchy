#!/usr/bin/env node

import * as NodeRuntime from "@effect/platform-node/NodeRuntime";
import * as NodeServices from "@effect/platform-node/NodeServices";
import { Config, Effect, FileSystem, Option, Path } from "effect";
import { Argument, Command, Flag } from "effect/unstable/cli";

export const releasePackageFiles = [
  "apps/server/package.json",
  "apps/desktop/package.json",
  "apps/web/package.json",
  "packages/contracts/package.json",
] as const;

interface UpdateReleasePackageVersionsOptions {
  readonly rootDir?: string | undefined;
}

type PackageJsonRecord = Record<string, unknown> & {
  readonly version?: unknown;
};

const parsePackageJson = (raw: string): PackageJsonRecord => JSON.parse(raw) as PackageJsonRecord;
const encodePackageJson = (value: PackageJsonRecord): string => JSON.stringify(value, null, 2);

export const updateReleasePackageVersions = Effect.fn("updateReleasePackageVersions")(function* (
  version: string,
  options: UpdateReleasePackageVersionsOptions = {},
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const rootDir = path.resolve(options.rootDir ?? process.cwd());
  let changed = false;

  for (const relativePath of releasePackageFiles) {
    const filePath = path.join(rootDir, relativePath);
    const packageJson = parsePackageJson(yield* fs.readFileString(filePath));
    if (packageJson.version === version) {
      continue;
    }

    yield* fs.writeFileString(filePath, `${encodePackageJson({ ...packageJson, version })}\n`);
    changed = true;
  }

  return { changed } as const;
});

const writeChangedOutput = Effect.fn("writeChangedOutput")(function* (
  changed: boolean,
  writeGithubOutput: boolean,
) {
  if (writeGithubOutput) {
    const fs = yield* FileSystem.FileSystem;
    const githubOutputPath = yield* Config.nonEmptyString("GITHUB_OUTPUT");
    yield* fs.writeFileString(githubOutputPath, `changed=${changed}\n`, { flag: "a" });
    return;
  }

  if (!changed) {
    yield* Effect.log("All package.json versions already match release version.");
  }
});

export const updateReleasePackageVersionsCommand = Command.make(
  "update-release-package-versions",
  {
    version: Argument.string("version").pipe(
      Argument.withDescription("Release version to apply to tracked package.json files."),
    ),
    rootDir: Flag.string("root").pipe(
      Flag.withDescription("Repository root to update. Defaults to the current working directory."),
      Flag.optional,
    ),
    githubOutput: Flag.boolean("github-output").pipe(
      Flag.withDescription("Append changed output to GITHUB_OUTPUT instead of logging."),
      Flag.withDefault(false),
    ),
  },
  ({ version, rootDir, githubOutput }) =>
    updateReleasePackageVersions(version, {
      rootDir: Option.getOrUndefined(rootDir),
    }).pipe(Effect.flatMap(({ changed }) => writeChangedOutput(changed, githubOutput))),
).pipe(Command.withDescription("Update tracked release package.json versions for a release cut."));

if (import.meta.main) {
  Command.run(updateReleasePackageVersionsCommand, { version: "0.0.0" }).pipe(
    Effect.scoped,
    Effect.provide(NodeServices.layer),
    NodeRuntime.runMain,
  );
}
