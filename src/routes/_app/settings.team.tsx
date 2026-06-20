import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";

export const Route = createFileRoute("/_app/settings/team")({
  component: TeamRedirect,
});

function TeamRedirect() {
  const navigate = useNavigate();
  useEffect(() => {
    navigate({ to: "/settings", replace: true });
  }, []);
  return null;
}
