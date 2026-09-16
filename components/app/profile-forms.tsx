"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { updateProfile } from "@/actions/notifications";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth-client";

export function ProfileForms({ name, phone }: { name: string; phone: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [pw, setPw] = useState({ current: "", next: "", confirm: "" });

  function saveProfile(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    start(async () => {
      const res = await updateProfile(fd);
      if (!res.ok) toast.error(res.error);
      else toast.success("შენახულია");
      router.refresh();
    });
  }

  function changePassword(e: React.FormEvent) {
    e.preventDefault();
    if (pw.next.length < 6) return toast.error("ახალი პაროლი მინიმუმ 6 სიმბოლო");
    if (pw.next !== pw.confirm) return toast.error("პაროლები არ ემთხვევა");
    start(async () => {
      const res = await authClient.changePassword({ currentPassword: pw.current, newPassword: pw.next, revokeOtherSessions: true });
      if (res.error) {
        toast.error(res.error.message?.includes("password") ? "მიმდინარე პაროლი არასწორია" : (res.error.message ?? "შეცდომა"));
        return;
      }
      toast.success("პაროლი შეიცვალა");
      setPw({ current: "", next: "", confirm: "" });
    });
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">მონაცემები</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={saveProfile} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="p-name">სახელი, გვარი</Label>
              <Input id="p-name" name="name" required defaultValue={name} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="p-phone">ტელეფონი</Label>
              <Input id="p-phone" name="phone" defaultValue={phone} />
            </div>
            <Button type="submit" disabled={pending}>
              შენახვა
            </Button>
          </form>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">პაროლის შეცვლა</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={changePassword} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="pw-cur">მიმდინარე პაროლი</Label>
              <Input id="pw-cur" type="password" autoComplete="current-password" required value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pw-new">ახალი პაროლი</Label>
              <Input id="pw-new" type="password" autoComplete="new-password" required minLength={6} value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pw-conf">გაიმეორეთ</Label>
              <Input id="pw-conf" type="password" autoComplete="new-password" required value={pw.confirm} onChange={(e) => setPw({ ...pw, confirm: e.target.value })} />
            </div>
            <Button type="submit" variant="outline" disabled={pending}>
              შეცვლა
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
