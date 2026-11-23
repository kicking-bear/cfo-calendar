import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { checkCode, DEMO, type Session } from "@/lib/api";

export function SignInDialog({ open, onOpenChange, onSignedIn }: { open: boolean; onOpenChange: (o: boolean) => void; onSignedIn: (s: Session) => void }) {
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!code.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const group = await checkCode(code);
      onSignedIn({ code: code.trim(), group });
      setCode("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) setError(null);
        onOpenChange(o);
      }}
    >
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Sign in to edit</DialogTitle>
          <DialogDescription>
            Enter your group's code (CWS, Binhi, Kadiwa or Buklod). You'll stay signed in on this device, and changes you make are labeled with your group.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="code">Group code</Label>
            <Input
              id="code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              autoComplete="off"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              autoFocus
              placeholder={DEMO ? "Demo: cws, binhi, kadiwa or buklod" : ""}
              aria-invalid={!!error}
            />
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
          </div>
          <Button type="submit" className="w-full" disabled={busy || !code.trim()}>
            {busy ? "Checking…" : "Sign in"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
