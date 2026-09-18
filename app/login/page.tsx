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
    <main className="ln-signal flex min-h-screen items-center justify-center bg-[#f4f6fa] p-4 dark:bg-neutral-950">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-3 flex size-12 items-center justify-center rounded-[14px] bg-[#16293a] font-heading text-base font-bold text-white shadow-[0_10px_24px_rgba(22,41,58,0.28)]">
            LN
          </div>
          <h1 className="font-heading text-[24px] tracking-[-0.4px]">Line Net CRM</h1>
          <p className="mt-1 text-[13px] text-muted-foreground">სერვისის მართვის სისტემა</p>
        </div>
        <LoginForm next={next} microsoft={isMicrosoftLoginEnabled} />
      </div>
    </main>
  );
}
