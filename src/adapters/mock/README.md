# Mock Adapters

Mock adapters stand in for external API integrations that are not yet live for a given tenant. They return realistic Hebrew demo data so that every screen is fully functional and testable before an API contract is signed.

---

## Rules

1. **Never deployed to production.** Every mock adapter checks `process.env.NEXT_PUBLIC_ENV !== 'production'` at construction time and throws if the check fails. This is a hard guard — not advisory.

2. **Realistic data only.** Demo data must look like real Israeli restaurant data: Hebrew item names, ILS prices in agorot, realistic timestamps in `Asia/Jerusalem`, plausible quantities. Fake-looking placeholder text is not acceptable.

3. **One mock per adapter type.** Each interface has exactly one mock implementation:

   | Interface             | Mock class                | Replaces  |
   | --------------------- | ------------------------- | --------- |
   | `POSAdapter`          | `MockPOSAdapter`          | Tabit     |
   | `ReservationsAdapter` | `MockReservationsAdapter` | OnTopo    |
   | `AccountingAdapter`   | `MockAccountingAdapter`   | Sumit     |
   | `InventoryAdapter`    | `MockInventoryAdapter`    | Marketman |

4. **Interface-compatible.** Mock adapters must satisfy the same TypeScript interface as their real counterpart. If the real adapter adds a method, the mock must too.

5. **`ComingSoonBadge` companion.** Any screen that injects a mock adapter must render `<ComingSoonBadge reason="...">` so the user knows the data is not live. The badge disappears automatically when a real adapter is active (use `adapter.isLive()` to detect).

---

## File layout

```
src/adapters/
  interfaces/
    POSAdapter.ts           ← TypeScript interface
    ReservationsAdapter.ts
    AccountingAdapter.ts
    InventoryAdapter.ts
  tabit/
    TabitAdapter.ts
  ontopo/
    OnTopoAdapter.ts
  sumit/
    SumitAdapter.ts
  marketman/
    MarketmanAdapter.ts
  mock/
    MockPOSAdapter.ts
    MockReservationsAdapter.ts
    MockAccountingAdapter.ts
    MockInventoryAdapter.ts
    README.md               ← this file
```

Interfaces and real adapters are created when the corresponding phase begins. Mock adapters are created alongside the interface so screens can be built immediately.

---

## Adding a new mock adapter

1. Create the interface in `src/adapters/interfaces/`.
2. Create `MockXxxAdapter.ts` in this directory, implementing the interface.
3. Add the guard at the top of the constructor:
   ```typescript
   if (process.env.NEXT_PUBLIC_ENV === 'production') {
     throw new Error('MockXxxAdapter cannot be used in production');
   }
   ```
4. Export from `src/adapters/mock/index.ts`.
5. Update the table above.
