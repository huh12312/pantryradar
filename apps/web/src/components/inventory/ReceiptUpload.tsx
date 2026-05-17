import { useState, useCallback } from "react";
import { Upload, X, FileText, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";

interface ReceiptUploadProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpload: (file: File) => void;
  isLoading?: boolean;
}

export function ReceiptUpload({
  open,
  onOpenChange,
  onUpload,
  isLoading = false,
}: ReceiptUploadProps) {
  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [dragError, setDragError] = useState<string | null>(null);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (!file.type.startsWith("image/")) {
        setDragError("Only image files are accepted. Please drop a photo of your receipt.");
        return;
      }
      setDragError(null);
      setSelectedFile(file);
    }
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setDragError(null);
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleSubmit = () => {
    if (selectedFile) {
      onUpload(selectedFile);
      setSelectedFile(null);
      onOpenChange(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" showHandle>
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Upload Receipt
          </SheetTitle>
        </SheetHeader>
        <div className="space-y-4">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center p-12 gap-4">
              <Loader2 className="h-10 w-10 animate-spin text-primary" />
              <p className="text-sm font-medium">Processing receipt...</p>
              <p className="text-xs text-muted-foreground">This may take a few seconds</p>
            </div>
          ) : (
            <>
              <div
                className={`relative border-2 border-dashed rounded-lg p-8 md:p-12 text-center transition-colors ${
                  dragActive ? "border-primary bg-primary/10" : "border-muted-foreground/25"
                }`}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
              >
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                <Upload className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                {selectedFile ? (
                  <div className="space-y-2">
                    <p className="text-sm font-medium">{selectedFile.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {(selectedFile.size / 1024).toFixed(2)} KB
                    </p>
                  </div>
                ) : (
                  <>
                    <p className="text-sm font-medium">Drop your receipt here or click to browse</p>
                    <p className="text-xs text-muted-foreground mt-2">Supports: JPG, PNG</p>
                  </>
                )}
              </div>
              {dragError && (
                <p role="alert" className="mt-2 text-sm text-destructive">
                  {dragError}
                </p>
              )}

              {selectedFile && (
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className="flex-1 h-11 sm:h-10"
                    onClick={() => setSelectedFile(null)}
                  >
                    <X className="h-4 w-4 mr-2" />
                    Clear
                  </Button>
                  <Button className="flex-1 h-11 sm:h-10" onClick={handleSubmit}>
                    <Upload className="h-4 w-4 mr-2" />
                    Upload
                  </Button>
                </div>
              )}

              {!selectedFile && (
                <Button
                  variant="outline"
                  className="w-full h-11 sm:h-10"
                  onClick={() => onOpenChange(false)}
                >
                  Cancel
                </Button>
              )}
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
