import {
  BookOpen,
  ChefHat,
  ClipboardCheck,
  ShieldCheck,
  Thermometer,
  Utensils,
} from 'lucide-react';

const PROCEDURE_CATEGORIES = [
  {
    icon: Thermometer,
    title: 'בטיחות מזון וטמפרטורות',
    items: [
      'בדיקת טמפרטורת מקרר — מתחת ל-4°C',
      'בדיקת טמפרטורת מקפיא — מתחת ל-18°C-',
      'בדיקת טמפרטורת אחסון חם — מעל ל-60°C',
      'תיעוד טמפרטורות פעמיים ביום',
    ],
  },
  {
    icon: ClipboardCheck,
    title: 'פתיחת משמרת',
    items: [
      'בדיקת רשימת Prep ל-shift',
      'בדיקת מלאי ראשוני',
      'ניקוי ועיקור משטחי עבודה',
      'בדיקת תאריכי תפוגה של מוצרים',
    ],
  },
  {
    icon: Utensils,
    title: 'הכנה וציוד',
    items: [
      'תחלופת שמן טיגון לפי צבע/טעם',
      'ניקוי מכונות קפה לפי נוהל',
      'בדיקת ציוד מדידה (קנה מידה)',
      'FIFO — ראשון נכנס ראשון יוצא',
    ],
  },
  {
    icon: ShieldCheck,
    title: 'היגיינה ובטיחות',
    items: [
      'שטיפת ידיים לפי נוהל (20 שניות)',
      'לבוש אחיד ומגן ראש',
      'הפרדת מוצרים גולמיים מבשלים',
      'ניקוי ועיקור אחרי כל ניתוח בשר',
    ],
  },
  {
    icon: ChefHat,
    title: 'סגירת משמרת',
    items: [
      'כיסוי ותיוג כל חומרי הגלם',
      'ניקוי עמוק של ציוד גדול',
      'עדכון יומן waste',
      'דיווח על חריגות לסו-שף',
    ],
  },
  {
    icon: BookOpen,
    title: 'תיעוד ודיווח',
    items: [
      'מילוי יומן טמפרטורות יומי',
      'תיעוד waste בסוף כל משמרת',
      'דיווח על ציוד תקול מיידית',
      'עדכון רשימת Prep למחרת',
    ],
  },
];

export default function ProceduresPage() {
  return (
    <div className="space-y-8 py-2">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">נהלים</h1>
          <p className="text-muted-foreground mt-1 text-sm">נהלי עבודה סטנדרטיים למסעדה</p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {PROCEDURE_CATEGORIES.map(({ icon: Icon, title, items }) => (
          <div key={title} className="bg-card rounded-xl border p-5 shadow-sm">
            <div className="mb-4 flex items-center gap-2">
              <div className="bg-primary/10 flex h-8 w-8 items-center justify-center rounded-lg">
                <Icon className="text-primary h-4 w-4" />
              </div>
              <h2 className="text-sm font-semibold">{title}</h2>
            </div>
            <ul className="space-y-2">
              {items.map((item) => (
                <li key={item} className="flex items-start gap-2 text-sm">
                  <span className="text-primary mt-1 text-xs">✓</span>
                  <span className="text-muted-foreground">{item}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="bg-muted/40 rounded-xl border border-dashed p-6 text-center">
        <p className="text-muted-foreground text-sm font-medium">נהלים מותאמים אישית — בקרוב</p>
        <p className="text-muted-foreground mt-1 text-xs">
          יצירת נהלים מותאמים, חתימה דיגיטלית, ומעקב ציות
        </p>
      </div>
    </div>
  );
}
