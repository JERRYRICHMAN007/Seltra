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
      {
        rel: "stylesheet",
        href: "https://cdn.jsdelivr.net/npm/geist@1.3.1/dist/fonts/geist-sans/style.min.css",
      },
      {
        rel: "stylesheet",
        href: "https://cdn.jsdelivr.net/npm/geist@1.3.1/dist/fonts/geist-mono/style.min.css",
      },
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
    <html lang="en" className="dark">
      <head>
        <HeadContent />
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('theme');if(t==='light')document.documentElement.classList.remove('dark');else document.documentElement.classList.add('dark');}catch(e){}})();`,
          }}
        />
        {supabaseConfig ? (
          <script
            dangerouslySetInnerHTML={{
              __html: `window.__SUPABASE_CONFIG__=${JSON.stringify(supabaseConfig)}`,
            }}
          />
        ) : null}
      </head>
      <body className="font-sans antialiased">{children}<Scripts /></body>
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
