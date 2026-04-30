import { notFound } from 'next/navigation';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function ComponentShowcasePage() {
  if (process.env.NEXT_PUBLIC_ENV === 'production') {
    notFound();
  }

  return (
    <div className="flex flex-col gap-10 pb-20">
      <div>
        <h1 className="text-3xl font-bold">ספריית רכיבים — בדיקת RTL</h1>
        <p className="text-muted-foreground mt-1">דף פיתוח בלבד. כל הרכיבים מוצגים עם טקסט עברי.</p>
      </div>

      {/* Buttons */}
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">כפתורים</h2>
        <div className="flex flex-wrap gap-3">
          <Button>ברירת מחדל</Button>
          <Button variant="secondary">משני</Button>
          <Button variant="outline">מסגרת</Button>
          <Button variant="destructive">מחק</Button>
          <Button variant="ghost">רוח</Button>
          <Button disabled>מושבת</Button>
        </div>
      </section>

      <Separator />

      {/* Badges */}
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">תגיות</h2>
        <div className="flex flex-wrap gap-2">
          <Badge>בעלים</Badge>
          <Badge variant="secondary">מנהל</Badge>
          <Badge variant="outline">שף</Badge>
          <Badge variant="destructive">לא פעיל</Badge>
        </div>
      </section>

      <Separator />

      {/* Input + Label */}
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">שדות קלט</h2>
        <div className="flex max-w-sm flex-col gap-1.5">
          <Label htmlFor="demo-email">אימייל</Label>
          <Input id="demo-email" type="email" placeholder="name@example.com" dir="ltr" />
        </div>
        <div className="flex max-w-sm flex-col gap-1.5">
          <Label htmlFor="demo-name">שם המסעדה</Label>
          <Input id="demo-name" type="text" placeholder="מסעדה גדולה" />
        </div>
      </section>

      <Separator />

      {/* Card */}
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">כרטיסים</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle>עלות מזון</CardTitle>
              <CardDescription>אחוז עלות מזון מהמכירות</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">28.4%</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>הזמנות היום</CardTitle>
              <CardDescription>סך ההזמנות שנרשמו</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">142</p>
            </CardContent>
          </Card>
        </div>
      </section>

      <Separator />

      {/* Tabs */}
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">טאבים</h2>
        <Tabs defaultValue="overview">
          <TabsList>
            <TabsTrigger value="overview">סקירה</TabsTrigger>
            <TabsTrigger value="details">פרטים</TabsTrigger>
            <TabsTrigger value="settings">הגדרות</TabsTrigger>
          </TabsList>
          <TabsContent value="overview">
            <p className="text-muted-foreground mt-3 text-sm">תוכן הסקירה מופיע כאן.</p>
          </TabsContent>
          <TabsContent value="details">
            <p className="text-muted-foreground mt-3 text-sm">פרטים נוספים מופיעים כאן.</p>
          </TabsContent>
        </Tabs>
      </section>

      <Separator />

      {/* Table */}
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">טבלה</h2>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>מוצר</TableHead>
              <TableHead>קטגוריה</TableHead>
              <TableHead className="text-end" dir="ltr">
                מחיר
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {[
              { name: 'עוף שלם', cat: 'בשר', price: '₪42.00' },
              { name: 'פסטה ריגטוני', cat: 'פחמימות', price: '₪8.50' },
              { name: 'שמן זית', cat: 'שמנים', price: '₪35.00' },
            ].map((row) => (
              <TableRow key={row.name}>
                <TableCell className="font-medium">{row.name}</TableCell>
                <TableCell>
                  <Badge variant="outline">{row.cat}</Badge>
                </TableCell>
                <TableCell className="text-end" dir="ltr">
                  {row.price}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </section>

      <Separator />

      {/* Alert */}
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">התראות</h2>
        <Alert>
          <AlertTitle>עדכון מערכת</AlertTitle>
          <AlertDescription>גרסה חדשה של המערכת תוטמע הלילה בין 2:00–4:00.</AlertDescription>
        </Alert>
        <Alert variant="destructive">
          <AlertTitle>שגיאה</AlertTitle>
          <AlertDescription>לא ניתן לשמור את הנתונים. בדוק את החיבור לאינטרנט.</AlertDescription>
        </Alert>
      </section>

      <Separator />

      {/* Skeleton */}
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">טעינה (Skeleton)</h2>
        <div className="flex flex-col gap-2">
          <Skeleton className="h-4 w-[250px]" />
          <Skeleton className="h-4 w-[200px]" />
          <Skeleton className="h-4 w-[180px]" />
        </div>
      </section>

      <Separator />

      {/* Avatar */}
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">אווטרים</h2>
        <div className="flex gap-3">
          <Avatar>
            <AvatarFallback>אב</AvatarFallback>
          </Avatar>
          <Avatar className="h-12 w-12">
            <AvatarFallback>שמ</AvatarFallback>
          </Avatar>
        </div>
      </section>
    </div>
  );
}
