import { ProjectId } from "@t3tools/contracts";
import { createFileRoute } from "@tanstack/react-router";

import { ProjectInferenceDashboardPage } from "../components/ProjectInferenceDashboardPage";
import { ProjectOverviewPage } from "../components/ProjectOverviewPage";

function ProjectRouteView() {
  const projectId = Route.useParams({
    select: (params) => ProjectId.makeUnsafe(params.projectId),
  });
  const search = Route.useSearch();

  if (search.view === "inference") {
    return <ProjectInferenceDashboardPage projectId={projectId} />;
  }

  return <ProjectOverviewPage projectId={projectId} />;
}

export const Route = createFileRoute("/_chat/projects/$projectId")({
  validateSearch: (search: Record<string, unknown>) => ({
    view: search.view === "inference" ? "inference" : "management",
  }),
  component: ProjectRouteView,
});
