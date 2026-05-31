import type { KeybindingCommand, ProjectId, ProjectScript } from "@t3tools/contracts";
import { useCallback } from "react";

import type { NewProjectScriptInput } from "~/components/ProjectScriptsControl";
import { isElectron } from "~/env";
import { readEnvironmentApi } from "~/environmentApi";
import { readLocalApi } from "~/localApi";
import { commandForProjectScript, nextProjectScriptId } from "~/projectScripts";
import { decodeProjectScriptKeybindingRule } from "~/lib/projectScriptKeybindings";
import { newCommandId } from "~/lib/utils";
import type { ProjectManagementProject } from "../projectManagementTypes";

export function useProjectManagementScriptActions(project: ProjectManagementProject | null) {
  const persistProjectScripts = useCallback(
    async (input: {
      readonly projectId: ProjectId;
      readonly nextScripts: ProjectScript[];
      readonly keybinding?: string | null;
      readonly keybindingCommand: KeybindingCommand;
    }) => {
      if (!project) {
        return;
      }
      const api = readEnvironmentApi(project.environmentId);
      if (!api) {
        throw new Error("Project API unavailable.");
      }

      await api.orchestration.dispatchCommand({
        type: "project.meta.update",
        commandId: newCommandId(),
        projectId: input.projectId,
        scripts: input.nextScripts,
      });

      const keybindingRule = decodeProjectScriptKeybindingRule({
        keybinding: input.keybinding,
        command: input.keybindingCommand,
      });

      if (isElectron && keybindingRule) {
        const localApi = readLocalApi();
        if (!localApi) {
          throw new Error("Local API unavailable.");
        }
        await localApi.server.upsertKeybinding(keybindingRule);
      }
    },
    [project],
  );

  const saveProjectScript = useCallback(
    async (input: NewProjectScriptInput) => {
      if (!project) {
        return;
      }
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
        projectId: project.id,
        nextScripts,
        keybinding: input.keybinding,
        keybindingCommand: commandForProjectScript(nextId),
      });
    },
    [persistProjectScripts, project],
  );

  const updateProjectScript = useCallback(
    async (scriptId: string, input: NewProjectScriptInput) => {
      if (!project) {
        return;
      }
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
        projectId: project.id,
        nextScripts,
        keybinding: input.keybinding,
        keybindingCommand: commandForProjectScript(scriptId),
      });
    },
    [persistProjectScripts, project],
  );

  const deleteProjectScript = useCallback(
    async (scriptId: string) => {
      if (!project) {
        return;
      }
      await persistProjectScripts({
        projectId: project.id,
        nextScripts: project.scripts.filter((script) => script.id !== scriptId),
        keybinding: null,
        keybindingCommand: commandForProjectScript(scriptId),
      });
    },
    [persistProjectScripts, project],
  );

  return {
    deleteProjectScript,
    saveProjectScript,
    updateProjectScript,
  };
}
