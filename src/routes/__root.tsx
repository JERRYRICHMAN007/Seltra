import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Outlet, createRootRouteWithContext, HeadContent, Scripts } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { Toaster } from "@/components/ui/sonner";
import { getServerSupabasePublicConfig } from "@/lib/supabase-public-env";
import appCss from "../styles.css?url";

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Seltra Ops — Internal Command Center" },
      { name: "description", content: "Internal operations platform for the Seltra commerce team." },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: () => (
    <div className="min-h-screen grid place-items-center bg-background">
      <div className="text-center">
        <div className="text-5xl font-mono text-navy">404</div>
        <div className="text-sm text-muted-foreground mt-2">Page not found</div>
      </div>
    </div>
  ),
});

function RootShell({ children }: { children: ReactNode }) {
  const supabaseConfig = getServerSupabasePublicConfig();

  return (
    <html lang="en">
      <head>
        <HeadContent />
        {supabaseConfig ? (
          <script
            dangerouslySetInnerHTML={{
              __html: `window.__SUPABASE_CONFIG__=${JSON.stringify(supabaseConfig)}`,
            }}
          />
        ) : null}
      </head>
      <body>{children}<Scripts /></body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  return (
    <QueryClientProvider client={queryClient}>
      <Outlet />
      <Toaster />
    </QueryClientProvider>
  );
}
