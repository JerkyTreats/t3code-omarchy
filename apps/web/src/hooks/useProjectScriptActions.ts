import { type KeybindingCommand, type ProjectScript } from "@t3tools/contracts";
import { useCallback } from "react";

import { isElectron } from "../env";
import { newCommandId } from "../lib/utils";
import { readNativeApi } from "../nativeApi";
import { commandForProjectScript, nextProjectScriptId } from "../projectScripts";
import { type Project } from "../types";
import { toastManager } from "../components/ui/toast";
import { decodeProjectScriptKeybindingRule } from "../lib/projectScriptKeybindings";
import { type NewProjectScriptInput } from "../components/ProjectScriptsControl";

export function useProjectScriptActions(project: Project | undefined) {
  const persistProjectScripts = useCallback(
    async (input: {
      nextScripts: ProjectScript[];
      keybinding?: string | null;
      keybindingCommand: KeybindingCommand;
    }) => {
      const api = readNativeApi();
      if (!api || !project) return;

      await api.orchestration.dispatchCommand({
        type: "project.meta.update",
        commandId: newCommandId(),
        projectId: project.id,
        scripts: input.nextScripts,
      });

      const keybindingRule = decodeProjectScriptKeybindingRule({
        keybinding: input.keybinding,
        command: input.keybindingCommand,
      });

      if (isElectron && keybindingRule) {
        await api.server.upsertKeybinding(keybindingRule);
      }
    },
    [project],
  );

  const saveProjectScript = useCallback(
    async (input: NewProjectScriptInput) => {
      if (!project) return;
      const nextId = nextProjectScriptId(
        input.name,
        project.scripts.map((script) => script.id),
      );
      const nextScript: ProjectScript = {
        id: nextId,
        name: input.name,
        command: input.command,
        icon: input.icon,
        runOnWorktreeCreate: input.runOnWorktreeCreate,
      };
      const nextScripts = input.runOnWorktreeCreate
        ? [
            ...project.scripts.map((script) =>
              script.runOnWorktreeCreate ? { ...script, runOnWorktreeCreate: false } : script,
            ),
            nextScript,
          ]
        : [...project.scripts, nextScript];

      await persistProjectScripts({
        nextScripts,
        keybinding: input.keybinding,
        keybindingCommand: commandForProjectScript(nextId),
      });
    },
    [persistProjectScripts, project],
  );

  const updateProjectScript = useCallback(
    async (scriptId: string, input: NewProjectScriptInput) => {
      if (!project) return;
      const existingScript = project.scripts.find((script) => script.id === scriptId);
      if (!existingScript) {
        throw new Error("Script not found.");
      }

      const updatedScript: ProjectScript = {
        ...existingScript,
        name: input.name,
        command: input.command,
        icon: input.icon,
        runOnWorktreeCreate: input.runOnWorktreeCreate,
      };
      const nextScripts = project.scripts.map((script) =>
        script.id === scriptId
          ? updatedScript
          : input.runOnWorktreeCreate
            ? { ...script, runOnWorktreeCreate: false }
            : script,
      );

      await persistProjectScripts({
        nextScripts,
        keybinding: input.keybinding,
        keybindingCommand: commandForProjectScript(scriptId),
      });
    },
    [persistProjectScripts, project],
  );

  const deleteProjectScript = useCallback(
    async (scriptId: string) => {
      if (!project) return;
      const nextScripts = project.scripts.filter((script) => script.id !== scriptId);
      const deletedName = project.scripts.find((script) => script.id === scriptId)?.name;

      try {
        await persistProjectScripts({
          nextScripts,
          keybinding: null,
          keybindingCommand: commandForProjectScript(scriptId),
        });
        toastManager.add({
          type: "success",
          title: `Deleted action "${deletedName ?? "Unknown"}"`,
        });
      } catch (error) {
        toastManager.add({
          type: "error",
          title: "Could not delete action",
          description: error instanceof Error ? error.message : "An unexpected error occurred.",
        });
      }
    },
    [persistProjectScripts, project],
  );

  return {
    deleteProjectScript,
    saveProjectScript,
    updateProjectScript,
  };
}
