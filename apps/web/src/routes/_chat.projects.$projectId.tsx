import { ProjectId } from "@t3tools/contracts";
import { createFileRoute } from "@tanstack/react-router";

import { ProjectOverviewPage } from "../components/ProjectOverviewPage";

function ProjectRouteView() {
  const projectId = Route.useParams({
    select: (params) => ProjectId.makeUnsafe(params.projectId),
  });

  return <ProjectOverviewPage projectId={projectId} />;
}

export const Route = createFileRoute("/_chat/projects/$projectId")({
  component: ProjectRouteView,
});
