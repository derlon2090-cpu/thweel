import * as schema from "./schema";

export { schema };

export function getDb() {
  throw new Error(
    "Database is not configured for this Vercel deployment yet. Connect Supabase/Postgres or another hosted database before calling getDb()."
  );
}
