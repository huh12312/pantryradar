import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Sparkles } from "lucide-react";
import { ITEM_PRESETS } from "@pantrymaid/shared/constants";
import type { ItemPreset } from "@pantrymaid/shared/constants";

interface QuickAddPresetsProps {
  onSelect: (preset: ItemPreset) => void;
  onAISuggest?: (query: string) => void;
  isSuggestLoading?: boolean;
}

export function QuickAddPresets({ onSelect, onAISuggest, isSuggestLoading }: QuickAddPresetsProps) {
  const [query, setQuery] = useState("");

  const filtered =
    query.trim().length === 0
      ? []
      : ITEM_PRESETS.filter((p) => p.name.toLowerCase().includes(query.toLowerCase())).slice(0, 8);

  const showAISuggest = query.trim().length >= 3 && filtered.length === 0;

  return (
    <div className="space-y-2">
      <Input
        aria-label="Search common items"
        placeholder="Search common items..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="h-9"
      />
      {filtered.length > 0 && (
        <div className="border rounded-lg divide-y max-h-48 overflow-y-auto">
          {filtered.map((preset) => (
            <button
              key={preset.name}
              type="button"
              className="w-full text-left px-3 py-2 text-sm hover:bg-secondary transition-colors flex justify-between items-center"
              onClick={() => {
                onSelect(preset);
                setQuery("");
              }}
            >
              <span className="font-medium">{preset.name}</span>
              <span className="text-xs text-muted-foreground">
                {preset.unit} · {preset.category}
              </span>
            </button>
          ))}
        </div>
      )}
      {showAISuggest && onAISuggest && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-full"
          disabled={isSuggestLoading}
          onClick={() => onAISuggest(query.trim())}
        >
          <Sparkles className="h-3 w-3 mr-2" />
          {isSuggestLoading ? "Suggesting..." : "AI Suggest"}
        </Button>
      )}
    </div>
  );
}
