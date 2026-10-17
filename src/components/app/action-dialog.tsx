"use client";

import { useState, type ReactNode } from "react";
import { useFormAction } from "@/hooks/use-form-action";
import { Copy } from "lucide-react";
import { toast } from "sonner";
import type { ActionResult } from "@/app/app/actions";
import { FormMessage, SubmitButton } from "@/components/forms/fields";
import { Button, buttonVariants } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

type Action = (previous: ActionResult | null, form: FormData) => Promise<ActionResult>;

/**
 * A trigger + dialog wrapping one Server Action form. Closes and toasts on
 * success; keeps the dialog open with inline errors otherwise.
 */
export function ActionDialog({
  action,
  trigger,
  triggerVariant = "outline",
  triggerSize = "sm",
  title,
  description,
  submitLabel,
  children,
  keepOpenOnSuccess,
}: {
  action: Action;
  trigger: ReactNode;
  triggerVariant?: "default" | "outline" | "ghost" | "secondary";
  triggerSize?: "default" | "sm" | "xs";
  title: string;
  description?: ReactNode;
  submitLabel: string;
  /** Render the form fields; receives field errors from the last attempt. */
  children: (errors: Record<string, string | undefined>) => ReactNode;
  /** Keep the dialog open after success (e.g. to show a link to copy). */
  keepOpenOnSuccess?: boolean;
}) {
  const [open, setOpen] = useState(false);
  // Success handling lives in the action wrapper, not an effect.
  const [state, onSubmit, pending] = useFormAction(async (previous: ActionResult | null, form: FormData) => {
    const result = await action(previous, form);
    if (result.ok) {
      toast.success(result.message ?? "Saved.");
      if (!keepOpenOnSuccess) setOpen(false);
    }
    return result;
  }, null);

  const showResult = state !== null && (!state.ok || keepOpenOnSuccess);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger className={cn(buttonVariants({ variant: triggerVariant, size: triggerSize }))}>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description ? <DialogDescription>{description}</DialogDescription> : null}
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          {children(state && !state.ok ? state.fieldErrors ?? {} : {})}
          {showResult ? <FormMessage status={state.ok ? "success" : "error"} message={state.message} /> : null}
          {showResult && state.link ? <CopyLink link={state.link} /> : null}
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Close</Button>
            <SubmitButton size="default" pending={pending} pendingLabel="Saving…">{submitLabel}</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function CopyLink({ link }: { link: string }) {
  return (
    <div className="flex items-center gap-2 rounded-[10px] border border-border bg-surface p-2">
      <code className="min-w-0 flex-1 truncate text-xs text-navy" title={link}>{link}</code>
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={() => navigator.clipboard.writeText(link).then(() => toast.success("Link copied."), () => toast.error("Couldn't copy — select the link instead."))}
      >
        <Copy aria-hidden /> Copy
      </Button>
    </div>
  );
}
