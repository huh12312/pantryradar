import { useState } from "react";
import {
  Camera,
  Copy,
  FileText,
  LogOut,
  MoreVertical,
  Moon,
  Sun,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useTheme } from "@/components/layout/ThemeProvider";

export interface OverflowMenuProps {
  inviteCode?: string;
  onScan: () => void;
  onReceipt: () => void;
  onLogout: () => void;
}

export function OverflowMenu({
  inviteCode,
  onScan,
  onReceipt,
  onLogout,
}: OverflowMenuProps) {
  const { theme, setTheme } = useTheme();
  const [copied, setCopied] = useState(false);

  const isDark = theme === "dark";

  const handleCopy = async () => {
    if (!inviteCode) return;
    try {
      await navigator.clipboard.writeText(inviteCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="More options"
          data-testid="overflow-menu-trigger"
          className="h-10 w-10"
        >
          <MoreVertical className="h-5 w-5" aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>Actions</DropdownMenuLabel>
        <DropdownMenuItem onSelect={() => onScan()}>
          <Camera className="h-4 w-4" aria-hidden="true" />
          Scan barcode
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => onReceipt()}>
          <FileText className="h-4 w-4" aria-hidden="true" />
          Upload receipt
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={(event) => {
            event.preventDefault();
            setTheme(isDark ? "light" : "dark");
          }}
        >
          {isDark ? (
            <Sun className="h-4 w-4" aria-hidden="true" />
          ) : (
            <Moon className="h-4 w-4" aria-hidden="true" />
          )}
          {isDark ? "Light theme" : "Dark theme"}
        </DropdownMenuItem>
        {inviteCode ? (
          <DropdownMenuItem
            onSelect={(event) => {
              event.preventDefault();
              void handleCopy();
            }}
            data-testid="invite-code-menu-item"
          >
            <Copy className="h-4 w-4" aria-hidden="true" />
            <span className="flex-1" data-testid="invite-code">
              {copied ? "Copied!" : `Invite: ${inviteCode}`}
            </span>
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={() => onLogout()}
          className="text-destructive focus:text-destructive"
        >
          <LogOut className="h-4 w-4" aria-hidden="true" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
