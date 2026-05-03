import { Activity } from 'lucide-react';

import { EmptyState } from './EmptyState';

export type ActivityItem = {
  id: string;
  icon: React.ReactNode | null;
  text: string;
  timestamp: string;
};

type Props = {
  items?: ActivityItem[];
};

export function ActivityFeed({ items = [] }: Props) {
  if (items.length === 0) {
    return (
      <EmptyState
        icon={Activity}
        title="אין פעילות אחרונה"
        subtitle="פעולות שיתבצעו במערכת יופיעו כאן"
      />
    );
  }

  return (
    <ul className="flex flex-col divide-y">
      {items.map((item) => (
        <li key={item.id} className="flex items-start gap-3 py-3">
          <div className="bg-muted mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full">
            {item.icon}
          </div>
          <div className="flex-1 text-sm">
            <p>{item.text}</p>
            <p className="text-muted-foreground mt-0.5 text-xs">{item.timestamp}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}
