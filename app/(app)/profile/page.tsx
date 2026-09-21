import { eq } from "drizzle-orm";
import { PageHeader } from "@/components/app/page-header";
import { ProfileForms } from "@/components/app/profile-forms";
import { Chip } from "@/components/app/section-card";
import { UserAvatar } from "@/components/app/user-avatar";
import { db } from "@/db";
import { user } from "@/db/schema";
import { ROLE_LABELS, t } from "@/lib/i18n";
import { requireUser } from "@/lib/session";
import { systemLabels } from "@/lib/systems";

export const metadata = { title: "პროფილი" };

export default async function ProfilePage() {
  const me = await requireUser();
  const [[row], labels] = await Promise.all([db.select({ specializations: user.specializations }).from(user).where(eq(user.id, me.id)), systemLabels()]);
  return (
    <div className="max-w-4xl space-y-4">
      <PageHeader title={t.nav2.profile} subtitle={me.email} />

      <div className="ln-card ln-enter flex flex-wrap items-center gap-4 p-6">
        <UserAvatar name={me.name} image={me.image} size="lg" tone="color" />
        <div className="min-w-0">
          <div className="font-heading text-[16px] font-semibold">{me.name}</div>
          <div className="text-[12.5px] text-muted-foreground">{ROLE_LABELS[me.role]}</div>
          {row?.specializations?.length ? (
            <div className="mt-2 flex flex-wrap gap-1">
              {row.specializations.map((k) => (
                <Chip key={k}>{labels[k] ?? k}</Chip>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      <ProfileForms name={me.name} phone={me.phone ?? ""} />
    </div>
  );
}
