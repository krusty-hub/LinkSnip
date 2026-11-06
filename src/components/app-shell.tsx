import { Link, useRouterState } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { ChartLineUp, LinkSimpleHorizontal, Rows, BookOpenText } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

const nav = [
  { to: "/", label: "Overview", icon: ChartLineUp },
  { to: "/links", label: "Links", icon: Rows },
  { to: "/docs", label: "API reference", icon: BookOpenText },
] as const;

export function Logo() {
  return (
    <Link to="/" className="flex items-center gap-2 font-semibold tracking-tight">
      <span className="grid size-6 place-items-center rounded-sm bg-primary text-primary-foreground">
        <LinkSimpleHorizontal size={14} weight="bold" />
      </span>
      LinkSnip
    </Link>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const path = useRouterState({ select: (s) => s.location.pathname });
  return (
    <div className="min-h-screen md:grid md:grid-cols-[220px_1fr]">
      <aside className="border-b bg-sidebar md:sticky md:top-0 md:h-screen md:border-r md:border-b-0">
        <div className="flex h-14 items-center px-5">
          <Logo />
        </div>
        <nav className="flex gap-1 overflow-x-auto px-3 pb-3 md:flex-col md:pb-0">
          {nav.map(({ to, label, icon: Icon }) => {
            const active = to === "/" ? path === "/" : path.startsWith(to);
            return (
              <Link
                key={to}
                to={to}
                className={cn(
                  "flex items-center gap-2.5 rounded-sm px-2.5 py-1.5 text-sm whitespace-nowrap transition-colors",
                  active
                    ? "bg-sidebar-accent font-medium text-foreground"
                    : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground",
                )}
              >
                <Icon size={16} weight={active ? "bold" : "regular"} />
                {label}
              </Link>
            );
          })}
        </nav>
        <div className="absolute bottom-0 hidden w-[220px] border-t px-5 py-4 md:block">
          <div className="flex items-center gap-2">
            <span className="size-2 rounded-full bg-signal" />
            <p className="text-sm font-medium">LinkSnip Engine</p>
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">Local SQLite · WAL Mode</p>
        </div>
      </aside>
      <main className="min-w-0">{children}</main>
    </div>
  );
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4 border-b px-6 py-5 lg:px-10">
      <div className="min-w-0">
        <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions}
    </header>
  );
}
