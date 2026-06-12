import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/_app/merchants")({
  component: MerchantsLayout,
});

function MerchantsLayout() {
  return <Outlet />;
}
