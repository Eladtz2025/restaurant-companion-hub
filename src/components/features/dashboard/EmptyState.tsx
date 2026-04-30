import type { LucideIcon } from 'lucide-react';

type Props = {
  icon: LucideIcon;
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
};

export function EmptyState({ icon: Icon, title, subtitle, action }: Props) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed py-12 text-center">
      <Icon className="text-muted-foreground h-10 w-10" strokeWidth={1.5} />
      <div>
        <p className="font-medium">{title}</p>
        {subtitle && <p className="text-muted-foreground mt-0.5 text-sm">{subtitle}</p>}
      </div>
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}
