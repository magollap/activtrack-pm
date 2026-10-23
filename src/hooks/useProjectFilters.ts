import { useCallback, useEffect, useState } from 'react';
import { getProjectFilters, setProjectFilters, type TaskFilters } from '@/lib/prefs';

export function useProjectFilters(projectId: string): [TaskFilters, (next: TaskFilters) => void] {
  const [filters, setFilters] = useState<TaskFilters>(() => getProjectFilters(projectId));

  useEffect(() => {
    setFilters(getProjectFilters(projectId));
  }, [projectId]);

  const update = useCallback((next: TaskFilters) => {
    setFilters(next);
    setProjectFilters(projectId, next);
  }, [projectId]);

  return [filters, update];
}
