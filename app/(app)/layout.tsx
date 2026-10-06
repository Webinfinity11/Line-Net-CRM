import { executorBucket } from "@/lib/workflow-view";
import { Suspense } from "react";
import { count } from "drizzle-orm";
import { db } from "@/db";
import { boardVisibility } from "@/lib/competencies";
import { orders } from "@/db/schema";
import { MobileNav } from "@/components/app/mobile-nav";
import { LiveOrderSync } from "@/components/app/live-order-sync";
import { Sidebar } from "@/components/app/sidebar";
import { SystemsProvider } from "@/components/app/systems-provider";
import { Topbar } from "@/components/app/topbar";
import { notificationLink } from "@/lib/notification-link";
import { getUnreadCount, listNotifications } from "@/lib/notify";
import { getInboxCount, getUnseenAssignmentCount, listMyOrders } from "@/lib/orders";
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
      ? listMyOrders(user.id)
      : Promise.resolve([]),
  ]);

  const [boardCount] = user.role === "executor" ? await db.select({ n: count() }).from(orders).where(await boardVisibility(user)) : [{ n: 0 }];
  const executorCounts = {
    board: boardCount.n,
    new: myStatuses.filter((o) => executorBucket(o, user.id) === "new").length,
    active: myStatuses.filter((o) => executorBucket(o, user.id) === "active").length,
    done: myStatuses.filter((o) => executorBucket(o, user.id) === "done").length,
    closed: Math.min(20, myStatuses.filter((o) => executorBucket(o, user.id) === "closed").length),
  };

  return (
    <SystemsProvider systems={systems}>
    <Suspense fallback={null}><LiveOrderSync /></Suspense>
    <div className="flex min-h-screen bg-background dark:bg-neutral-950">
      <Sidebar user={user} inboxCount={inboxCount} unseenCount={unseenCount} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar
          user={user}
          inboxCount={inboxCount}
          unseenCount={unseenCount}
          unread={unread}
          bellItems={bellItems.map((n) => ({ id: n.id, type: n.type, title: n.title, body: n.body, readAt: n.readAt, createdAt: n.createdAt, orderId: n.orderId, href: notificationLink(user.role, n) }))}
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
