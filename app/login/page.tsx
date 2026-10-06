import Image from "next/image";
import { redirect } from "next/navigation";
import { isMicrosoftLoginEnabled } from "@/lib/auth";
import { getSession } from "@/lib/session";
import { LoginForm } from "./login-form";

export const metadata = { title: "შესვლა" };

/** Only same-origin paths: "//host", "/\host" and schemes would leave the site. */
function safeNext(value: string | string[] | undefined): string {
  if (typeof value !== "string") return "/";
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("\\") || value.includes(":")) return "/";
  return value;
}

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const session = await getSession();
  const params = await searchParams;
  const next = safeNext(params.next);
  if (session) redirect(next);

  return (
    <main className="ln-signal flex min-h-screen items-center justify-center bg-background p-4 dark:bg-neutral-950">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <Image src="/brand/logo.png" alt="ლაინნეტი" width={1372} height={1653} className="mx-auto mb-3 h-[144px] w-auto" preload />
          <h1 className="font-heading text-[24px] tracking-[-0.4px]">Line Net CRM</h1>
          <p className="mt-1 text-[13px] text-muted-foreground">სერვისის მართვის სისტემა</p>
        </div>
        <LoginForm next={next} microsoft={isMicrosoftLoginEnabled} />
      </div>
    </main>
  );
}
