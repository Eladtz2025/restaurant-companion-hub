import { TrendingDown, TrendingUp, Minus } from 'lucide-react';

import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

type Props = {
  title: string;
  value?: string;
  unit?: string;
  trend?: 'up' | 'down' | 'neutral';
  isLoading?: boolean;
};

export function KPICard({ title, value, unit, trend = 'neutral', isLoading = false }: Props) {
  const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus;
  const trendColor =
    trend === 'up' ? 'text-green-600' : trend === 'down' ? 'text-red-500' : 'text-muted-foreground';

  return (
    <div className="bg-card flex flex-col gap-3 rounded-xl border p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-muted-foreground text-sm">{title}</p>
        <TrendIcon className={cn('h-4 w-4', trendColor)} />
      </div>
      {isLoading ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-8 w-24" />
          <Skeleton className="h-3 w-16" />
        </div>
      ) : (
        <div>
          <p className="text-3xl font-bold">{value ?? '—'}</p>
          {unit && <p className="text-muted-foreground mt-0.5 text-xs">{unit}</p>}
        </div>
      )}
    </div>
  );
}
