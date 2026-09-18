import { Pencil, Plus, UserCheck, UserX, Users } from "lucide-react";
import { createUser, setUserBanned, updateUser } from "@/actions/users";
import { ConfirmButton } from "@/components/app/confirm-button";
import { FormDialog } from "@/components/app/form-dialog";
import { PageHeader } from "@/components/app/page-header";
import { Chip, DataList, DataRow, EmptyState, tableCls } from "@/components/app/section-card";
import { UserAvatar } from "@/components/app/user-avatar";
import { UserFields } from "@/components/app/user-forms";
import { Button } from "@/components/ui/button";
import type { UserRole } from "@/db/schema";
import { ROLE_LABELS, SYSTEM_LABELS, formatDate, t } from "@/lib/i18n";
import { listAllUsers } from "@/lib/orders";
import { requireUser } from "@/lib/session";
import { cn } from "@/lib/utils";

export const metadata = { title: "მომხმარებლები" };

const ROLE_TONE: Record<string, string> = {
  admin: "bg-[#fdeeee] text-[#a33f3f]",
  manager: "bg-[#f0ecfc] text-[#7251ad]",
  executor: "bg-[#f1f4f9] text-[#617084]",
};

export default async function UsersPage() {
  const me = await requireUser(["admin"]);
  const users = await listAllUsers();
  const counts = users.reduce(
    (a, u) => ({ ...a, [u.role]: (a[u.role] ?? 0) + 1 }),
    {} as Record<string, number>,
  );

  const RoleChip = ({ role }: { role: string }) => (
    <span className={cn("inline-flex rounded-[6px] px-2 py-[3px] text-[11px] font-medium", ROLE_TONE[role] ?? ROLE_TONE.executor)}>{ROLE_LABELS[role as UserRole] ?? role}</span>
  );
  const Status = ({ banned }: { banned: boolean }) =>
    banned ? (
      <span className="flex items-center gap-1.5 text-[11.5px] text-[#b13f32]">
        <span className="size-1.5 rounded-full bg-[#b13f32]" /> დეაქტივირებული
      </span>
    ) : (
      <span className="flex items-center gap-1.5 text-[11.5px] text-[#25815a]">
        <span className="size-1.5 rounded-full bg-[#25815a]" /> აქტიური
      </span>
    );
  const Actions = ({ u, labelled = false }: { u: (typeof users)[number]; labelled?: boolean }) => (
    <>
      <FormDialog
        trigger={<Button variant="ghost" size={labelled ? "sm" : "icon-xs"} className={labelled ? "h-10" : undefined} aria-label="რედაქტირება" />}
        triggerLabel={labelled ? <><Pencil className="size-3.5" /> რედაქტირება</> : <Pencil className="size-3.5" />}
        title="მომხმარებლის რედაქტირება"
        action={updateUser.bind(null, u.id)}
      >
        <UserFields initial={u} />
      </FormDialog>
      {u.id !== me.id && (
        <ConfirmButton
          title={u.banned ? "აქტივაცია" : "დეაქტივაცია"}
          description={u.banned ? "მომხმარებელი კვლავ შეძლებს შესვლას." : "მომხმარებელი ვეღარ შევა სისტემაში. მონაცემები რჩება."}
          confirmLabel={u.banned ? "აქტივაცია" : "დეაქტივაცია"}
          variant="ghost"
          size={labelled ? "sm" : "xs"}
          // deactivating is reversible, so it stays neutral; red is reserved for problems
          className={cn(labelled && "h-10", u.banned ? "text-[#25815a]" : "text-muted-foreground hover:text-[#b13f32]")}
          action={setUserBanned.bind(null, u.id, !u.banned)}
        >
          {u.banned ? <UserCheck className="size-3.5" /> : <UserX className="size-3.5" />}
          {labelled ? <span>{u.banned ? "აქტივაცია" : "დეაქტივაცია"}</span> : <span className="sr-only">{u.banned ? "აქტივაცია" : "დეაქტივაცია"}</span>}
        </ConfirmButton>
      )}
    </>
  );

  return (
    <div className="space-y-4">
      <PageHeader
        title={t.nav.users}
        subtitle={`${users.length} მომხმარებელი · ${counts.admin ?? 0} ადმინი, ${counts.manager ?? 0} მენეჯერი, ${counts.executor ?? 0} შემსრულებელი`}
        actions={
          <FormDialog
            trigger={<Button />}
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

      {users.length === 0 ? (
        <EmptyState icon={Users} message="მომხმარებლები არ არის." className="ln-card border-transparent py-16" />
      ) : (
        <div className={cn(tableCls.wrap, "ln-enter")}>
          <DataList className="px-4 py-2">
            {users.map((u) => (
              <DataRow
                key={u.id}
                title={
                  <span className={cn("flex items-center gap-2.5", u.banned && "opacity-60")}>
                    <UserAvatar name={u.name} image={u.image} size="md" tone="color" />
                    <span className="min-w-0">
                      <span className="block truncate">
                        {u.name} {u.id === me.id && <span className="text-[11px] font-normal text-muted-foreground">(თქვენ)</span>}
                      </span>
                      <span className="block truncate text-[11.5px] font-normal text-muted-foreground">{u.email}</span>
                    </span>
                  </span>
                }
                meta={
                  <>
                    <div className="flex flex-wrap items-center gap-1.5 pt-1">
                      <RoleChip role={u.role} />
                      {u.specializations.map((k) => (
                        <Chip key={k}>{SYSTEM_LABELS[k as keyof typeof SYSTEM_LABELS] ?? k}</Chip>
                      ))}
                    </div>
                    <div className="flex items-center gap-3 pt-1">
                      <span className="tabular">{u.phone ?? "—"}</span>
                      <Status banned={u.banned} />
                    </div>
                  </>
                }
                actions={<Actions u={u} labelled />}
              />
            ))}
          </DataList>
          <div className={cn(tableCls.scroll, "hidden sm:block")}>
            <table className={tableCls.table}>
              <thead className={tableCls.head}>
                <tr>
                  <th className={tableCls.th}>მომხმარებელი</th>
                  <th className={tableCls.th}>როლი</th>
                  <th className={cn(tableCls.th, "hidden lg:table-cell")}>სპეციალიზაცია</th>
                  <th className={cn(tableCls.th, "hidden md:table-cell")}>ტელეფონი</th>
                  <th className={cn(tableCls.th, "hidden sm:table-cell")}>სტატუსი</th>
                  <th className={cn(tableCls.th, "hidden xl:table-cell")}>დამატებულია</th>
                  <th className={tableCls.thRight}>{t.common.actions}</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className={cn(tableCls.row, u.banned && "opacity-55")}>
                    <td className={tableCls.td}>
                      <div className="flex items-center gap-3">
                        <UserAvatar name={u.name} image={u.image} size="md" tone="color" />
                        <div className="min-w-0">
                          <div className="font-medium">
                            {u.name} {u.id === me.id && <span className="text-[11px] font-normal text-muted-foreground">(თქვენ)</span>}
                          </div>
                          <div className="truncate text-[11px] text-muted-foreground">{u.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className={tableCls.td}>
                      <RoleChip role={u.role} />
                    </td>
                    <td className={cn(tableCls.td, "hidden max-w-[280px] lg:table-cell")}>
                      {u.specializations.length ? (
                        <span className="flex flex-wrap gap-1">
                          {u.specializations.map((k) => (
                            <Chip key={k}>{SYSTEM_LABELS[k as keyof typeof SYSTEM_LABELS] ?? k}</Chip>
                          ))}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className={cn(tableCls.td, "hidden whitespace-nowrap tabular md:table-cell")}>{u.phone ?? "—"}</td>
                    <td className={cn(tableCls.td, "hidden sm:table-cell")}>
                      <Status banned={u.banned} />
                    </td>
                    <td className={cn(tableCls.td, "hidden whitespace-nowrap text-[11px] text-muted-foreground xl:table-cell")}>{formatDate(u.createdAt)}</td>
                    <td className={cn(tableCls.td, "text-right")}>
                      <div className="flex justify-end gap-1">
                        <Actions u={u} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
