"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { markAssignmentSeen } from "@/actions/orders";

export function MarkSeen({ orderId }: { orderId: number }) {
  const router = useRouter();
  useEffect(() => {
    markAssignmentSeen(orderId).then(() => router.refresh());
  }, [orderId, router]);
  return null;
}
