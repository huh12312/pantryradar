import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Check, Pencil, Trash2, X } from "lucide-react";
import { api, type House } from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";
import { useHouseStore } from "@/lib/houseStore";

interface HouseSelectorProps {
  /** "sidebar" = vertical list for desktop sidebar; "bar" = horizontal pill strip for mobile */
  variant: "sidebar" | "bar";
  collapsed?: boolean; // sidebar-only: show icon-only mode
}

export function HouseSelector({ variant, collapsed = false }: HouseSelectorProps) {
  const queryClient = useQueryClient();
  const { selectedHouseId, setSelectedHouseId } = useHouseStore();

  const [addingNew, setAddingNew] = useState(false);
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const newInputRef = useRef<HTMLInputElement>(null);
  const editInputRef = useRef<HTMLInputElement>(null);

  const { data: houses = [] } = useQuery({
    queryKey: queryKeys.houses.lists(),
    queryFn: () => api.getHouses(),
  });

  // Auto-select the first house when the list loads and nothing is selected
  useEffect(() => {
    if (houses.length > 0 && (!selectedHouseId || !houses.find((h) => h.id === selectedHouseId))) {
      setSelectedHouseId(houses[0]!.id);
    }
  }, [houses, selectedHouseId, setSelectedHouseId]);

  useEffect(() => {
    if (addingNew) newInputRef.current?.focus();
  }, [addingNew]);

  useEffect(() => {
    if (editingId) editInputRef.current?.focus();
  }, [editingId]);

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.houses.all });
    void queryClient.invalidateQueries({ queryKey: queryKeys.inventory.all });
  };

  const createMutation = useMutation({
    mutationFn: (name: string) => api.createHouse(name),
    onSuccess: (house) => {
      setSelectedHouseId(house.id);
      setAddingNew(false);
      setNewName("");
      invalidate();
    },
  });

  const renameMutation = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => api.renameHouse(id, name),
    onSuccess: () => { setEditingId(null); invalidate(); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteHouse(id),
    onSuccess: (_, id) => {
      if (selectedHouseId === id) {
        const remaining = houses.find((h) => h.id !== id);
        if (remaining) setSelectedHouseId(remaining.id);
      }
      invalidate();
    },
  });

  const submitNew = () => {
    const name = newName.trim();
    if (name) createMutation.mutate(name);
  };

  const submitEdit = (id: string) => {
    const name = editName.trim();
    if (name) renameMutation.mutate({ id, name });
    else setEditingId(null);
  };

  if (variant === "bar") {
    return (
      <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none px-4 py-2">
        {houses.map((house) => (
          <HousePill
            key={house.id}
            house={house}
            isSelected={house.id === selectedHouseId}
            isEditing={editingId === house.id}
            editName={editName}
            editInputRef={editInputRef}
            onSelect={() => setSelectedHouseId(house.id)}
            onStartEdit={() => { setEditingId(house.id); setEditName(house.name); }}
            onChangeEdit={setEditName}
            onSubmitEdit={() => submitEdit(house.id)}
            onCancelEdit={() => setEditingId(null)}
            onDelete={() => deleteMutation.mutate(house.id)}
            canDelete={houses.length > 1}
          />
        ))}
        {addingNew ? (
          <div className="flex items-center gap-1 bg-muted rounded-full px-2 py-1 shrink-0">
            <input
              ref={newInputRef}
              aria-label="New house name"
              className="bg-transparent text-sm outline-none w-24 text-foreground"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") submitNew(); if (e.key === "Escape") { setAddingNew(false); setNewName(""); } }}
              placeholder="House name"
              maxLength={40}
            />
            <button onClick={submitNew} className="text-primary hover:opacity-80"><Check className="h-3 w-3" /></button>
            <button onClick={() => { setAddingNew(false); setNewName(""); }} className="text-muted-foreground hover:opacity-80"><X className="h-3 w-3" /></button>
          </div>
        ) : (
          <button
            onClick={() => setAddingNew(true)}
            className="shrink-0 flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded-full hover:bg-muted"
            title="Add house"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    );
  }

  // Sidebar variant
  if (collapsed) {
    return (
      <div className="flex flex-col items-center gap-1 py-2">
        {houses.map((house) => {
          const initial = house.name.charAt(0).toUpperCase();
          const isSelected = house.id === selectedHouseId;
          return (
            <button
              key={house.id}
              onClick={() => setSelectedHouseId(house.id)}
              title={house.name}
              className={[
                "w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold transition-colors",
                isSelected
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-muted hover:text-sidebar-foreground hover:bg-white/5",
              ].join(" ")}
            >
              {initial}
            </button>
          );
        })}
        <button
          onClick={() => setAddingNew(true)}
          title="Add house"
          className="w-8 h-8 rounded-lg flex items-center justify-center text-sidebar-muted hover:text-sidebar-foreground hover:bg-white/5 transition-colors"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
        {addingNew && (
          <div className="fixed left-16 top-1/2 -translate-y-1/2 z-50 bg-card border rounded-xl p-3 shadow-lg w-48">
            <p className="text-xs font-medium mb-2">New house</p>
            <input
              ref={newInputRef}
              aria-label="New house name"
              className="w-full text-sm border rounded px-2 py-1 bg-background outline-none focus:ring-1 ring-primary"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") submitNew(); if (e.key === "Escape") { setAddingNew(false); setNewName(""); } }}
              placeholder="House name"
              maxLength={40}
            />
            <div className="flex gap-2 mt-2">
              <button onClick={submitNew} className="flex-1 text-xs bg-primary text-primary-foreground rounded py-1">Add</button>
              <button onClick={() => { setAddingNew(false); setNewName(""); }} className="flex-1 text-xs text-muted-foreground hover:text-foreground">Cancel</button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Sidebar expanded
  return (
    <div className="px-2 py-1">
      <p className="text-[10px] font-semibold tracking-widest text-sidebar-muted uppercase px-2 mb-1">
        Houses
      </p>
      {houses.map((house) => {
        const isSelected = house.id === selectedHouseId;
        const isEditing = editingId === house.id;
        return (
          <div
            key={house.id}
            className={[
              "group flex items-center gap-2 rounded-xl px-2 py-2 cursor-pointer transition-colors",
              isSelected
                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                : "text-sidebar-muted hover:text-sidebar-foreground hover:bg-white/5",
            ].join(" ")}
          >
            {isEditing ? (
              <>
                <input
                  ref={editInputRef}
                  aria-label="Edit house name"
                  className="flex-1 bg-transparent text-sm outline-none text-sidebar-foreground min-w-0"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") submitEdit(house.id); if (e.key === "Escape") setEditingId(null); }}
                  onBlur={() => submitEdit(house.id)}
                  maxLength={40}
                />
                <button onClick={() => setEditingId(null)} className="shrink-0 opacity-60 hover:opacity-100"><X className="h-3 w-3" /></button>
              </>
            ) : (
              <>
                <button
                  onClick={() => setSelectedHouseId(house.id)}
                  className="flex-1 text-left text-sm font-medium truncate"
                >
                  {house.name}
                </button>
                <div className="shrink-0 flex items-center gap-1 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity">
                  <button
                    onClick={(e) => { e.stopPropagation(); setEditingId(house.id); setEditName(house.name); }}
                    aria-label={`Rename ${house.name}`}
                    className="p-0.5 rounded hover:bg-white/10"
                  >
                    <Pencil className="h-2.5 w-2.5" aria-hidden="true" />
                  </button>
                  {houses.length > 1 && (
                    <button
                      onClick={(e) => { e.stopPropagation(); deleteMutation.mutate(house.id); }}
                      aria-label={`Delete ${house.name}`}
                      className="p-0.5 rounded hover:bg-white/10 hover:text-rose-400"
                    >
                      <Trash2 className="h-2.5 w-2.5" aria-hidden="true" />
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        );
      })}
      {addingNew ? (
        <div className="flex items-center gap-2 px-2 py-2">
          <input
            ref={newInputRef}
            aria-label="New house name"
            className="flex-1 bg-transparent text-sm outline-none text-sidebar-foreground border-b border-sidebar-border min-w-0"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") submitNew(); if (e.key === "Escape") { setAddingNew(false); setNewName(""); } }}
            onBlur={() => { if (!newName.trim()) { setAddingNew(false); setNewName(""); } }}
            placeholder="House name"
            maxLength={40}
          />
          <button onClick={submitNew} className="shrink-0 text-sidebar-accent hover:opacity-80"><Check className="h-3.5 w-3.5" /></button>
          <button onClick={() => { setAddingNew(false); setNewName(""); }} className="shrink-0 text-sidebar-muted hover:opacity-80"><X className="h-3.5 w-3.5" /></button>
        </div>
      ) : (
        <button
          onClick={() => setAddingNew(true)}
          className="w-full flex items-center gap-2 px-2 py-2 rounded-xl text-sidebar-muted hover:text-sidebar-foreground hover:bg-white/5 transition-colors text-sm"
        >
          <Plus className="h-3.5 w-3.5 shrink-0" />
          Add house
        </button>
      )}
    </div>
  );
}

// Pill sub-component for the bar variant
function HousePill({
  house, isSelected, isEditing, editName, editInputRef,
  onSelect, onStartEdit, onChangeEdit, onSubmitEdit, onCancelEdit, onDelete, canDelete,
}: {
  house: House;
  isSelected: boolean;
  isEditing: boolean;
  editName: string;
  editInputRef: React.RefObject<HTMLInputElement | null>;
  onSelect: () => void;
  onStartEdit: () => void;
  onChangeEdit: (v: string) => void;
  onSubmitEdit: () => void;
  onCancelEdit: () => void;
  onDelete: () => void;
  canDelete: boolean;
}) {
  if (isEditing) {
    return (
      <div className="flex items-center gap-1 bg-primary/10 border border-primary/30 rounded-full px-2 py-1 shrink-0">
        <input
          ref={editInputRef}
          aria-label="Edit house name"
          className="bg-transparent text-sm outline-none w-24 text-foreground"
          value={editName}
          onChange={(e) => onChangeEdit(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") onSubmitEdit(); if (e.key === "Escape") onCancelEdit(); }}
          maxLength={40}
        />
        <button onClick={onSubmitEdit} className="text-primary"><Check className="h-3 w-3" /></button>
        <button onClick={onCancelEdit} className="text-muted-foreground"><X className="h-3 w-3" /></button>
      </div>
    );
  }

  return (
    <div className="group relative flex items-center shrink-0">
      <button
        onClick={onSelect}
        onDoubleClick={onStartEdit}
        className={[
          "text-sm font-medium px-3 py-1 rounded-full transition-colors whitespace-nowrap",
          isSelected
            ? "bg-primary text-primary-foreground"
            : "bg-muted text-muted-foreground hover:text-foreground hover:bg-muted/80",
        ].join(" ")}
      >
        {house.name}
      </button>
      {isSelected && canDelete && (
        <button
          onClick={onDelete}
          aria-label={`Delete ${house.name}`}
          className="absolute -top-1 -right-1 hidden group-hover:flex group-focus-within:flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-destructive-foreground"
        >
          <X className="h-2.5 w-2.5" aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
