import { createContext, useContext, useState, useCallback, useRef } from 'react';

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const idRef = useRef(0);

  const showToast = useCallback((message, options = {}) => {
    const id = ++idRef.current;
    const { actionLabel, onAction, duration } = options;
    const finalDuration = duration ?? (actionLabel ? 6000 : 2500);
    setToasts(t => [...t, { id, message, actionLabel, onAction }]);
    setTimeout(() => {
      setToasts(t => t.filter(toast => toast.id !== id));
    }, finalDuration);
    return id;
  }, []);

  function dismiss(id) {
    setToasts(t => t.filter(toast => toast.id !== id));
  }

  return (
    <ToastContext.Provider value={showToast}>
      {children}
      <div className="toast-stack">
        {toasts.map(t => (
          <div key={t.id} className="toast">
            <span>{t.message}</span>
            {t.actionLabel && (
              <button
                type="button"
                className="toast-action-btn"
                onClick={() => { t.onAction?.(); dismiss(t.id); }}
              >
                {t.actionLabel}
              </button>
            )}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}