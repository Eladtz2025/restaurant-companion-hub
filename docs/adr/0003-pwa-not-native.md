# ADR-0003: PWA over Native Mobile

**Status:** Accepted  
**Date:** 2026-04-30  
**Author:** Elad

## Context

המוצר משמש בעיקר במכשירים ניידים (טאבלטים במטבח, טלפונים בידי שפים ומלצרים). שתי אפשרויות:

1. **Native** — React Native או Swift/Kotlin. שני קוד-bases (iOS + Android) או אחד (RN).
2. **Progressive Web App** — אותו web app, מותקן ב-home screen, service worker לקאש ו-offline.

## Decision

**PWA בלבד ב-V1. שיקול מחדש של native רק אחרי Phase 9 (פיילוט).**

קריטריונים שיצדיקו מעבר ל-native אחר כך:
- צורך ב-offline אמיתי עם sync מורכב (לא רק קאש)
- Push notifications עם reliability גבוהה (Apple מגביל ב-PWA)
- ביצועים שלא מושגים ב-PWA (לא צפוי במוצר הזה)
- דרישת לקוחות לאפליקציה ב-App Store ככלי מכירה

## Consequences

**Positive:**
- חיסכון 4-6 חודשי פיתוח של V1.
- Codebase אחד — בגים מתקנים פעם אחת.
- Deploy מיידי, ללא App Store review.
- כל device משתמשת באותה גרסה — אין גרסאות מרובות בייצור.
- אין צורך ב-Apple Developer Program ($99/שנה) או Google Play ($25 חד-פעמי) ב-V1.
- קל לעדכן בלי להכריח התקנה מחדש.

**Negative:**
- Push notifications ב-iOS מוגבלים (משתפר אבל לא מושלם).
- אין גישה ל-camera APIs מתקדמים (בעיה למימוש barcode scanner מתקדם).
- ב-Safari, IndexedDB מוגבל ל-50MB ללא היתר. דורש בקשת persistent storage.
- "להתקין" PWA לא טריוויאלי לכל משתמש.
- iOS מקבע שירות worker אחרי תקופת אי-שימוש.

**Neutral:**
- חוויה דומה ל-native ב-Android.
- בעלי המסעדה לא תופסים את ההבדל אם UX טוב.

## Alternatives Considered

1. **React Native** — נדחה ל-V1. מוסיף 4-6 חודשים פיתוח, codebase מעט שונה, app store overhead. אופציה ל-V2.
2. **Native iOS + Android** — נדחה. שני codebases לא מציאותי בצוות קטן.
3. **Capacitor (web-to-native wrapper)** — נדחה. קומפרומיס שמוסיף complexity בלי benefit אמיתי.
4. **Tauri Mobile** — נדחה. בשלות לא מספקת ב-2026.

## Implementation Notes

- `next-pwa` או `@serwist/next` ל-service worker.
- `manifest.json` עם icons (192px, 512px, maskable).
- `theme_color` תואם לזהות הויזואלית.
- Wake Lock API במסכי spec של מטבח (שמסך לא יכבה בזמן עבודה).
- Persistent Storage API: בקשה אקטיבית להיתר.
- Background Sync למצבי offline (queue של פעולות).
- Install prompt רק אחרי 3 ביקורים מוצלחים.

## When to Reconsider

- אחרי 30 ימי פיילוט: אם > 20% מהמשתמשים מתלוננים על UX.
- אם push notifications ב-iOS חסרות באופן שעוצר ערך.
- אם מסעדנים מבקשים אפליקציה ב-App Store.

אז: ADR חדש שמסומן `Supersedes ADR-0003`.

## References

- [PWA on iOS limitations](https://firt.dev/notes/pwa-ios/)
- [next-pwa](https://github.com/shadowwalker/next-pwa)
- ARCHITECTURE.md §17.4 — PWA
