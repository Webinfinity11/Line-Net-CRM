import { Sidebar } from "@/components/app/sidebar";
import { Topbar } from "@/components/app/topbar";
import { getInboxCount, getUnseenAssignmentCount } from "@/lib/orders";
import { isStaff, requireUser } from "@/lib/session";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const user = await requireUser();
  const staff = isStaff(user.role);
  const [inboxCount, unseenCount] = await Promise.all([
    staff ? getInboxCount() : Promise.resolve(0),
    staff ? Promise.resolve(0) : getUnseenAssignmentCount(user.id),
  ]);

  return (
    <div className="flex min-h-screen bg-neutral-50 dark:bg-neutral-950">
      <Sidebar user={user} inboxCount={inboxCount} unseenCount={unseenCount} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar user={user} inboxCount={inboxCount} unseenCount={unseenCount} />
        <main className="flex-1 px-4 py-4 md:px-6 md:py-6">{children}</main>
      </div>
    </div>
  );
}
