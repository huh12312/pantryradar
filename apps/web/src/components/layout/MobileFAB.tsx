import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface MobileFABProps {
  onClick: () => void;
  label?: string;
  className?: string;
}

export function MobileFAB({
  onClick,
  label = "Add item",
  className,
}: MobileFABProps) {
  return (
    <Button
      type="button"
      onClick={onClick}
      aria-label={label}
      data-testid="mobile-fab"
      className={cn(
        "fixed bottom-6 right-6 z-40 h-14 w-14 rounded-full p-0 shadow-lg md:hidden",
        className
      )}
    >
      <Plus className="h-6 w-6" aria-hidden="true" />
    </Button>
  );
}
