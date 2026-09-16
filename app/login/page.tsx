import { redirect } from "next/navigation";
import { isMicrosoftLoginEnabled } from "@/lib/auth";
import { getSession } from "@/lib/session";
import { LoginForm } from "./login-form";

export const metadata = { title: "შესვლა" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const session = await getSession();
  const params = await searchParams;
  const next = typeof params.next === "string" && params.next.startsWith("/") ? params.next : "/";
  if (session) redirect(next);

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-sky-50 via-white to-sky-100 p-4 dark:from-neutral-950 dark:via-neutral-950 dark:to-sky-950/30">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-3 flex size-12 items-center justify-center rounded-xl bg-sky-600 text-lg font-bold text-white shadow-lg shadow-sky-600/30">
            LN
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">Line Net CRM</h1>
          <p className="mt-1 text-sm text-muted-foreground">შეკვეთების მართვის სისტემა</p>
        </div>
        <LoginForm next={next} microsoft={isMicrosoftLoginEnabled} />
      </div>
    </main>
  );
}
