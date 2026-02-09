import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../../db/database.types";
import type {
  DictionarySyncResource,
  DictionarySyncResponseDto,
  DictionarySyncJobDto,
} from "../../types";
import type { DictionarySyncInput } from "../schemas/dictionary-sync.schema";
import {
  fetchCompaniesFromErp,
  fetchLocationsFromErp,
  fetchProductsFromErp,
} from "./erp-client";
import type { ErpCompany, ErpLocation, ErpProduct } from "./erp-client";

// ---------------------------------------------------------------------------
// In-memory job store (MVP — replace with DB table or queue in production)
// ---------------------------------------------------------------------------

interface SyncJob {
  jobId: string;
  status: "STARTED" | "IN_PROGRESS" | "COMPLETED" | "FAILED";
  resources: DictionarySyncResource[];
  startedAt: string;
  completedAt: string | null;
  error: string | null;
}

/** Simple in-memory store for sync jobs. Cleared on server restart. */
const jobStore = new Map<string, SyncJob>();

/** Timestamp of the last sync start — used for rate limiting (max 1/min). */
let lastSyncStartedAt: number | null = null;

// ---------------------------------------------------------------------------
// Rate limiting
// ---------------------------------------------------------------------------

const RATE_LIMIT_MS = 60 * 1000; // 1 minute

/**
 * Checks if a new sync can be started based on rate limit (max 1 per minute).
 * @returns `null` if allowed, or an error message string if rate-limited.
 */
function checkRateLimit(): string | null {
  if (lastSyncStartedAt !== null) {
    const elapsed = Date.now() - lastSyncStartedAt;
    if (elapsed < RATE_LIMIT_MS) {
      const remainingSeconds = Math.ceil((RATE_LIMIT_MS - elapsed) / 1000);
      return `Synchronizacja może być uruchomiona raz na minutę. Spróbuj ponownie za ${remainingSeconds}s.`;
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Sync logic — per resource type
// ---------------------------------------------------------------------------

/**
 * Synchronizes companies from ERP to the local database.
 *
 * Logic (upsert by erp_id):
 * - If a record with the same erp_id exists → update name, tax_id, type, notes.
 * - If it doesn't exist → insert new record.
 * - Records present in DB but absent from ERP → set is_active = false.
 */
async function syncCompanies(
  supabase: SupabaseClient<Database>,
  erpData: ErpCompany[]
): Promise<void> {
  if (erpData.length === 0) return;

  // Fetch existing companies that have erp_id set
  const { data: existing } = await supabase
    .from("companies")
    .select("id, erp_id")
    .not("erp_id", "is", null);

  const existingByErpId = new Map<string, string>(
    (existing ?? [])
      .filter((c): c is typeof c & { erp_id: string } => c.erp_id !== null)
      .map((c) => [c.erp_id, c.id])
  );

  const erpIds = new Set(erpData.map((c) => c.erpId));

  // Upsert each ERP record
  for (const company of erpData) {
    const existingId = existingByErpId.get(company.erpId);

    if (existingId) {
      // Update existing record
      await supabase
        .from("companies")
        .update({
          name: company.name,
          tax_id: company.taxId,
          type: company.type,
          notes: company.notes,
          is_active: true,
        })
        .eq("id", existingId);
    } else {
      // Insert new record
      await supabase.from("companies").insert({
        erp_id: company.erpId,
        name: company.name,
        tax_id: company.taxId,
        type: company.type,
        notes: company.notes,
        is_active: true,
      });
    }
  }

  // Deactivate records present in DB but absent from ERP
  for (const [erpId, id] of existingByErpId) {
    if (!erpIds.has(erpId)) {
      await supabase
        .from("companies")
        .update({ is_active: false })
        .eq("id", id);
    }
  }
}

/**
 * Synchronizes locations from ERP to the local database.
 * Analogous to syncCompanies — upsert by erp_id, deactivate missing.
 */
async function syncLocations(
  supabase: SupabaseClient<Database>,
  erpData: ErpLocation[]
): Promise<void> {
  if (erpData.length === 0) return;

  const { data: existing } = await supabase
    .from("locations")
    .select("id, erp_id")
    .not("erp_id", "is", null);

  const existingByErpId = new Map<string, string>(
    (existing ?? [])
      .filter((l): l is typeof l & { erp_id: string } => l.erp_id !== null)
      .map((l) => [l.erp_id, l.id])
  );

  const erpIds = new Set(erpData.map((l) => l.erpId));

  // To map companyErpId → companyId, fetch companies by erp_id
  const companyErpIds = [...new Set(erpData.map((l) => l.companyErpId))];
  const { data: companies } = await supabase
    .from("companies")
    .select("id, erp_id")
    .in("erp_id", companyErpIds);

  const companyIdByErpId = new Map(
    (companies ?? []).map((c) => [c.erp_id, c.id])
  );

  for (const location of erpData) {
    const companyId = companyIdByErpId.get(location.companyErpId);
    if (!companyId) continue; // Skip if parent company not found

    const existingId = existingByErpId.get(location.erpId);

    if (existingId) {
      await supabase
        .from("locations")
        .update({
          name: location.name,
          company_id: companyId,
          street_and_number: location.streetAndNumber,
          city: location.city,
          postal_code: location.postalCode,
          country: location.country,
          notes: location.notes,
          is_active: true,
        })
        .eq("id", existingId);
    } else {
      await supabase.from("locations").insert({
        erp_id: location.erpId,
        name: location.name,
        company_id: companyId,
        street_and_number: location.streetAndNumber,
        city: location.city,
        postal_code: location.postalCode,
        country: location.country,
        notes: location.notes,
        is_active: true,
      });
    }
  }

  for (const [erpId, id] of existingByErpId) {
    if (!erpIds.has(erpId)) {
      await supabase
        .from("locations")
        .update({ is_active: false })
        .eq("id", id);
    }
  }
}

/**
 * Synchronizes products from ERP to the local database.
 * Analogous to syncCompanies — upsert by erp_id, deactivate missing.
 */
async function syncProducts(
  supabase: SupabaseClient<Database>,
  erpData: ErpProduct[]
): Promise<void> {
  if (erpData.length === 0) return;

  const { data: existing } = await supabase
    .from("products")
    .select("id, erp_id")
    .not("erp_id", "is", null);

  const existingByErpId = new Map<string, string>(
    (existing ?? [])
      .filter((p): p is typeof p & { erp_id: string } => p.erp_id !== null)
      .map((p) => [p.erp_id, p.id])
  );

  const erpIds = new Set(erpData.map((p) => p.erpId));

  for (const product of erpData) {
    const existingId = existingByErpId.get(product.erpId);

    if (existingId) {
      await supabase
        .from("products")
        .update({
          name: product.name,
          description: product.description,
          default_loading_method_code: product.defaultLoadingMethodCode,
          is_active: true,
        })
        .eq("id", existingId);
    } else {
      await supabase.from("products").insert({
        erp_id: product.erpId,
        name: product.name,
        description: product.description,
        default_loading_method_code: product.defaultLoadingMethodCode,
        is_active: true,
      });
    }
  }

  for (const [erpId, id] of existingByErpId) {
    if (!erpIds.has(erpId)) {
      await supabase
        .from("products")
        .update({ is_active: false })
        .eq("id", id);
    }
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Starts dictionary synchronization for the requested resources.
 *
 * MVP implementation: synchronization runs synchronously in the background
 * (fire-and-forget). The endpoint returns immediately with a jobId and
 * STARTED status. The job status can be checked via getJobStatus().
 *
 * @returns DictionarySyncResponseDto with jobId and status, or error object.
 */
export async function startDictionarySync(
  supabase: SupabaseClient<Database>,
  _userId: string,
  command: DictionarySyncInput
): Promise<
  DictionarySyncResponseDto | { error: string; status: number; message?: string }
> {
  // 1. Rate limit check
  const rateLimitError = checkRateLimit();
  if (rateLimitError) {
    return { error: "RATE_LIMITED", status: 429, message: rateLimitError };
  }

  // 2. Create job record
  const jobId = crypto.randomUUID();
  const job: SyncJob = {
    jobId,
    status: "STARTED",
    resources: command.resources,
    startedAt: new Date().toISOString(),
    completedAt: null,
    error: null,
  };
  jobStore.set(jobId, job);
  lastSyncStartedAt = Date.now();

  // 3. Run sync in background (fire-and-forget for MVP)
  //    Using void + .catch() so the promise doesn't block the response
  void (async () => {
    try {
      job.status = "IN_PROGRESS";

      for (const resource of command.resources) {
        switch (resource) {
          case "COMPANIES": {
            const data = await fetchCompaniesFromErp();
            await syncCompanies(supabase, data);
            break;
          }
          case "LOCATIONS": {
            const data = await fetchLocationsFromErp();
            await syncLocations(supabase, data);
            break;
          }
          case "PRODUCTS": {
            const data = await fetchProductsFromErp();
            await syncProducts(supabase, data);
            break;
          }
        }
      }

      job.status = "COMPLETED";
      job.completedAt = new Date().toISOString();
    } catch (err) {
      job.status = "FAILED";
      job.completedAt = new Date().toISOString();
      job.error = err instanceof Error ? err.message : "Unknown error";
    }
  })();

  // 4. Return immediately with job reference
  return {
    jobId,
    status: "STARTED",
  };
}

/**
 * Returns the current status of a dictionary sync job.
 *
 * @returns DictionarySyncJobDto or null if the job doesn't exist.
 */
export function getJobStatus(jobId: string): DictionarySyncJobDto | null {
  const job = jobStore.get(jobId);
  if (!job) return null;

  return {
    jobId: job.jobId,
    status: job.status,
  };
}
