import { useEffect, useRef, useState, useCallback } from "react";
import { BrowserMultiFormatReader } from "@zxing/browser";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Camera, X, Search, Zap, ZapOff } from "lucide-react";

// Extended camera constraint types (torch/zoom not in TypeScript stdlib)
interface ExtendedTrackCapabilities extends MediaTrackCapabilities {
  torch?: boolean;
  zoom?: { min: number; max: number; step: number };
}

const ZOOM_LEVELS = [
  { label: "1×", factor: 1 as const },
  { label: "2×", factor: 2 as const },
  { label: "3×", factor: 3 as const },
];

interface BarcodeScannerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onScan: (barcode: string) => void;
}

export function BarcodeScanner({ open, onOpenChange, onScan }: BarcodeScannerProps) {
  const [videoEl, setVideoEl] = useState<HTMLVideoElement | null>(null);
  const videoCallbackRef = useCallback((el: HTMLVideoElement | null) => {
    setVideoEl(el);
  }, []);

  const [cameraError, setCameraError] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [manualBarcode, setManualBarcode] = useState("");

  // Camera controls — only shown when the device supports them
  const [hasTorch, setHasTorch] = useState(false);
  const [torchEnabled, setTorchEnabled] = useState(false);
  const [hasZoom, setHasZoom] = useState(false);
  const [zoomLevel, setZoomLevel] = useState<1 | 2 | 3>(1);
  const [zoomRange, setZoomRange] = useState<{ min: number; max: number } | null>(null);
  const [focusPoint, setFocusPoint] = useState<{ x: number; y: number } | null>(null);

  const readerRef = useRef<BrowserMultiFormatReader | null>(null);
  const controlsRef = useRef<{ stop: () => void } | null>(null);
  const trackRef = useRef<MediaStreamTrack | null>(null);
  const scannedRef = useRef(false);
  const focusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const stopCamera = useCallback(() => {
    if (controlsRef.current) {
      try { controlsRef.current.stop(); } catch { /* ignore */ }
      controlsRef.current = null;
    }
    readerRef.current = null;
    trackRef.current = null;
    scannedRef.current = false;
    setScanning(false);
    setHasTorch(false);
    setHasZoom(false);
    setTorchEnabled(false);
    setZoomLevel(1);
    setZoomRange(null);
  }, []);

  const handleScan = useCallback(
    (barcode: string) => {
      if (scannedRef.current) return;
      scannedRef.current = true;
      stopCamera();
      onScan(barcode);
      onOpenChange(false);
    },
    [onScan, onOpenChange, stopCamera]
  );

  useEffect(() => {
    if (!open) {
      stopCamera();
      setCameraError(null);
      setManualBarcode("");
      setFocusPoint(null);
    }
  }, [open, stopCamera]);

  useEffect(() => {
    if (!open || !videoEl) return;

    const reader = new BrowserMultiFormatReader();
    readerRef.current = reader;
    setScanning(true);

    const startScanning = async () => {
      try {
        const controls = await reader.decodeFromVideoDevice(
          undefined,
          videoEl,
          (result, err) => {
            if (result) handleScan(result.getText());
            if (err && err.name !== "NotFoundException") {
              console.error("Scanning error:", err);
            }
          }
        );
        controlsRef.current = controls;

        // Detect torch / zoom support after the stream is live
        const track = (videoEl.srcObject as MediaStream)?.getVideoTracks()[0];
        if (track) {
          trackRef.current = track;
          const caps = track.getCapabilities() as ExtendedTrackCapabilities;
          setHasTorch(caps.torch === true);
          if (caps.zoom) {
            setHasZoom(true);
            setZoomRange({ min: caps.zoom.min, max: caps.zoom.max });
          }
        }
      } catch (err) {
        console.error("Failed to start camera:", err);
        setCameraError("Camera unavailable — use manual entry below.");
        setScanning(false);
      }
    };

    void startScanning();
    return () => { stopCamera(); };
  }, [open, videoEl, handleScan, stopCamera]);

  const handleTorchToggle = async () => {
    const track = trackRef.current;
    if (!track) return;
    const next = !torchEnabled;
    try {
      await track.applyConstraints({ advanced: [{ torch: next } as MediaTrackConstraintSet] });
      setTorchEnabled(next);
    } catch {
      // Torch not supported on this device
    }
  };

  const handleZoom = async (factor: 1 | 2 | 3) => {
    const track = trackRef.current;
    if (!track || !zoomRange) return;
    const { min, max } = zoomRange;
    const range = max - min;
    const value =
      factor === 1 ? min : factor === 2 ? min + range * 0.3 : Math.min(min + range * 0.6, max);
    try {
      await track.applyConstraints({ advanced: [{ zoom: value } as MediaTrackConstraintSet] });
      setZoomLevel(factor);
    } catch {
      // Zoom not supported on this device
    }
  };

  const triggerFocus = async (localX: number, localY: number, relX: number, relY: number) => {
    if (focusTimerRef.current) clearTimeout(focusTimerRef.current);
    setFocusPoint({ x: localX, y: localY });
    focusTimerRef.current = setTimeout(() => setFocusPoint(null), 1200);

    const track = trackRef.current;
    if (!track) return;
    try {
      await track.applyConstraints({
        advanced: [
          { focusMode: "single-shot", pointsOfInterest: [{ x: relX, y: relY }] } as MediaTrackConstraintSet,
        ],
      });
    } catch {
      // pointsOfInterest not supported — visual feedback still shows
    }
  };

  const handleCameraClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const localX = e.clientX - rect.left;
    const localY = e.clientY - rect.top;
    void triggerFocus(localX, localY, localX / rect.width, localY / rect.height);
  };

  const handleCameraKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      const rect = e.currentTarget.getBoundingClientRect();
      void triggerFocus(rect.width / 2, rect.height / 2, 0.5, 0.5);
    }
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const code = manualBarcode.trim();
    if (!code) return;
    handleScan(code);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" showHandle>
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Camera className="h-5 w-5" />
            Scan Barcode
          </SheetTitle>
        </SheetHeader>

        <div className="space-y-4">
          {/* Camera view */}
          {!cameraError ? (
            <div
              role="button"
              tabIndex={0}
              aria-label="Camera viewfinder — tap or press Enter to focus"
              className="relative bg-black rounded-lg overflow-hidden aspect-[3/4] md:aspect-video cursor-crosshair select-none"
              onClick={handleCameraClick}
              onKeyDown={handleCameraKeyDown}
            >
              <video
                ref={videoCallbackRef}
                className="w-full h-full object-cover"
                autoPlay
                playsInline
                muted
              />

              {/* Scan window */}
              {scanning && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="border-2 border-white w-64 h-28 rounded opacity-80" />
                </div>
              )}

              {/* Tap-to-focus ring */}
              {focusPoint && (
                <div
                  className="absolute w-12 h-12 border-2 border-yellow-300 rounded pointer-events-none"
                  style={{ left: focusPoint.x - 24, top: focusPoint.y - 24 }}
                />
              )}

              {/* Torch button — only on supporting devices */}
              {hasTorch && scanning && (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); void handleTorchToggle(); }}
                  className="absolute top-3 right-3 bg-black/50 p-2 rounded-full"
                  aria-label={torchEnabled ? "Turn off torch" : "Turn on torch"}
                >
                  {torchEnabled ? (
                    <Zap className="h-5 w-5 text-yellow-300 fill-yellow-300" />
                  ) : (
                    <ZapOff className="h-5 w-5 text-white" />
                  )}
                </button>
              )}

              {/* Bottom controls */}
              {scanning && (
                <div className="absolute bottom-3 left-0 right-0 flex flex-col items-center gap-2">
                  {/* Zoom buttons — only on supporting devices */}
                  {hasZoom && (
                    <div className="flex gap-1.5">
                      {ZOOM_LEVELS.map(({ label, factor }) => (
                        <button
                          key={label}
                          type="button"
                          onClick={(e) => { e.stopPropagation(); void handleZoom(factor); }}
                          className={`px-3 py-1 rounded-full text-xs font-semibold border transition-colors ${
                            zoomLevel === factor
                              ? "bg-white text-black border-white"
                              : "bg-black/50 text-white border-white/40"
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  )}
                  <p className="text-white/60 text-xs pointer-events-none">Tap to focus</p>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-muted text-muted-foreground p-4 rounded-md text-sm text-center">
              {cameraError}
            </div>
          )}

          <p className="text-xs text-muted-foreground text-center">
            {scanning ? "Scanning — point camera at a barcode" : "Camera not available"}
          </p>

          {/* Manual entry */}
          <div className="border-t pt-4">
            <form onSubmit={handleManualSubmit} className="space-y-2">
              <Label htmlFor="manual-barcode">Enter barcode manually</Label>
              <div className="flex gap-2">
                <Input
                  id="manual-barcode"
                  placeholder="e.g. 0038000845260"
                  value={manualBarcode}
                  onChange={(e) => setManualBarcode(e.target.value)}
                  inputMode="numeric"
                  className="h-11 sm:h-10"
                />
                <Button
                  type="submit"
                  size="icon"
                  className="h-11 w-11 sm:h-10 sm:w-10"
                  disabled={!manualBarcode.trim()}
                >
                  <Search className="h-4 w-4" />
                </Button>
              </div>
            </form>
          </div>

          <Button
            variant="outline"
            className="w-full h-11 sm:h-10"
            onClick={() => onOpenChange(false)}
          >
            <X className="h-4 w-4 mr-2" />
            Cancel
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
