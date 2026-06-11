import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";

export const Route = createFileRoute("/_app/settings/team")({
  head: () => ({ meta: [{ title: "Team — Seltra Ops" }] }),
  component: TeamRedirectPage,
});

function TeamRedirectPage() {
  const navigate = useNavigate();

  useEffect(() => {
    navigate({ to: "/settings", replace: true });
  }, [navigate]);

  return (
    <div className="text-sm text-muted-foreground font-mono">Redirecting to settings…</div>
  );
}
