import * as React from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Drawer, DrawerContent, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { useMediaQuery } from "@/hooks/use-media-query";
import { cn } from "@/lib/utils";

/**
 * shadcn "responsive dialog" pattern: a centered Dialog on desktop, a slide-up Drawer on phones.
 */
const DesktopContext = React.createContext(true);
export const useIsDesktop = () => React.useContext(DesktopContext);

export function Modal({ open, onOpenChange, children }: { open: boolean; onOpenChange: (o: boolean) => void; children: React.ReactNode }) {
  const desktop = useMediaQuery("(min-width: 640px)");
  return (
    <DesktopContext.Provider value={desktop}>
      {desktop ? (
        <Dialog open={open} onOpenChange={onOpenChange}>
          {children}
        </Dialog>
      ) : (
        <Drawer open={open} onOpenChange={onOpenChange} repositionInputs={false}>
          {children}
        </Drawer>
      )}
    </DesktopContext.Provider>
  );
}

export function ModalContent({
  className,
  children,
  onOpenAutoFocus,
}: {
  className?: string;
  children: React.ReactNode;
  onOpenAutoFocus?: (e: Event) => void;
}) {
  const desktop = useIsDesktop();
  return desktop ? (
    <DialogContent aria-describedby={undefined} onOpenAutoFocus={onOpenAutoFocus} className={cn("flex max-h-[90dvh] flex-col gap-0 p-0 sm:max-w-lg", className)}>
      {children}
    </DialogContent>
  ) : (
    <DrawerContent aria-describedby={undefined} onOpenAutoFocus={onOpenAutoFocus} className={cn("max-h-[92dvh] data-[vaul-drawer-direction=bottom]:max-h-[92dvh]", className)}>
      {children}
    </DrawerContent>
  );
}

export function ModalHeader({ className, ...props }: React.ComponentProps<"div">) {
  const desktop = useIsDesktop();
  return desktop ? <DialogHeader className={cn("px-6 pt-6 pb-4 text-left", className)} {...props} /> : <DrawerHeader className={cn("px-5 pt-3 pb-4 text-left group-data-[vaul-drawer-direction=bottom]/drawer-content:text-left", className)} {...props} />;
}

export function ModalTitle(props: React.ComponentProps<typeof DialogTitle>) {
  return useIsDesktop() ? <DialogTitle {...props} /> : <DrawerTitle {...props} />;
}

export function ModalDescription(props: React.ComponentProps<typeof DialogDescription>) {
  return useIsDesktop() ? <DialogDescription {...props} /> : <DrawerDescription {...props} />;
}

/** Scrollable middle section. */
export function ModalBody({ className, ...props }: React.ComponentProps<"div">) {
  const desktop = useIsDesktop();
  return <div className={cn("min-h-0 flex-1 overflow-y-auto", desktop ? "px-6 pb-6" : "px-5 pb-5", className)} {...props} />;
}

export function ModalFooter({ className, ...props }: React.ComponentProps<"div">) {
  const desktop = useIsDesktop();
  return desktop ? (
    <DialogFooter className={cn("border-t px-6 py-4 sm:justify-start", className)} {...props} />
  ) : (
    <DrawerFooter className={cn("border-t px-5 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]", className)} {...props} />
  );
}
