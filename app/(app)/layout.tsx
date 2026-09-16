import { Sidebar } from "@/components/app/sidebar";
import { Topbar } from "@/components/app/topbar";
import { getUnreadCount, listNotifications } from "@/lib/notify";
import { getInboxCount, getUnseenAssignmentCount } from "@/lib/orders";
import { isStaff, requireUser } from "@/lib/session";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const user = await requireUser();
  const staff = isStaff(user.role);
  const [inboxCount, unseenCount, unread, bellItems] = await Promise.all([
    staff ? getInboxCount() : Promise.resolve(0),
    staff ? Promise.resolve(0) : getUnseenAssignmentCount(user.id),
    getUnreadCount(user.id),
    listNotifications(user.id, 8),
  ]);

  return (
    <div className="flex min-h-screen bg-background dark:bg-neutral-950">
      <Sidebar user={user} inboxCount={inboxCount} unseenCount={unseenCount} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar
          user={user}
          inboxCount={inboxCount}
          unseenCount={unseenCount}
          unread={unread}
          bellItems={bellItems.map((n) => ({ id: n.id, title: n.title, body: n.body, readAt: n.readAt, createdAt: n.createdAt, orderId: n.orderId }))}
        />
        <main className="flex-1 px-4 py-4 md:px-6 md:py-6 lg:px-7">{children}</main>
      </div>
    </div>
  );
}
