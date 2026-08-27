import { useCallback, useEffect, useState } from 'react';
import { fetchEquipments } from '../lib/db';
import { Equipment } from '../types';

export function useEquipments() {
  const [equipments, setEquipments] = useState<Equipment[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const list = await fetchEquipments();
      setEquipments(list);
    } catch {
      // silent - fetchEquipments already returns [] on error
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  return { equipments, loading, reload };
}
