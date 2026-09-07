import { sql } from "drizzle-orm";
import { contents, type ContentStatus } from "../db/schema";

// Evaluate against the current database value so autosave cannot overwrite a
// status changed by another request while the draft was being prepared.
export const statusAfterContentEdit = sql<ContentStatus>`case when ${contents.status} = 'new' then 'in_progress' else ${contents.status} end`;
