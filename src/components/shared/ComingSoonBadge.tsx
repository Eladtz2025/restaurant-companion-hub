import { Clock } from 'lucide-react';

import { cn } from '@/lib/utils';

type Props = {
  reason?: string;
  className?: string;
};

export function ComingSoonBadge({ reason, className }: Props) {
  return (
    <span
      title={reason}
      className={cn(
        'inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
        className,
      )}
    >
      <Clock className="h-3 w-3 shrink-0" />
      בקרוב
    </span>
  );
}
