import { ChefHat, LayoutGrid, Package, Thermometer, Snowflake, LogOut } from "lucide-react";

export interface SidebarProps {
  user: { name: string; email?: string } | null;
  onLogout: () => void;
  totalItems: number;
  expiringCount: number;
  expiredCount: number;
  activeSection: "all" | "pantry" | "fridge" | "freezer";
  onSectionChange: (section: "all" | "pantry" | "fridge" | "freezer") => void;
  pantryCount: number;
  fridgeCount: number;
  freezerCount: number;
}

interface NavItem {
  id: "all" | "pantry" | "fridge" | "freezer";
  label: string;
  icon: React.ElementType;
  count: number;
}

export function Sidebar({
  user,
  onLogout,
  totalItems,
  expiringCount,
  expiredCount,
  activeSection,
  onSectionChange,
  pantryCount,
  fridgeCount,
  freezerCount,
}: SidebarProps) {
  const navItems: NavItem[] = [
    { id: "all", label: "All Items", icon: LayoutGrid, count: totalItems },
    { id: "pantry", label: "Pantry", icon: Package, count: pantryCount },
    { id: "fridge", label: "Fridge", icon: Thermometer, count: fridgeCount },
    { id: "freezer", label: "Freezer", icon: Snowflake, count: freezerCount },
  ];

  const userInitial = user?.name ? user.name.charAt(0).toUpperCase() : "?";

  return (
    <div className="w-60 h-screen flex flex-col bg-sidebar border-r border-sidebar-border flex-shrink-0">
      {/* Logo area */}
      <div className="px-4 py-5 flex items-center gap-2">
        <ChefHat className="h-6 w-6 text-sidebar-accent" />
        <span className="font-bold text-white">PantryMaid</span>
      </div>
      <div className="border-b border-sidebar-border" />

      {/* Navigation */}
      <div>
        <p className="text-[10px] font-semibold tracking-widest text-sidebar-muted uppercase px-4 mt-5 mb-2">
          Locations
        </p>
        {navItems.map(({ id, label, icon: Icon, count }) => {
          const isActive = activeSection === id;
          return (
            <div
              key={id}
              onClick={() => onSectionChange(id)}
              className={[
                "px-3 py-2.5 mx-1 rounded-xl flex items-center gap-3 cursor-pointer transition-colors duration-150",
                isActive
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-muted hover:text-sidebar-foreground hover:bg-white/5",
              ].join(" ")}
            >
              <Icon className="h-4 w-4" />
              <span className="text-sm font-medium flex-1">{label}</span>
              <span
                className={[
                  "text-xs px-1.5 py-0.5 rounded-full",
                  isActive ? "bg-white/20 text-white" : "bg-white/5 text-sidebar-muted",
                ].join(" ")}
              >
                {count}
              </span>
            </div>
          );
        })}
      </div>

      {/* Stats section */}
      <div className="border-t border-sidebar-border mx-4 my-4" />
      <div>
        <p className="text-[10px] font-semibold tracking-widest text-sidebar-muted uppercase px-4 mb-2">
          Overview
        </p>
        <div className="px-4 py-1.5 flex items-center justify-between">
          <span className="text-sm text-sidebar-muted">Total Items</span>
          <span className="font-semibold text-sidebar-foreground">{totalItems}</span>
        </div>
        <div className="px-4 py-1.5 flex items-center justify-between">
          <span className="text-sm text-sidebar-muted">Expiring Soon</span>
          <span
            className={`font-semibold ${expiringCount > 0 ? "text-amber-400" : "text-sidebar-foreground"}`}
          >
            {expiringCount}
          </span>
        </div>
        <div className="px-4 py-1.5 flex items-center justify-between">
          <span className="text-sm text-sidebar-muted">Expired</span>
          <span
            className={`font-semibold ${expiredCount > 0 ? "text-rose-400" : "text-sidebar-foreground"}`}
          >
            {expiredCount}
          </span>
        </div>
      </div>

      {/* User section */}
      <div className="mt-auto">
        <div className="border-t border-sidebar-border mx-4 mb-3" />
        <div className="px-4 py-3 flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-sidebar-accent flex items-center justify-center text-white text-sm font-semibold flex-shrink-0">
            {userInitial}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-sidebar-foreground truncate">{user?.name ?? ""}</p>
            {user?.email && (
              <p className="text-xs text-sidebar-muted truncate">{user.email}</p>
            )}
          </div>
          <button
            onClick={onLogout}
            className="ml-auto p-1.5 rounded-lg text-sidebar-muted hover:text-sidebar-foreground hover:bg-white/5 transition-colors"
            aria-label="Log out"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
