import { Pencil, Plus, UserCheck, UserX, Users } from "lucide-react";
import { createUser, setUserBanned, updateUser } from "@/actions/users";
import { ClientActionsMenu } from "@/components/app/client-actions-menu";
import { ConfirmButton } from "@/components/app/confirm-button";
import { FormDialog } from "@/components/app/form-dialog";
import { PageHeader } from "@/components/app/page-header";
import { Chip, DataList, EmptyState, tableCls } from "@/components/app/section-card";
import { UserAvatar } from "@/components/app/user-avatar";
import { UserFields } from "@/components/app/user-forms";
import { Button } from "@/components/ui/button";
import type { UserRole } from "@/db/schema";
import { ROLE_LABELS, formatDate, t } from "@/lib/i18n";
import { listAllUsers, listClientNames } from "@/lib/orders";
import { systemLabels } from "@/lib/systems";
import { requireUser } from "@/lib/session";
import { cn } from "@/lib/utils";

export const metadata = { title: "მომხმარებლები" };

const ROLE_TONE: Record<string, string> = {
  admin: "bg-[#f1f4f9] text-[#17212b]",
  manager: "bg-[#f1f4f9] text-[#4a5e73]",
  executor: "bg-[#f1f4f9] text-[#617084]",
  client: "bg-[#f1f4f9] text-[#4a5e73]",
};

export default async function UsersPage() {
  const me = await requireUser(["admin"]);
  const [users, clientList, labels] = await Promise.all([listAllUsers(), listClientNames(), systemLabels()]);
  const company = new Map(clientList.map((c) => [c.id, c.name]));
  /** What sits next to the role: a technician's categories, a client's company. */
  const Links = ({ u }: { u: (typeof users)[number] }) =>
    u.role === "client" ? (
      <Chip>{u.clientId ? (company.get(u.clientId) ?? "—") : "კომპანია არ არის მიბმული"}</Chip>
    ) : (
      <>
        {u.specializations.map((k) => (
          <Chip key={k}>{labels[k] ?? k}</Chip>
        ))}
      </>
    );
  const counts = users.reduce(
    (a, u) => ({ ...a, [u.role]: (a[u.role] ?? 0) + 1 }),
    {} as Record<string, number>,
  );

  const RoleChip = ({ role }: { role: string }) => (
    <span className={cn("inline-flex rounded-[6px] px-2 py-[3px] text-[11px] font-medium", ROLE_TONE[role] ?? ROLE_TONE.executor)}>{ROLE_LABELS[role as UserRole] ?? role}</span>
  );
  const Status = ({ banned }: { banned: boolean }) =>
    banned ? (
      <span className="flex items-center gap-1.5 text-[11.5px] text-[#8b98a9]">
        <span className="size-1.5 rounded-full border border-[#8b98a9]" /> დეაქტივირებული
      </span>
    ) : (
      <span className="flex items-center gap-1.5 text-[11.5px] text-[#4a5e73]">
        <span className="size-1.5 rounded-full bg-[#4a5e73]" /> აქტიური
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
        <UserFields initial={u} clients={clientList} />
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
        subtitle={`${users.length} მომხმარებელი · ${counts.admin ?? 0} ადმინი, ${counts.manager ?? 0} მენეჯერი, ${counts.executor ?? 0} შემსრულებელი${counts.client ? `, ${counts.client} კლიენტი` : ""}`}
        actions={
          <FormDialog
            trigger={<Button className="max-md:h-11" />}
            triggerLabel={
              <>
                <Plus className="size-4" /> ახალი მომხმარებელი
              </>
            }
            title="ახალი მომხმარებელი"
            description="მომხმარებელი შევა ელფოსტით და პაროლით. Microsoft-ით შესვლაც შეუძლია, თუ ეს კავშირი გამართულია და ელფოსტა მის Microsoft ანგარიშს ემთხვევა."
            action={createUser}
            submitLabel={t.common.create}
          >
            <UserFields clients={clientList} />
          </FormDialog>
        }
      />

      {users.length === 0 ? (
        <EmptyState icon={Users} message="მომხმარებლები არ არის." className="ln-card border-transparent py-16" />
      ) : (
        <div className={cn(tableCls.wrap, "ln-enter")}>
          <DataList className="px-4 py-2 sm:block md:hidden">
            {users.map((u) => (
              <li key={u.id} className="relative py-3.5 last:pb-0">
                <div className="text-[14px] font-medium leading-snug">
                  <span className={cn("flex items-center gap-2.5 pr-11", u.banned && "opacity-60")}>
                    <UserAvatar name={u.name} image={u.image} size="md" />
                    <span className="min-w-0">
                      <span className="block break-words">
                        {u.name} {u.id === me.id && <span className="text-[11px] font-normal text-muted-foreground">(თქვენ)</span>}
                      </span>
                      <span className="block break-all text-[11.5px] font-normal text-muted-foreground">{u.email}</span>
                    </span>
                  </span>
                </div>
                <div className="mt-1 text-[12px] text-muted-foreground">
                    <div className="flex flex-wrap items-center gap-1.5 pt-1">
                      <RoleChip role={u.role} />
                      <Links u={u} />
                    </div>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pt-1">
                      <span className="tabular">{u.phone ?? "—"}</span>
                      <Status banned={u.banned} />
                    </div>
                </div>
                <div className="absolute right-0 top-3.5">
                  <ClientActionsMenu name={u.name} editTitle="მომხმარებლის რედაქტირება" editAction={updateUser.bind(null, u.id)}
                  secondary={u.id !== me.id ? { label: u.banned ? "აქტივაცია" : "დეაქტივაცია", title: u.banned ? "აქტივაცია" : "დეაქტივაცია", description: u.banned ? "მომხმარებელი კვლავ შეძლებს შესვლას." : "მომხმარებელი ვეღარ შევა სისტემაში. მონაცემები რჩება.", action: setUserBanned.bind(null, u.id, !u.banned) } : undefined}>
                  <UserFields initial={u} clients={clientList} />
                  </ClientActionsMenu>
                </div>
              </li>
            ))}
          </DataList>
          <div className={cn(tableCls.scroll, "hidden md:block")}>
            <table className={tableCls.table}>
              <thead className={tableCls.head}>
                <tr>
                  <th className={tableCls.th}>მომხმარებელი</th>
                  <th className={tableCls.th}>როლი</th>
                  <th className={cn(tableCls.th, "hidden lg:table-cell")}>სპეციალიზაცია / კომპანია</th>
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
                        <UserAvatar name={u.name} image={u.image} size="md" />
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
                      {u.specializations.length || u.role === "client" ? (
                        <span className="flex flex-wrap gap-1">
                          <Links u={u} />
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
