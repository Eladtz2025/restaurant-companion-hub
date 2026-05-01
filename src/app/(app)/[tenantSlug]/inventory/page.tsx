import Link from 'next/link';

import { Button } from '@/components/ui/button';

export default async function InventoryPage({
  params,
}: {
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = await params;
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold">מלאי</h1>
      <div className="flex gap-2">
        <Button asChild>
          <Link href={`/${tenantSlug}/inventory/ingredients`}>מרכיבים</Link>
        </Button>
      </div>
    </div>
  );
}
