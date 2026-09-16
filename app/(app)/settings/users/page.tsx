import { Pencil, Plus } from "lucide-react";
import { createUser, setUserBanned, updateUser } from "@/actions/users";
import { ConfirmButton } from "@/components/app/confirm-button";
import { FormDialog } from "@/components/app/form-dialog";
import { PageHeader } from "@/components/app/page-header";
import { UserAvatar } from "@/components/app/user-avatar";
import { UserFields } from "@/components/app/user-forms";
import { Button } from "@/components/ui/button";
import type { UserRole } from "@/db/schema";
import { ROLE_LABELS, SYSTEM_LABELS, formatDate, t } from "@/lib/i18n";
import { listAllUsers } from "@/lib/orders";
import { requireUser } from "@/lib/session";
import { cn } from "@/lib/utils";

export const metadata = { title: "მომხმარებლები" };

export default async function UsersPage() {
  const me = await requireUser(["admin"]);
  const users = await listAllUsers();

  return (
    <div>
      <PageHeader
        title={t.nav.users}
        subtitle={`${users.length} მომხმარებელი · ადმინი, მენეჯერი, შემსრულებელი`}
        actions={
          <FormDialog
            trigger={<Button className="bg-sky-600 hover:bg-sky-700" />}
            triggerLabel={
              <>
                <Plus className="size-4" /> ახალი მომხმარებელი
              </>
            }
            title="ახალი მომხმარებელი"
            description="მომხმარებელი შევა ელფოსტით და პაროლით. Microsoft ანგარიშით შესვლისას იგივე ელფოსტა უნდა ემთხვეოდეს."
            action={createUser}
            submitLabel={t.common.create}
          >
            <UserFields />
          </FormDialog>
        }
      />
      <div className="overflow-x-auto rounded-xl border bg-white dark:bg-neutral-900">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-xs text-muted-foreground">
              <th className="px-4 py-2.5 font-medium">მომხმარებელი</th>
              <th className="px-3 py-2.5 font-medium">როლი</th>
              <th className="px-3 py-2.5 font-medium">სპეციალიზაცია</th>
              <th className="px-3 py-2.5 font-medium">ტელეფონი</th>
              <th className="px-3 py-2.5 font-medium">სტატუსი</th>
              <th className="px-3 py-2.5 font-medium">დამატებულია</th>
              <th className="px-3 py-2.5 text-right font-medium">{t.common.actions}</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className={cn("border-b last:border-0", u.banned && "opacity-60")}>
                <td className="px-4 py-2.5">
                  <div className="flex items-center gap-2.5">
                    <UserAvatar name={u.name} image={u.image} size="md" />
                    <div>
                      <div className="font-medium">
                        {u.name} {u.id === me.id && <span className="text-xs text-muted-foreground">(თქვენ)</span>}
                      </div>
                      <div className="text-xs text-muted-foreground">{u.email}</div>
                    </div>
                  </div>
                </td>
                <td className="px-3 py-2.5">
                  <span
                    className={cn(
                      "rounded-md px-2 py-0.5 text-xs font-medium",
                      u.role === "admin" ? "bg-rose-100 text-rose-800" : u.role === "manager" ? "bg-violet-100 text-violet-800" : "bg-neutral-100 text-neutral-700",
                    )}
                  >
                    {ROLE_LABELS[u.role as UserRole] ?? u.role}
                  </span>
                </td>
                <td className="max-w-[260px] px-3 py-2.5 text-xs text-muted-foreground">
                  {u.specializations.length ? u.specializations.map((k) => SYSTEM_LABELS[k as keyof typeof SYSTEM_LABELS] ?? k).join(", ") : "—"}
                </td>
                <td className="px-3 py-2.5">{u.phone ?? "—"}</td>
                <td className="px-3 py-2.5">
                  {u.banned ? <span className="text-xs text-rose-600">დეაქტივირებული</span> : <span className="text-xs text-emerald-600">აქტიური</span>}
                </td>
                <td className="px-3 py-2.5 text-xs text-muted-foreground">{formatDate(u.createdAt)}</td>
                <td className="px-3 py-2.5">
                  <div className="flex justify-end gap-1">
                    <FormDialog trigger={<Button variant="ghost" size="icon-xs" aria-label="რედაქტირება" />} triggerLabel={<Pencil className="size-3.5" />} title="მომხმარებლის რედაქტირება" action={updateUser.bind(null, u.id)}>
                      <UserFields initial={u} />
                    </FormDialog>
                    {u.id !== me.id && (
                      <ConfirmButton
                        title={u.banned ? "აქტივაცია" : "დეაქტივაცია"}
                        description={u.banned ? "მომხმარებელი კვლავ შეძლებს შესვლას." : "მომხმარებელი ვეღარ შევა სისტემაში. მონაცემები რჩება."}
                        confirmLabel={u.banned ? "აქტივაცია" : "დეაქტივაცია"}
                        variant={u.banned ? "outline" : "destructive"}
                        size="xs"
                        action={setUserBanned.bind(null, u.id, !u.banned)}
                      >
                        {u.banned ? "აქტივაცია" : "დეაქტივაცია"}
                      </ConfirmButton>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
