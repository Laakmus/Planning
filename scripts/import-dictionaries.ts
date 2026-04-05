/**
 * Skrypt importu słowników z plików Excel (ERP) do Supabase Cloud.
 *
 * Użycie:
 *   npx tsx scripts/import-dictionaries.ts --dry-run          # podgląd bez zapisu
 *   npx tsx scripts/import-dictionaries.ts                     # import do bazy
 *
 * Wymagane zmienne środowiskowe (lub plik .env w katalogu głównym):
 *   SUPABASE_URL          — URL projektu Supabase
 *   SUPABASE_SERVICE_ROLE_KEY — klucz service_role (bypass RLS)
 */

import XLSX from "xlsx";
import { createClient } from "@supabase/supabase-js";
import { resolve } from "path";
import { config } from "dotenv";

// Ładuj .env z katalogu głównego projektu
config({ path: resolve(import.meta.dirname ?? __dirname, "../.env") });

// --- Konfiguracja ---
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DRY_RUN = process.argv.includes("--dry-run");

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Brak SUPABASE_URL lub SUPABASE_SERVICE_ROLE_KEY w zmiennych środowiskowych.");
  console.error("Ustaw je w pliku .env lub jako zmienne środowiskowe.");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// --- Parsowanie adresu ---
// Format typowy: "Bolesława Chrobrego 8 m12b    62-200, Gniezno"
// lub: "ul. Ujezdzka 100    97-200, Tomaszów Mazowiecki"
// Separator: 4+ spacji między ulicą a kodem
function parseAddress(raw: string): {
  street: string;
  postalCode: string;
  city: string;
} {
  const trimmed = raw.trim();

  // Szukaj wzorca: kod pocztowy (XX-XXX) + przecinek + miasto
  // Adres przed kodem = ulica
  const match = trimmed.match(
    /^(.*?)\s{2,}(\d{2}-\d{3}),?\s*(.+)$/
  );

  if (match) {
    return {
      street: match[1].trim() || "-",
      postalCode: match[2].trim(),
      city: match[3].trim().replace(/^\s*,\s*/, ""),
    };
  }

  // Fallback: szukaj kodu pocztowego gdziekolwiek
  const fallback = trimmed.match(/(\d{2}-\d{3})/);
  if (fallback) {
    const idx = trimmed.indexOf(fallback[1]);
    const street = trimmed.substring(0, idx).trim() || "-";
    const afterCode = trimmed.substring(idx + fallback[1].length).trim().replace(/^,\s*/, "");
    return {
      street,
      postalCode: fallback[1],
      city: afterCode || "-",
    };
  }

  // Zagraniczny lub nieczytelny adres
  return {
    street: trimmed || "-",
    postalCode: "00-000",
    city: "-",
  };
}

// --- Import firm ---
async function importCompanies() {
  const filePath = resolve(import.meta.dirname ?? __dirname, "../test/baza_firm.xls");
  console.log(`\n📂 Czytam firmy z: ${filePath}`);

  const workbook = XLSX.readFile(filePath);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Record<string, string>>(sheet, { defval: "" });

  console.log(`   Łącznie wierszy: ${rows.length}`);

  // Filtruj: tylko z NIP-em
  const withNip = rows.filter((row) => {
    const nip = (row["nip"] || "").trim();
    return nip.length > 0;
  });

  console.log(`   Z NIP-em: ${withNip.length}`);

  // Deduplikacja po NIP
  const seen = new Set<string>();
  const unique: typeof withNip = [];
  for (const row of withNip) {
    const nip = (row["nip"] || "").trim();
    if (!seen.has(nip)) {
      seen.add(nip);
      unique.push(row);
    }
  }

  console.log(`   Unikalne (po NIP): ${unique.length}`);

  if (DRY_RUN) {
    console.log("\n🔍 DRY RUN — przykładowe firmy:");
    for (const row of unique.slice(0, 10)) {
      const name = (row["Nazwa kontrahenta"] || "").trim();
      const nip = (row["nip"] || "").trim();
      const addr = (row["adres kontrahenta"] || "").trim();
      const country = (row["kod kraju"] || "PL").trim() || "PL";
      const parsed = parseAddress(addr);
      console.log(`   ${name} | NIP: ${nip} | ${country} | ${parsed.street}, ${parsed.postalCode} ${parsed.city}`);
    }
    return { count: unique.length, ids: [] as string[] };
  }

  // Import do bazy
  let imported = 0;
  let errors = 0;
  const companyIds: { nip: string; id: string; name: string; country: string; address: string }[] = [];

  for (const row of unique) {
    const name = (row["Nazwa kontrahenta"] || "").trim();
    const nip = (row["nip"] || "").trim();
    const country = (row["kod kraju"] || "PL").trim() || "PL";
    const addr = (row["adres kontrahenta"] || "").trim();

    const { data, error } = await supabase
      .from("companies")
      .insert({ name, tax_id: nip, type: null, is_active: true })
      .select("id")
      .single();

    if (error) {
      console.error(`   ✗ Firma "${name}" (NIP: ${nip}): ${error.message}`);
      errors++;
    } else {
      companyIds.push({ nip, id: data.id, name, country, address: addr });
      imported++;
    }
  }

  console.log(`   ✓ Zaimportowano firm: ${imported}, błędów: ${errors}`);
  return { count: imported, ids: companyIds };
}

// --- Import lokalizacji (1 per firma) ---
async function importLocations(
  companies: { nip: string; id: string; name: string; country: string; address: string }[]
) {
  console.log(`\n📍 Tworzę lokalizacje dla ${companies.length} firm...`);

  if (DRY_RUN) {
    console.log("🔍 DRY RUN — pominięto.");
    return;
  }

  let imported = 0;
  let errors = 0;

  for (const company of companies) {
    const parsed = parseAddress(company.address);

    const { error } = await supabase.from("locations").insert({
      company_id: company.id,
      name: company.name,
      country: company.country,
      city: parsed.city,
      postal_code: parsed.postalCode,
      street_and_number: parsed.street,
      is_active: true,
    });

    if (error) {
      console.error(`   ✗ Lokalizacja "${company.name}": ${error.message}`);
      errors++;
    } else {
      imported++;
    }
  }

  console.log(`   ✓ Zaimportowano lokalizacji: ${imported}, błędów: ${errors}`);
}

// --- Import towarów ---
async function importProducts() {
  const filePath = resolve(import.meta.dirname ?? __dirname, "../test/towarj.xls");
  console.log(`\n📦 Czytam towary z: ${filePath}`);

  const workbook = XLSX.readFile(filePath);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  // Brak nagłówka w pliku — czytamy jako tablicę tablic
  const rows = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1, defval: "" });

  console.log(`   Łącznie wierszy: ${rows.length}`);

  // Filtruj puste wiersze
  const valid = rows.filter((row) => row[0] && String(row[0]).trim().length > 0);

  console.log(`   Niepustych: ${valid.length}`);

  // Deduplikacja po nazwie skróconej
  const seen = new Set<string>();
  const unique: typeof valid = [];
  for (const row of valid) {
    const shortName = String(row[0]).trim().toUpperCase();
    if (!seen.has(shortName)) {
      seen.add(shortName);
      unique.push(row);
    }
  }

  console.log(`   Unikalnych: ${unique.length}`);

  if (DRY_RUN) {
    console.log("\n🔍 DRY RUN — przykładowe towary:");
    for (const row of unique.slice(0, 10)) {
      const shortName = String(row[0]).trim();
      const fullName = String(row[1] || "").trim();
      console.log(`   ${shortName} → "${fullName}" [LUZEM]`);
    }
    return unique.length;
  }

  let imported = 0;
  let errors = 0;

  for (const row of unique) {
    const shortName = String(row[0]).trim();
    const fullName = String(row[1] || "").trim();

    const { error } = await supabase.from("products").insert({
      name: shortName,
      description: fullName || null,
      default_loading_method_code: "LUZEM",
      is_active: true,
    });

    if (error) {
      console.error(`   ✗ Towar "${shortName}": ${error.message}`);
      errors++;
    } else {
      imported++;
    }
  }

  console.log(`   ✓ Zaimportowano towarów: ${imported}, błędów: ${errors}`);
  return imported;
}

// --- Main ---
async function main() {
  console.log("=== Import słowników z ERP ===");
  console.log(`Tryb: ${DRY_RUN ? "DRY RUN (podgląd)" : "IMPORT (zapis do bazy)"}`);
  console.log(`Supabase: ${SUPABASE_URL}`);

  const companiesResult = await importCompanies();
  await importLocations(companiesResult.ids as any);
  await importProducts();

  console.log("\n=== Gotowe! ===");
}

main().catch((err) => {
  console.error("Błąd krytyczny:", err);
  process.exit(1);
});
