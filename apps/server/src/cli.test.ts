import * as NodeServices from "@effect/platform-node/NodeServices";
import { NetService } from "@t3tools/shared/Net";
import { assert, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as CliError from "effect/unstable/cli/CliError";
import { Command } from "effect/unstable/cli";

import { cli } from "./cli.ts";

const CliRuntimeLayer = Layer.mergeAll(NodeServices.layer, NetService.layer);

it.layer(NodeServices.layer)("cli log-level parsing", (it) => {
  it.effect(
    "accepts the built-in lowercase log-level flag values",
    () =>
      Effect.provide(
        Command.runWith(cli, { version: "0.0.0" })(["--log-level", "debug", "--version"]),
        CliRuntimeLayer,
      ) as any,
  );

  it.effect("rejects invalid log-level casing before launching the server", () =>
    Effect.gen(function* () {
      const error = yield* Command.runWith(cli, { version: "0.0.0" })([
        "--log-level",
        "Debug",
      ]).pipe((effect) => Effect.provide(effect, CliRuntimeLayer), Effect.flip);

      if (!CliError.isCliError(error)) {
        assert.fail(`Expected CliError, got ${String(error)}`);
      }
      if (error._tag !== "InvalidValue") {
        assert.fail(`Expected InvalidValue, got ${error._tag}`);
      }
      assert.equal(error.option, "log-level");
      assert.equal(error.value, "Debug");
    }),
  );
});
