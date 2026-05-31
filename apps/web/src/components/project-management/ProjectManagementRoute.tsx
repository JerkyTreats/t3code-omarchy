import type { ProjectManagementRouteTarget } from "~/project-management/projectManagementTypes";
import { ProjectInferenceDashboardPage } from "./ProjectInferenceDashboardPage";
import { ProjectManagementPage } from "./ProjectManagementPage";

interface ProjectManagementRouteProps {
  readonly target: ProjectManagementRouteTarget;
}

export function ProjectManagementRouteView({ target }: ProjectManagementRouteProps) {
  if (target.view === "inference") {
    return (
      <ProjectInferenceDashboardPage
        environmentId={target.environmentId}
        projectId={target.projectId}
      />
    );
  }

  return (
    <ProjectManagementPage environmentId={target.environmentId} projectId={target.projectId} />
  );
}
