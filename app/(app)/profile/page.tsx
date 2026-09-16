import { PageHeader } from "@/components/app/page-header";
import { ProfileForms } from "@/components/app/profile-forms";
import { UserAvatar } from "@/components/app/user-avatar";
import { ROLE_LABELS, SYSTEM_LABELS, t } from "@/lib/i18n";
import { requireUser } from "@/lib/session";
import { db } from "@/db";
import { user } from "@/db/schema";
import { eq } from "drizzle-orm";

export const metadata = { title: "პროფილი" };

export default async function ProfilePage() {
  const me = await requireUser();
  const [row] = await db.select({ specializations: user.specializations }).from(user).where(eq(user.id, me.id));
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title={t.nav2.profile} subtitle={me.email} />
      <div className="mb-4 flex items-center gap-3 rounded-xl border bg-white p-4 dark:bg-neutral-900">
        <UserAvatar name={me.name} image={me.image} size="lg" />
        <div>
          <div className="font-semibold">{me.name}</div>
          <div className="text-sm text-muted-foreground">{ROLE_LABELS[me.role]}</div>
          {row?.specializations?.length ? (
            <div className="mt-0.5 text-xs text-muted-foreground">{row.specializations.map((k) => SYSTEM_LABELS[k as keyof typeof SYSTEM_LABELS] ?? k).join(", ")}</div>
          ) : null}
        </div>
      </div>
      <ProfileForms name={me.name} phone={me.phone ?? ""} />
    </div>
  );
}
