import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../../db/database.types";

/**
 * Generates a unique order number in the format ZT{year}/{seq}.
 * Example: ZT2026/0001, ZT2026/0042
 *
 * Finds the current max order_no for the given year and increments.
 * Falls back to 0001 if no orders exist for the year.
 */
export async function generateOrderNo(
  supabase: SupabaseClient<Database>,
  year: number
): Promise<string> {
  const prefix = `ZT${year}/`;

  // Find the highest existing order number for this year
  const { data, error } = await supabase
    .from("transport_orders")
    .select("order_no")
    .like("order_no", `${prefix}%`)
    .order("order_no", { ascending: false })
    .limit(1);

  if (error) throw error;

  let nextSeq = 1;

  if (data && data.length > 0) {
    // Extract the numeric part after "ZT2026/"
    const lastNo = data[0].order_no;
    const seqPart = lastNo.replace(prefix, "");
    const parsed = parseInt(seqPart, 10);
    if (!isNaN(parsed)) {
      nextSeq = parsed + 1;
    }
  }

  // Pad sequence to 4 digits (0001, 0042, etc.)
  const seqStr = nextSeq.toString().padStart(4, "0");
  return `${prefix}${seqStr}`;
}
