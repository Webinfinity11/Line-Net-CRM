import { Suspense } from "react";
import { and, asc, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { orders } from "@/db/schema";
import { MobileNav } from "@/components/app/mobile-nav";
import { Sidebar } from "@/components/app/sidebar";
import { SystemsProvider } from "@/components/app/systems-provider";
import { Topbar } from "@/components/app/topbar";
import { getUnreadCount, listNotifications } from "@/lib/notify";
import { getInboxCount, getUnseenAssignmentCount } from "@/lib/orders";
import { isStaff, requireUser } from "@/lib/session";
import { listSystems } from "@/lib/systems";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const user = await requireUser();
  const staff = isStaff(user.role);
  const [inboxCount, unseenCount, unread, bellItems, systems, myStatuses] = await Promise.all([
    staff ? getInboxCount() : Promise.resolve(0),
    staff ? Promise.resolve(0) : getUnseenAssignmentCount(user.id),
    getUnreadCount(user.id),
    listNotifications(user.id, 8),
    listSystems(),
    user.role === "executor"
      ? db.select({ status: orders.status }).from(orders).where(and(
          eq(orders.triaged, true),
          sql`exists (select 1 from order_assignees oa where oa.order_id = ${orders.id} and oa.user_id = ${user.id})`,
        )).orderBy(asc(orders.scheduledAt), desc(orders.createdAt)).limit(300)
      : Promise.resolve([]),
  ]);

  const executorCounts = {
    new: myStatuses.filter((o) => o.status === "new" || o.status === "assigned").length,
    active: myStatuses.filter((o) => o.status === "in_progress").length,
    done: myStatuses.filter((o) => o.status === "done").length,
    closed: Math.min(20, myStatuses.filter((o) => o.status === "closed" || o.status === "cancelled").length),
  };

  return (
    <SystemsProvider systems={systems}>
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
        {/* a client's bar lifts its round "new" button 22px above the bar, so the page ends that much higher */}
        <main
          className={`flex-1 px-4 pt-4 md:px-6 md:pb-6 md:pt-6 lg:px-7 ${user.role === "client" ? "pb-[calc(100px+env(safe-area-inset-bottom,0px))]" : "pb-[calc(76px+env(safe-area-inset-bottom,0px))]"}`}
        >
          {children}
        </main>
        <Suspense fallback={null}>
          <MobileNav user={user} inboxCount={inboxCount} unseenCount={unseenCount} executorCounts={executorCounts} />
        </Suspense>
      </div>
    </div>
    </SystemsProvider>
  );
}
