# ACY Club V10.0.1 – sichere Supabase-Migration

Die V10-Migration lief in einem großen SQL-Block und ist an einer Sperr-Kollision (Deadlock) gescheitert.

**Nicht denselben Komplettblock direkt erneut ausführen.**

Stattdessen die SQL-Dateien einzeln im Supabase SQL Editor ausführen:

1. `01_push_and_quests.sql`
2. `02_reports.sql`
3. `03_mod_chat_policies.sql`

Zwischen den Dateien kurz warten, bis jeweils `Success` erscheint.

Wenn eine einzelne Datei wieder mit `40P01 deadlock detected` scheitert, **nicht mehrfach klicken**, sondern Screenshot senden. Dann können wir genau die betroffene Tabelle isolieren.

Die Dateien sind idempotent ausgelegt (`IF NOT EXISTS` / `DROP POLICY IF EXISTS` / `CREATE OR REPLACE`), sodass ein erfolgreicher Schritt danach nicht manuell zurückgerollt werden muss.
