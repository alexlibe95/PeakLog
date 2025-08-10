import { createContext, useCallback, useContext, useMemo, useState } from 'react';

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const remove = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const add = useCallback(({ title, description = '', variant = 'default', duration = 3500 }) => {
    const id = Math.random().toString(36).slice(2);
    const toast = { id, title, description, variant };
    setToasts((prev) => [...prev, toast]);
    if (duration > 0) {
      setTimeout(() => remove(id), duration);
    }
    return id;
  }, [remove]);

  const value = useMemo(() => ({ add, remove }), [add, remove]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastViewport toasts={toasts} onClose={remove} />
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return {
    toast: ctx.add,
    dismiss: ctx.remove,
  };
}

function ToastViewport({ toasts, onClose }) {
  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 w-[320px] max-w-[90vw]">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={[
            'rounded-md shadow-lg border p-3 bg-background',
            t.variant === 'destructive' ? 'border-destructive/30 bg-red-50' : 'border-border',
          ].join(' ')}
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              {t.title && <div className="font-medium">{t.title}</div>}
              {t.description && <div className="text-sm text-muted-foreground mt-0.5">{t.description}</div>}
            </div>
            <button
              className="text-sm text-muted-foreground hover:text-foreground"
              onClick={() => onClose(t.id)}
              aria-label="Close"
            >
              ✕
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}


