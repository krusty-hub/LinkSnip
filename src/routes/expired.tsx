import { createFileRoute, Link } from "@tanstack/react-router";
import { Logo } from "@/components/app-shell";

export const Route = createFileRoute("/expired")({
  head: () => ({
    meta: [
      { title: "This link has expired — LinkSnip" },
      { name: "description", content: "The short link you followed is no longer active." },
      { property: "og:title", content: "This link has expired — LinkSnip" },
      { property: "og:description", content: "The short link you followed is no longer active." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Expired,
});

function Expired() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="px-8 py-6">
        <Logo />
      </header>
      <div className="flex flex-1 items-center px-8">
        <div className="max-w-md">
          <p className="num text-sm text-muted-foreground">404 · Link expired</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight">
            This link is no longer active.
          </h1>
          <p className="mt-3 text-muted-foreground">
            The owner set it to expire, or it was removed. If you were expecting something here,
            contact the person who shared it.
          </p>
          <Link
            to="/"
            className="mt-8 inline-flex h-10 items-center rounded-sm bg-primary px-4 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            Go to LinkSnip
          </Link>
        </div>
      </div>
    </div>
  );
}
