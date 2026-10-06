import "server-only";
import { sql } from "drizzle-orm";
import { db } from "@/db";

/**
 * A permission-scoped fingerprint, not order data. PostgreSQL row versions also
 * catch writes that forget updatedAt, deletions, and assignment-only changes.
 * One statement sees one committed snapshot on every app instance; no in-memory
 * event bus or notification delivery is required for synchronization.
 */
export async function orderSyncRevision(userId: string): Promise<string | null> {
  const result = await db.execute<{ revision: string }>(sql`
    with person as (
      select id, role, client_id from "user"
      where id = ${userId} and coalesce(banned, false) = false
    ), visible_orders as materialized (
      select o.id, o.xmin::text as version from orders o, person p
      where p.role in ('admin', 'manager')
        or (p.role = 'client' and o.client_id = p.client_id)
        or (p.role = 'executor' and (
          (o.triaged and o.status in ('new', 'assigned', 'in_progress', 'done'))
          or exists (select 1 from order_assignees a where a.order_id = o.id and a.user_id = p.id)
        ))
    ), versions as (
      select 'order:' || id as key, version from visible_orders
      union all select 'assignee:' || a.order_id || ':' || a.user_id, a.xmin::text
        from order_assignees a join visible_orders o on o.id = a.order_id
      union all select 'visit:' || v.id, v.xmin::text
        from order_visits v join visible_orders o on o.id = v.order_id
      union all select 'request:' || r.id, r.xmin::text
        from order_requests r join visible_orders o on o.id = r.order_id
      union all select 'event:' || e.id, e.xmin::text
        from order_events e join visible_orders o on o.id = e.order_id
      union all select 'checklist:' || c.id, c.xmin::text
        from order_checklist_items c join visible_orders o on o.id = c.order_id
      union all select 'notification:' || n.id, n.xmin::text
        from notifications n join person p on p.id = n.user_id
    )
    select md5(p.id || ':' || p.role || ':' || coalesce(p.client_id::text, '') || ':' ||
      coalesce((select string_agg(key || ':' || version, ',' order by key) from versions), '')) as revision
    from person p
  `);
  return result.rows[0]?.revision ?? null;
}
