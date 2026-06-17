"use server";

import { getSupabase } from "@/lib/supabase";
import { revalidatePath } from "next/cache";

// Phase 2 (Model A): the cloud only CAPTURES the mapping decision into
// mapping_reviews. The local apply pipeline (pull_reviews.py -> apply_mapping_review.py
// -> push_to_supabase.py) turns it into the real mapped state. No multi-table writes here.
// NOTE: auth gating is deferred — protect this deployment via Vercel access control for now.

export async function resolveReview(
  id: number,
  listingId: number | null,
  correctSku: string,
  productName: string,
): Promise<{ ok: boolean; error?: string }> {
  const sku = (correctSku || "").trim();
  if (!sku) return { ok: false, error: "Correct SKU is required" };
  const sb = getSupabase();
  const patch = {
    status: "done" as const,
    correct_sku: sku,
    product_name: productName?.trim() || null,
    reviewed_by: "cloud-review",
    reviewed_at: new Date().toISOString(),
  };
  // A listing has one pending review per weekly file (all-history). Resolve them all
  // so the listing fully leaves the queue and every weekly occurrence gets applied.
  const q = sb.from("mapping_reviews").update(patch);
  const { error } = listingId != null
    ? await q.eq("listing_id", listingId).eq("status", "pending")
    : await q.eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/reviews");
  return { ok: true };
}

export async function reopenReview(id: number): Promise<{ ok: boolean; error?: string }> {
  const sb = getSupabase();
  const { error } = await sb
    .from("mapping_reviews")
    .update({ status: "pending", correct_sku: null, reviewed_by: null, reviewed_at: null })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/reviews");
  return { ok: true };
}
