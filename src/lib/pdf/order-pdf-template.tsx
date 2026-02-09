import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
} from "@react-pdf/renderer";
import type {
  OrderDetailDto,
  OrderDetailStopDto,
  OrderDetailItemDto,
} from "../../types";

// ---------------------------------------------------------------------------
// Types for resolved display data passed alongside the raw DTO
// ---------------------------------------------------------------------------

export interface OrderPdfData {
  order: OrderDetailDto;
  stops: OrderDetailStopDto[];
  items: OrderDetailItemDto[];
  /** Resolved display names not present on the DTO */
  resolved: {
    transportTypeName: string;
    vehicleVariantName: string;
    vehicleVariantDescription: string | null;
    carrierNip: string | null;
    senderFullName: string | null;
    senderEmail: string | null;
    senderPhone: string | null;
  };
}

// ---------------------------------------------------------------------------
// Styles — mimicking the original transport order PDF layout
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  page: {
    paddingTop: 30,
    paddingBottom: 40,
    paddingHorizontal: 35,
    fontSize: 9,
    fontFamily: "Helvetica",
    lineHeight: 1.4,
  },
  // Header row
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  companyInfo: {
    flex: 1,
  },
  orderInfo: {
    width: 180,
    alignItems: "flex-end",
  },
  companyName: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    marginBottom: 2,
  },
  companyAddress: {
    fontSize: 8,
    color: "#333",
  },
  orderLabel: {
    fontSize: 8,
    color: "#666",
  },
  orderNumber: {
    fontSize: 14,
    fontFamily: "Helvetica-Bold",
    marginBottom: 2,
  },
  orderDate: {
    fontSize: 9,
  },
  // Title
  title: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    textAlign: "center",
    marginVertical: 8,
    paddingVertical: 4,
    backgroundColor: "#f0f0f0",
  },
  // Section
  section: {
    marginBottom: 6,
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 2,
  },
  sectionHeader: {
    backgroundColor: "#e8e8e8",
    paddingHorizontal: 6,
    paddingVertical: 3,
    fontFamily: "Helvetica-Bold",
    fontSize: 9,
  },
  sectionBody: {
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  // Table-like rows
  row: {
    flexDirection: "row",
    marginBottom: 2,
  },
  label: {
    width: 130,
    fontFamily: "Helvetica-Bold",
    fontSize: 8,
    color: "#444",
  },
  value: {
    flex: 1,
    fontSize: 9,
  },
  // Stops table
  stopRow: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: "#ddd",
    paddingVertical: 3,
  },
  stopCell: {
    fontSize: 8,
    paddingHorizontal: 3,
  },
  stopCellDate: { width: 70 },
  stopCellTime: { width: 45 },
  stopCellPlace: { flex: 1 },
  stopCellCountry: { width: 30, textAlign: "center" },
  stopHeaderRow: {
    flexDirection: "row",
    backgroundColor: "#f5f5f5",
    paddingVertical: 3,
    fontFamily: "Helvetica-Bold",
  },
  // Items table
  itemRow: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: "#ddd",
    paddingVertical: 3,
  },
  itemCellNo: { width: 25, textAlign: "center" },
  itemCellName: { flex: 1 },
  itemCellMethod: { width: 80, textAlign: "center" },
  itemCellQty: { width: 60, textAlign: "right" },
  // Price section
  priceRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 2,
  },
  priceAmount: {
    fontSize: 12,
    fontFamily: "Helvetica-Bold",
  },
  priceCurrency: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    marginLeft: 4,
  },
  // Notes
  notesText: {
    fontSize: 8,
    color: "#333",
    lineHeight: 1.5,
  },
  // Footer
  confidentiality: {
    marginTop: 8,
    fontSize: 6.5,
    color: "#666",
    lineHeight: 1.4,
  },
  contactSection: {
    marginTop: 10,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: "#ccc",
  },
});

// ---------------------------------------------------------------------------
// Helper functions
// ---------------------------------------------------------------------------

/** Formats a date string (YYYY-MM-DD) for display */
function formatDate(date: string | null): string {
  if (!date) return "—";
  return date; // Already in YYYY-MM-DD format
}

/** Formats a time string (HH:mm) for display */
function formatTime(time: string | null): string {
  if (!time) return "—";
  return time;
}

/** Formats price with thousands separator */
function formatPrice(amount: number | null): string {
  if (amount == null) return "—";
  return amount.toLocaleString("pl-PL", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * Builds the full address line from location snapshot data.
 */
function buildAddressLine(
  name: string | null,
  address: string | null
): string {
  const parts = [name, address].filter(Boolean);
  return parts.join(", ") || "—";
}

/**
 * Extracts country code from the address snapshot (last 2 chars if available).
 * Falls back to "PL".
 */
function extractCountry(stop: OrderDetailStopDto): string {
  // Try to extract from addressSnapshot — often ends with country code
  if (stop.addressSnapshot) {
    const parts = stop.addressSnapshot.split(",").map((s) => s.trim());
    const lastPart = parts[parts.length - 1];
    if (lastPart && lastPart.length === 2) {
      return lastPart.toUpperCase();
    }
  }
  return "PL";
}

// ---------------------------------------------------------------------------
// Components
// ---------------------------------------------------------------------------

/** Single labeled row: LABEL: VALUE */
function LabeledRow({
  label,
  value,
}: {
  label: string;
  value: string | null | undefined;
}) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value || "—"}</Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Main PDF Document
// ---------------------------------------------------------------------------

/**
 * React PDF template for a transport order document.
 *
 * Layout mirrors the company's existing PDF format:
 * 1. Header — company info + order number + date
 * 2. Carrier (spedycja) section
 * 3. Vehicle type
 * 4. Cargo items (asortyment)
 * 5. Loading stops (załadunki)
 * 6. Unloading stops (rozładunki)
 * 7. Freight price + payment terms
 * 8. Required documents
 * 9. Additional notes
 * 10. Confidentiality clause
 * 11. Contact person
 */
export function OrderPdfDocument({ data }: { data: OrderPdfData }) {
  const { order, stops, items, resolved } = data;

  const loadingStops = stops.filter((s) => s.kind === "LOADING");
  const unloadingStops = stops.filter((s) => s.kind === "UNLOADING");

  const today = new Date().toISOString().slice(0, 10);

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* === HEADER === */}
        <View style={styles.headerRow}>
          <View style={styles.companyInfo}>
            <Text style={styles.companyName}>
              ODYLION Sp. z o.o. Sp. k.
            </Text>
            <Text style={styles.companyAddress}>
              ul. Syta 114z/1, 02-987 Warszawa
            </Text>
            <Text style={styles.companyAddress}>NIP: PL 9512370578</Text>
          </View>
          <View style={styles.orderInfo}>
            <Text style={styles.orderLabel}>ZLECENIE NR:</Text>
            <Text style={styles.orderNumber}>{order.orderNo}</Text>
            <Text style={styles.orderDate}>DATA WYST: {today}</Text>
          </View>
        </View>

        {/* === TITLE === */}
        <Text style={styles.title}>
          ZLECAMY PAŃSTWU TRANSPORT NA NASTĘPUJĄCYCH WARUNKACH:
        </Text>

        {/* === CARRIER (SPEDYCJA) === */}
        <View style={styles.section}>
          <Text style={styles.sectionHeader}>SPEDYCJA:</Text>
          <View style={styles.sectionBody}>
            <LabeledRow
              label="PEŁNA NAZWA"
              value={order.carrierNameSnapshot}
            />
            <LabeledRow label="NIP" value={resolved.carrierNip} />
            <LabeledRow
              label="ADRES"
              value={
                order.carrierAddressSnapshot ||
                order.carrierLocationNameSnapshot
              }
            />
          </View>
        </View>

        {/* === VEHICLE TYPE === */}
        <View style={styles.section}>
          <Text style={styles.sectionHeader}>TYP AUTA:</Text>
          <View style={styles.sectionBody}>
            <Text style={styles.value}>
              {resolved.vehicleVariantName}
              {resolved.vehicleVariantDescription
                ? ` — ${resolved.vehicleVariantDescription}`
                : ""}
            </Text>
          </View>
        </View>

        {/* === CARGO / ITEMS (ASORTYMENT) === */}
        <View style={styles.section}>
          <Text style={styles.sectionHeader}>ASORTYMENT:</Text>
          {/* Table header */}
          <View style={styles.stopHeaderRow}>
            <Text style={[styles.stopCell, styles.itemCellNo]}>Lp.</Text>
            <Text style={[styles.stopCell, styles.itemCellName]}>Towar</Text>
            <Text style={[styles.stopCell, styles.itemCellMethod]}>
              Metoda załadunku
            </Text>
            <Text style={[styles.stopCell, styles.itemCellQty]}>Ilość (t)</Text>
          </View>
          {/* Table rows */}
          {items.map((item, idx) => (
            <View key={item.id} style={styles.itemRow}>
              <Text style={[styles.stopCell, styles.itemCellNo]}>
                {idx + 1}
              </Text>
              <Text style={[styles.stopCell, styles.itemCellName]}>
                {item.productNameSnapshot || "—"}
              </Text>
              <Text style={[styles.stopCell, styles.itemCellMethod]}>
                {item.defaultLoadingMethodSnapshot || "—"}
              </Text>
              <Text style={[styles.stopCell, styles.itemCellQty]}>
                {item.quantityTons != null
                  ? item.quantityTons.toFixed(2)
                  : "—"}
              </Text>
            </View>
          ))}
          {items.length === 0 && (
            <View style={styles.sectionBody}>
              <Text style={styles.notesText}>Brak pozycji</Text>
            </View>
          )}
        </View>

        {/* === LOADING STOPS (ZAŁADUNEK) === */}
        <View style={styles.section}>
          <Text style={styles.sectionHeader}>PUNKTY ZAŁADUNKU:</Text>
          {/* Table header */}
          <View style={styles.stopHeaderRow}>
            <Text style={[styles.stopCell, styles.stopCellDate]}>DATA</Text>
            <Text style={[styles.stopCell, styles.stopCellTime]}>GODZINA</Text>
            <Text style={[styles.stopCell, styles.stopCellPlace]}>
              MIEJSCE ZAŁADUNKU
            </Text>
            <Text style={[styles.stopCell, styles.stopCellCountry]}>KRAJ</Text>
          </View>
          {/* Table rows */}
          {loadingStops.map((stop) => (
            <View key={stop.id} style={styles.stopRow}>
              <Text style={[styles.stopCell, styles.stopCellDate]}>
                {formatDate(stop.dateLocal)}
              </Text>
              <Text style={[styles.stopCell, styles.stopCellTime]}>
                {formatTime(stop.timeLocal)}
              </Text>
              <Text style={[styles.stopCell, styles.stopCellPlace]}>
                {buildAddressLine(
                  stop.locationNameSnapshot,
                  stop.addressSnapshot
                )}
              </Text>
              <Text style={[styles.stopCell, styles.stopCellCountry]}>
                {extractCountry(stop)}
              </Text>
            </View>
          ))}
          {loadingStops.length === 0 && (
            <View style={styles.sectionBody}>
              <Text style={styles.notesText}>Brak punktów załadunku</Text>
            </View>
          )}
        </View>

        {/* === UNLOADING STOPS (ROZŁADUNEK) === */}
        <View style={styles.section}>
          <Text style={styles.sectionHeader}>PUNKTY ROZŁADUNKU:</Text>
          <View style={styles.stopHeaderRow}>
            <Text style={[styles.stopCell, styles.stopCellDate]}>DATA</Text>
            <Text style={[styles.stopCell, styles.stopCellTime]}>GODZINA</Text>
            <Text style={[styles.stopCell, styles.stopCellPlace]}>
              MIEJSCE ROZŁADUNKU
            </Text>
            <Text style={[styles.stopCell, styles.stopCellCountry]}>KRAJ</Text>
          </View>
          {unloadingStops.map((stop) => (
            <View key={stop.id} style={styles.stopRow}>
              <Text style={[styles.stopCell, styles.stopCellDate]}>
                {formatDate(stop.dateLocal)}
              </Text>
              <Text style={[styles.stopCell, styles.stopCellTime]}>
                {formatTime(stop.timeLocal)}
              </Text>
              <Text style={[styles.stopCell, styles.stopCellPlace]}>
                {buildAddressLine(
                  stop.locationNameSnapshot,
                  stop.addressSnapshot
                )}
              </Text>
              <Text style={[styles.stopCell, styles.stopCellCountry]}>
                {extractCountry(stop)}
              </Text>
            </View>
          ))}
          {unloadingStops.length === 0 && (
            <View style={styles.sectionBody}>
              <Text style={styles.notesText}>Brak punktów rozładunku</Text>
            </View>
          )}
        </View>

        {/* === FREIGHT PRICE + PAYMENT === */}
        <View style={styles.section}>
          <Text style={styles.sectionHeader}>CENA ZA FRACHT:</Text>
          <View style={styles.sectionBody}>
            <View style={styles.priceRow}>
              <Text style={styles.label}>KWOTA:</Text>
              <Text style={styles.priceAmount}>
                {formatPrice(order.priceAmount)}
              </Text>
              <Text style={styles.priceCurrency}>{order.currencyCode}</Text>
            </View>
            <LabeledRow label="FORMA PŁATNOŚCI:" value="PRZELEW" />
            <LabeledRow
              label="TERMIN PŁATNOŚCI:"
              value={
                order.paymentTermDays
                  ? `${order.paymentTermDays} DNI`
                  : "—"
              }
            />
          </View>
        </View>

        {/* === REQUIRED DOCUMENTS === */}
        {order.requiredDocumentsText && (
          <View style={styles.section}>
            <Text style={styles.sectionHeader}>
              Dokumenty dla kierowcy:
            </Text>
            <View style={styles.sectionBody}>
              <Text style={styles.value}>
                {order.requiredDocumentsText}
              </Text>
            </View>
          </View>
        )}

        {/* === ADDITIONAL NOTES === */}
        {order.generalNotes && (
          <View style={styles.section}>
            <Text style={styles.sectionHeader}>Uwagi dodatkowe:</Text>
            <View style={styles.sectionBody}>
              <Text style={styles.notesText}>{order.generalNotes}</Text>
            </View>
          </View>
        )}

        {/* === CONFIDENTIALITY CLAUSE === */}
        <Text style={styles.confidentiality}>
          Wszelkie informacje przekazane przez ODYLION Sp. z o.o. Sp. k. z
          siedzibą w Warszawie, KRS nr 0000474035, NIP: 9512370578 (dalej
          „ODYLION") dla celów realizacji niniejszego zlecenia transportowego,
          stanowią, w rozumieniu właściwych przepisów prawa, informacje poufne
          oraz tajemnicę handlową przedsiębiorstwa ODYLION, i jako takie mogą
          być wykorzystywane jedynie dla celów wykonania niniejszego zlecenia
          transportowego oraz jedynie przez podmioty wykonujące to zlecenie, w
          szczególności nie mogą zostać bez wyraźnej zgody ODYLION, w
          jakikolwiek sposób ujawnione innym podmiotom aniżeli wykonującym
          niniejsze zlecenie transportowe.
        </Text>

        {/* === CONTACT PERSON === */}
        <View style={styles.contactSection}>
          <LabeledRow
            label="OSOBA ZLECAJĄCA:"
            value={resolved.senderFullName || order.senderContactName}
          />
          <LabeledRow
            label="E-MAIL:"
            value={resolved.senderEmail || order.senderContactEmail}
          />
          <LabeledRow
            label="TELEFON:"
            value={resolved.senderPhone || order.senderContactPhone}
          />
        </View>
      </Page>
    </Document>
  );
}
