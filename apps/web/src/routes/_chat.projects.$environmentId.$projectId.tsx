import { createFileRoute } from "@tanstack/react-router";

import { ProjectManagementRouteView } from "~/components/project-management/ProjectManagementRoute";
import {
  parseProjectManagementRouteTarget,
  projectManagementRouteSearch,
} from "~/project-management/projectManagementRoute";

function ProjectRouteView() {
  const params = Route.useParams();
  const search = Route.useSearch();
  const target = parseProjectManagementRouteTarget({
    environmentId: params.environmentId,
    projectId: params.projectId,
    view: search.view,
  });

  return <ProjectManagementRouteView target={target} />;
}

export const Route = createFileRoute("/_chat/projects/$environmentId/$projectId")({
  validateSearch: (search: Record<string, unknown>) => projectManagementRouteSearch(search.view),
  component: ProjectRouteView,
});
