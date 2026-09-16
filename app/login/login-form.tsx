"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { signIn } from "@/lib/auth-client";

export function LoginForm({ next, microsoft }: { next: string; microsoft: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    start(async () => {
      const res = await signIn.email({ email: email.trim(), password });
      if (res.error) {
        toast.error("ელფოსტა ან პაროლი არასწორია");
        return;
      }
      router.replace(next);
      router.refresh();
    });
  }

  return (
    <Card className="shadow-xl shadow-blue-900/5">
      <CardContent className="pt-6">
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="email">ელფოსტა</Label>
            <Input
              id="email"
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@line-net.ge"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password">პაროლი</Label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <Button type="submit" className="w-full" size="lg" disabled={pending}>
            {pending ? "შესვლა..." : "შესვლა"}
          </Button>
        </form>

        {microsoft && (
          <>
            <div className="my-4 flex items-center gap-3 text-xs text-muted-foreground">
              <div className="h-px flex-1 bg-border" />
              ან
              <div className="h-px flex-1 bg-border" />
            </div>
            <Button
              type="button"
              variant="outline"
              className="w-full"
              size="lg"
              onClick={() => signIn.social({ provider: "microsoft", callbackURL: next })}
            >
              <svg viewBox="0 0 23 23" className="size-4" aria-hidden>
                <rect x="1" y="1" width="10" height="10" fill="#f25022" />
                <rect x="12" y="1" width="10" height="10" fill="#7fba00" />
                <rect x="1" y="12" width="10" height="10" fill="#00a4ef" />
                <rect x="12" y="12" width="10" height="10" fill="#ffb900" />
              </svg>
              Microsoft ანგარიშით შესვლა
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
