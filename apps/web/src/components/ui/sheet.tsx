import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { cva, type VariantProps } from "class-variance-authority";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

const Sheet = DialogPrimitive.Root;
const SheetTrigger = DialogPrimitive.Trigger;
const SheetPortal = DialogPrimitive.Portal;
const SheetClose = DialogPrimitive.Close;

const SheetOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      "fixed inset-0 z-50 bg-black/80 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      className
    )}
    {...props}
  />
));
SheetOverlay.displayName = "SheetOverlay";

const sheetVariants = cva(
  "fixed z-50 gap-4 border bg-background p-6 shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
  {
    variants: {
      side: {
        // Bottom = mobile-anchored sheet that re-centers as a dialog at md+.
        // The two animation states are scoped to viewport so we don't fly in
        // from the bottom on desktop where the dialog is centred.
        bottom:
          "inset-x-0 bottom-0 max-h-[90dvh] overflow-y-auto rounded-t-2xl border-x-0 border-b-0 data-[state=open]:slide-in-from-bottom data-[state=closed]:slide-out-to-bottom md:inset-x-auto md:bottom-auto md:left-[50%] md:top-[50%] md:w-full md:max-w-md md:max-h-[85vh] md:translate-x-[-50%] md:translate-y-[-50%] md:rounded-2xl md:border md:data-[state=open]:slide-in-from-top-[48%] md:data-[state=open]:zoom-in-95 md:data-[state=closed]:slide-out-to-top-[48%] md:data-[state=closed]:zoom-out-95",
        right:
          "inset-y-0 right-0 h-full w-full max-w-sm border-y-0 border-r-0 data-[state=open]:slide-in-from-right data-[state=closed]:slide-out-to-right",
        dialog:
          "left-[50%] top-[50%] grid w-full max-w-[min(32rem,calc(100vw-2rem))] translate-x-[-50%] translate-y-[-50%] sm:rounded-lg data-[state=open]:zoom-in-95 data-[state=closed]:zoom-out-95",
      },
    },
    defaultVariants: {
      side: "dialog",
    },
  }
);

export interface SheetContentProps
  extends React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>,
    VariantProps<typeof sheetVariants> {
  showHandle?: boolean;
}

const SheetContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  SheetContentProps
>(({ className, side, showHandle, children, onPointerDownOutside, onInteractOutside, ...props }, ref) => {
  const renderHandle = side === "bottom" && showHandle !== false;
  return (
    <SheetPortal>
      <SheetOverlay />
      <DialogPrimitive.Content
        ref={ref}
        data-testid="sheet-content"
        className={cn(sheetVariants({ side }), className)}
        onPointerDownOutside={(e) => {
          // Prevent the sheet from closing when the pointer-down lands inside a
          // Radix portal (e.g. a Select or Popover dropdown rendered outside
          // the dialog's DOM subtree).
          if ((e.target as Element)?.closest?.("[data-radix-popper-content-wrapper]")) {
            e.preventDefault();
            return;
          }
          onPointerDownOutside?.(e);
        }}
        onInteractOutside={(e) => {
          // Same guard for focus-based interact-outside events (e.g. when a
          // Radix Select portal steals focus, Radix Dialog fires this event).
          if ((e.target as Element)?.closest?.("[data-radix-popper-content-wrapper]")) {
            e.preventDefault();
            return;
          }
          onInteractOutside?.(e);
        }}
        {...props}
      >
        {renderHandle ? (
          <div
            aria-hidden="true"
            className="mx-auto -mt-2 mb-2 h-1.5 w-12 rounded-full bg-border md:hidden"
          />
        ) : null}
        {children}
        <DialogPrimitive.Close className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none">
          <X className="h-4 w-4" />
          <span className="sr-only">Close</span>
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </SheetPortal>
  );
});
SheetContent.displayName = "SheetContent";

const SheetHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn("flex flex-col space-y-1.5 text-left", className)}
    {...props}
  />
);
SheetHeader.displayName = "SheetHeader";

const SheetFooter = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-0 sm:space-x-2",
      className
    )}
    {...props}
  />
);
SheetFooter.displayName = "SheetFooter";

const SheetTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn(
      "text-lg font-semibold leading-none tracking-tight",
      className
    )}
    {...props}
  />
));
SheetTitle.displayName = "SheetTitle";

const SheetDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
));
SheetDescription.displayName = "SheetDescription";

export {
  Sheet,
  SheetTrigger,
  SheetClose,
  SheetPortal,
  SheetOverlay,
  SheetContent,
  SheetHeader,
  SheetFooter,
  SheetTitle,
  SheetDescription,
  sheetVariants,
};
