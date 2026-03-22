// Confirm.tsx
import * as Dialog from "@radix-ui/react-dialog";
import { useState, createContext, useContext, ReactNode } from "react";

type ConfirmOptions = {
  title?: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
  cancelClassName?: string;
  confirmClassName?: string;
};

type ConfirmContextType = (options?: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmContextType | null>(null);

 const useConfirm = () => {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error("useConfirm must be used within ConfirmProvider");
  return ctx;
};

 const ConfirmProvider = ({ children }: { children: ReactNode }) => {
  const [state, setState] = useState<{
    options?: ConfirmOptions;
    resolve?: (value: boolean) => void;
    open: boolean;
  }>({ open: false });

  const confirm: ConfirmContextType = (options) => {
    return new Promise((resolve) => {
      setState({ open: true, options, resolve });
    });
  };

  const handleClose = (result: boolean) => {
    state.resolve?.(result);
    setState({ ...state, open: false, resolve: undefined });
  };

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <Dialog.Root
  open={state.open}
  onOpenChange={(open) => !open && handleClose(false)}
>
  <Dialog.Portal>
    {/* Overlay with higher z-index */}
    <Dialog.Overlay className="fixed inset-0 bg-black/50 z-[9999]" />

    {/* Content with higher z-index */}
    <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-background text-foreground border border-border p-6 rounded-lg shadow-lg z-[10000] max-w-md w-[calc(100%-2rem)]">
      <Dialog.Title className="text-lg font-bold text-foreground">
        {state.options?.title || "Are you sure?"}
      </Dialog.Title>
      <Dialog.Description className="mt-2 text-muted-foreground">
        {state.options?.description || "This action cannot be undone."}
      </Dialog.Description>
      <div className="mt-4 flex justify-end gap-2">
        <button
          className={"px-4 py-1 rounded bg-secondary text-secondary-foreground hover:bg-secondary/80 " + (state.options?.cancelClassName || "")}
          onClick={() => handleClose(false)}
        >
          {state.options?.cancelText || "Cancel"}
        </button>
        <button
          onClick={() => handleClose(true)}
          className={
            state.options?.confirmClassName
              ? "px-4 py-1 rounded " + state.options?.confirmClassName
              : "px-4 py-1 rounded bg-primary text-primary-foreground"
          }
        >
          {state.options?.confirmText || "Confirm"}
        </button>
      </div>
    </Dialog.Content>
  </Dialog.Portal>
</Dialog.Root>

    </ConfirmContext.Provider>
  );
};

export {
    useConfirm,
    ConfirmProvider,
}