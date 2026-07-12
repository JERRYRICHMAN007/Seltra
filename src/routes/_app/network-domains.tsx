import { createFileRoute } from "@tanstack/react-router";
import { Globe, ArrowRightLeft, Search, ShieldCheck } from "lucide-react";
import { PageHeader, Card } from "@/components/ui-bits";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_app/network-domains")({
  head: () => ({ meta: [{ title: "Network & Domains — Seltra Ops" }] }),
  component: NetworkDomainsPage,
});

const actions = [
  {
    title: "Buy a domain",
    description: "Purchase a custom domain for a merchant storefront and attach it to their Seltra store.",
    icon: Globe,
  },
  {
    title: "Transfer a domain",
    description: "Move an existing domain into Seltra management so Ops can control DNS and renewals.",
    icon: ArrowRightLeft,
  },
  {
    title: "Fix DNS",
    description: "Inspect and correct DNS records (A, CNAME, TXT) when storefronts fail to resolve or verify.",
    icon: Search,
  },
  {
    title: "SSL & verification",
    description: "Confirm domain ownership, SSL provisioning, and that HTTPS is healthy for live stores.",
    icon: ShieldCheck,
  },
];

function NetworkDomainsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Network & Domains"
        subtitle="Buy and transfer custom domains for merchant stores, and fix DNS"
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {actions.map((action) => (
          <Card key={action.title}>
            <div className="flex items-start gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary">
                <action.icon className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="text-base font-semibold text-navy">{action.title}</h2>
                <p className="mt-1 text-sm text-muted-foreground">{action.description}</p>
                <Button size="sm" variant="outline" className="mt-4" disabled>
                  Coming soon
                </Button>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <Card title="Merchant domain queue">
        <p className="text-sm text-muted-foreground">
          Domain purchase, transfer, and DNS repair workflows will appear here once connected to the
          registrar and DNS providers.
        </p>
      </Card>
    </div>
  );
}
