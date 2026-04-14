/**
 * Dialog wyświetlający link aktywacyjny do skopiowania.
 *
 * Wyświetlany po:
 *  - utworzeniu nowego usera (z wyniku POST /admin/users)
 *  - ręcznej regeneracji linku (POST /admin/users/:id/invite)
 *
 * Backend nie przechowuje gotowego linku — po zamknięciu dialogu admin
 * musi wygenerować go ponownie, jeśli nie zdążył skopiować.
 */

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { InviteLinkDto } from "@/types";

interface InviteLinkDialogProps {
  isOpen: boolean;
  onClose: () => void;
  inviteLink: InviteLinkDto | null;
}

/** Formatuje ISO8601 do czytelnej postaci (DD.MM.YYYY HH:MM). */
function formatExpiry(iso: string): string {
  try {
    const d = new Date(iso);
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const yyyy = d.getFullYear();
    const hh = String(d.getHours()).padStart(2, "0");
    const mi = String(d.getMinutes()).padStart(2, "0");
    return `${dd}.${mm}.${yyyy} ${hh}:${mi}`;
  } catch {
    return iso;
  }
}

export function InviteLinkDialog({ isOpen, onClose, inviteLink }: InviteLinkDialogProps) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    if (!inviteLink) return;
    try {
      await navigator.clipboard.writeText(inviteLink.url);
      setCopied(true);
      toast.success("Link skopiowany do schowka");
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Nie udało się skopiować — skopiuj link ręcznie");
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-xl" data-testid="admin-invite-link-dialog">
        <DialogHeader>
          <DialogTitle>Link aktywacyjny</DialogTitle>
          <DialogDescription>
            Skopiuj link i przekaż użytkownikowi (np. mailem). Po zamknięciu tego okna nie będzie
            można go już odzyskać — wygeneruj nowy, jeśli będzie potrzebny.
          </DialogDescription>
        </DialogHeader>

        {inviteLink ? (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="invite-link-url">URL aktywacyjny</Label>
              <div className="flex gap-2">
                <Input
                  id="invite-link-url"
                  value={inviteLink.url}
                  readOnly
                  className="font-mono text-xs"
                  data-testid="invite-link-url"
                  onFocus={(e) => e.currentTarget.select()}
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleCopy}
                  data-testid="invite-link-copy"
                >
                  {copied ? (
                    <>
                      <Check className="w-4 h-4 mr-1" /> Skopiowane
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4 mr-1" /> Kopiuj
                    </>
                  )}
                </Button>
              </div>
            </div>

            <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-900/50 dark:bg-amber-900/20 dark:text-amber-200">
              <p className="font-semibold">Link wygasa: {formatExpiry(inviteLink.expiresAt)}</p>
              <p className="mt-1">TTL: 7 dni. Link jest jednorazowy — po aktywacji przestaje działać.</p>
            </div>
          </div>
        ) : null}

        <DialogFooter>
          <Button type="button" onClick={onClose} data-testid="invite-link-close">
            Zamknij
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
