"use client";

import { useRouter } from "next/navigation";
import { DateField } from "@/components/ui/date-field";

// Serializable navigation props allow server pages to share this picker.
export function DateJump({ value, basePath, param = "date", label = "თარიღის არჩევა" }: { value: string; basePath: string; param?: string; label?: string }) {
  const router = useRouter();
  return <DateField iconOnly value={value} aria-label={label}
    onChange={next => { if (next) router.push(`${basePath}?${param}=${next}`); }} />;
}
