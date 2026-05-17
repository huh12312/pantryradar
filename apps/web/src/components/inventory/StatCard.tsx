import React from "react";
import { colorMap } from "@/lib/inventoryColors";

interface StatCardProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  sub: string;
  color: "violet" | "blue" | "cyan" | "amber";
}

export function StatCard({ icon: Icon, label, value, sub, color }: StatCardProps) {
  return (
    <div className="bg-card rounded-2xl border p-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          {label}
        </span>
        <div className={`p-2 rounded-xl ${colorMap[color]}`}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <p className="text-3xl font-bold tracking-tight">{value}</p>
      <p className="text-xs text-muted-foreground mt-1">{sub}</p>
    </div>
  );
}
