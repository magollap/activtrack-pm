import { useEffect } from 'react';
import { useToast } from '@/hooks/useToast';
import { onAutomationsRan } from '@/lib/db/automations';

/** Tells the person when one of the project's automations changed the card they just touched. */
export function AutomationToasts() {
  const toast = useToast();
  useEffect(
    () =>
      onAutomationsRan((ran) => {
        const names = [...new Set(ran.map((r) => r.rule))];
        toast.success(`Automation ran: ${names.join(', ')}`);
      }),
    [toast],
  );
  return null;
}
