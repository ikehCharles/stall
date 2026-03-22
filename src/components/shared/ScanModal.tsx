import { useEffect, useRef, useState } from "react";
import { BrowserQRCodeReader, IScannerControls } from "@zxing/browser";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

export function ScanModal({
  open,
  onClose,
  onScan,
}: {
  open: boolean;
  onClose: () => void;
  onScan: (value: string) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const codeReaderRef = useRef<IScannerControls>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!open) return;

    let mounted = true;

    const startScanner = async () => {
      // Wait for the video element to be mounted
      if (!videoRef.current) {
        await new Promise((resolve) => setTimeout(resolve, 50));
      }

      if (!mounted || !videoRef.current) return;

      setLoading(true);

      try {
        const reader = new BrowserQRCodeReader();
        const devices = await BrowserQRCodeReader.listVideoInputDevices();

        if (!devices.length) {
          toast.error("No camera found");
          onClose();
          return;
        }

        // Prefer rear/back camera — look for keywords in the device label
        const rearCamera = devices.find((d) =>
          /back|rear|environment/i.test(d.label)
        );
        const deviceId = rearCamera?.deviceId ?? devices[devices.length - 1].deviceId;

        // Start scanner
        const controls = await reader.decodeFromVideoDevice(
          deviceId,
          videoRef.current,
          (result, error, c) => {
            if (result) {
              const text = result.getText();
              onScan(text)
              c.stop();
              onClose();
            }
          }
        );

        codeReaderRef.current = controls;
        setLoading(false);

        // Auto stop after 20 seconds
        setTimeout(() => {
          controls?.stop();
          onClose();
        }, 20000);
      } catch (err) {
        toast.error("Unable to access camera");
        onClose();
      }
    };

    startScanner();

    return () => {
      mounted = false;
      codeReaderRef.current?.stop();
    };
  }, [open, onClose, onScan]);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogTitle>Scan Booking</DialogTitle>
      <DialogContent className="p-4 max-w-sm flex items-center justify-center">
        {loading && (
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="animate-spin h-8 w-8 text-muted-foreground" />
            <span className="text-muted-foreground text-sm">Initializing camera...</span>
          </div>
        )}
        <video
          ref={videoRef}
          className={`w-full h-full rounded-md ${loading ? "hidden" : "block"}`}
        />
      </DialogContent>
    </Dialog>
  );
}