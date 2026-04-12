import { type ProjectId, type ProjectScript } from "@t3tools/contracts";
import { Link } from "@tanstack/react-router";
import { BarChart3Icon, FolderTreeIcon, SquarePenIcon } from "lucide-react";
import { Suspense, lazy } from "react";

import { useHandleNewThread } from "../hooks/useHandleNewThread";
import { schedulePendingProjectScriptRun } from "../projectPendingScriptRun";
import { useServerAvailableEditors, useServerKeybindings } from "../rpc/serverState";
import { useProjectScriptActions } from "../hooks/useProjectScriptActions";
import { ProjectManagementHeader } from "./ProjectManagementHeader";
import { ProjectPageShell } from "./ProjectPageShell";
import { ProjectPanel } from "./ProjectPanel";
import ProjectScriptsControl from "./ProjectScriptsControl";
import { OpenInPicker } from "./chat/OpenInPicker";
import { Button } from "./ui/button";
import { useProjectPageData } from "./useProjectPageData";

const GitPanel = lazy(() => import("./git-panel/GitPanel"));

export function ProjectOverviewPage(props: { projectId: ProjectId }) {
  const { handleNewThread } = useHandleNewThread();
  const keybindings = useServerKeybindings();
  const availableEditors = useServerAvailableEditors();
  const { latestActiveThread, overview, project, repoRoot, workspacePath } = useProjectPageData(
    props.projectId,
  );
  const { deleteProjectScript, saveProjectScript, updateProjectScript } = useProjectScriptActions(
    project ?? undefined,
  );

  const runScriptFromProjectPage = async (script: ProjectScript) => {
    if (!project) {
      return;
    }
    await handleNewThread(project.id, {
      beforeNavigate: (threadId) => {
        schedulePendingProjectScriptRun({
          threadId,
          projectId: project.id,
          scriptId: script.id,
        });
      },
    });
  };

  if (!project || !workspacePath || !repoRoot) {
    return null;
  }

  return (
    <ProjectPageShell title="Project management">
      <ProjectManagementHeader
        faviconCwd={project.cwd}
        projectName={project.name}
        repoSummary={overview.repoSummary}
        workspacePath={workspacePath}
        actions={
          <>
            <Button size="sm" onClick={() => void handleNewThread(project.id)}>
              <SquarePenIcon className="size-3.5" />
              New thread
            </Button>
            <Button
              render={
                <Link
                  to="/projects/$projectId"
                  params={{ projectId: project.id }}
                  search={{ view: "inference" }}
                />
              }
              size="sm"
              variant="outline"
            >
              <BarChart3Icon className="size-3.5" />
              Inference dashboard
            </Button>
            {latestActiveThread ? (
              <Button
                render={<Link to="/$threadId" params={{ threadId: latestActiveThread.id }} />}
                size="sm"
                variant="outline"
              >
                <FolderTreeIcon className="size-3.5" />
                Thread management
              </Button>
            ) : null}
            <OpenInPicker
              keybindings={keybindings}
              availableEditors={availableEditors}
              openInCwd={project.cwd}
            />
            <ProjectScriptsControl
              scripts={project.scripts}
              keybindings={keybindings}
              onRunScript={(script) => {
                void runScriptFromProjectPage(script);
              }}
              onAddScript={saveProjectScript}
              onUpdateScript={updateProjectScript}
              onDeleteScript={deleteProjectScript}
            />
          </>
        }
      />

      <Suspense
        fallback={
          <ProjectPanel contentClassName="flex min-h-[42rem] items-center justify-center text-sm text-muted-foreground">
            Loading Git panel...
          </ProjectPanel>
        }
      >
        <GitPanel
          activeProjectId={project.id}
          activeThreadId={null}
          repoCwd={project.cwd}
          repoRoot={repoRoot}
          workspaceCwd={workspacePath}
        />
      </Suspense>
    </ProjectPageShell>
  );
}
