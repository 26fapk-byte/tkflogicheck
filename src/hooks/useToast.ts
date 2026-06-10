import { useCallback, useState } from 'react';

type ToastType = 'success' | 'error';

export interface ToastState {
  visible: boolean;
  type: ToastType;
  message: string;
}

export function useToast() {
  const [toast, setToast] = useState<ToastState>({
    visible: false,
    type: 'success',
    message: ''
  });

  const showToast = useCallback((message: string, type: ToastType = 'success') => {
    setToast({ visible: true, type, message });
    window.setTimeout(() => {
      setToast(prev => ({ ...prev, visible: false }));
    }, 2600);
  }, []);

  return { toast, showToast };
}
