import { DEFAULT_CONFIDENTIALITY_CLAUSE } from "./constants";
import type { OrderViewData, TestProduct } from "./types";

/**
 * Test products dictionary (matching seed.sql + extras for scrap metals)
 */
export const TEST_PRODUCTS: TestProduct[] = [
  { id: "p-01", name: "Stal walcowana", defaultPackaging: "PALETA" },
  { id: "p-02", name: "Złom stalowy", defaultPackaging: "LUZEM" },
  { id: "p-03", name: "Cement workowy", defaultPackaging: "PALETA" },
  { id: "p-04", name: "Granulat PP", defaultPackaging: "BIGBAG" },
  { id: "p-05", name: "Odpady przemysłowe", defaultPackaging: null },
  { id: "p-06", name: "złom kable Al/Pb", defaultPackaging: "LUZEM" },
  { id: "p-07", name: "złom miedzi Mix", defaultPackaging: "BIGBAG" },
  { id: "p-08", name: "złom aluminium profile", defaultPackaging: "PALETA" },
  { id: "p-09", name: "złom mosiądzu", defaultPackaging: "LUZEM" },
  { id: "p-10", name: "złom ołowiu", defaultPackaging: "LUZEM" },
  { id: "p-11", name: "złom cynku", defaultPackaging: "BIGBAG" },
  { id: "p-12", name: "złom niklu", defaultPackaging: "BIGBAG" },
  { id: "p-13", name: "papier makulatura", defaultPackaging: "PALETA" },
  { id: "p-14", name: "folia PE", defaultPackaging: "PALETA" },
  { id: "p-15", name: "karton tektura", defaultPackaging: "PALETA" },
];

/**
 * Extended test data based on order_2.html mockup
 * with additional items and intermediate stops
 */
export const TEST_ORDER_DATA: OrderViewData = {
  // Section 1 - Header
  orderNo: "ZT2025/1311",
  createdAt: "2025-08-08",

  // Section 4 - Carrier
  carrierName: "MARIUSZ MIERZEJEWSKI",
  carrierAddress: "ul. GEN. AUGUSTA EMILA FIELDORFA, 07-410 Ostrołęka",
  carrierNip: "7581777477",

  // Section 5 - Vehicle
  vehicleType: "ruchoma podłoga",
  vehicleVolumeM3: 90,

  // Section 6 - Items (extended: 3 items instead of 1)
  items: [
    {
      id: "item-1",
      name: "złom kable Al/Pb",
      notes: "Wymagana waga na załadunku",
      packagingType: "LUZEM",
    },
    {
      id: "item-2",
      name: "złom miedzi Mix",
      notes: "",
      packagingType: "BIGBAG",
    },
    {
      id: "item-3",
      name: "złom aluminium profile",
      notes: "Segregowane wg gatunku",
      packagingType: "PALETA",
    },
  ],

  // Section 7 - Loading
  loading: {
    id: "stop-load",
    date: "2025-08-11",
    time: "10:00",
    place: "ARCELORMITTAL POLAND Kraków 31-752, ul. Tadeusza Sendzimira 1",
    country: "PL",
  },

  // Section 8 - Intermediate stops (extended: 2 stops)
  intermediateStops: [
    {
      id: "stop-mid-1",
      date: "2025-08-11",
      time: "14:00",
      place: "KGHM Huta Miedzi Głogów, ul. Żukowicka 1, 67-231 Żukowice",
      country: "PL",
    },
    {
      id: "stop-mid-2",
      date: "2025-08-12",
      time: "06:00",
      place: "REMONDIS Sp. z o.o., ul. Zawodzie 16, 02-981 Warszawa",
      country: "PL",
    },
  ],

  // Section 9 - Unloading
  unloading: {
    id: "stop-unload",
    date: "2025-08-12",
    time: "08:00",
    place: 'UAB "VC BALTIC" V. A GRAICIUNO 10-3, VILNIUS, LIETUVA',
    country: "LT",
  },

  // Section 10 - Price
  priceAmount: 1025,
  currencyCode: "EUR",
  paymentTermDays: 21,
  paymentMethod: "PRZELEW",

  // Section 11 - Documents
  documentsText: "WZE, Aneks VII, CMR",

  // Section 12 - Notes
  generalNotes:
    "Dot. frachtu w EUR: prosimy o wystawianie faktur za transport w PLN, po kursie z dnia poprzedzającego rozładunek.\nFaktury wystawione w EUR nie będą akceptowane.\nDopuszczalna różnica wagowa 40 kg.\nWymagane pozwolenie na transport odpadów.",

  // Section 13 - Clause
  confidentialityClause: DEFAULT_CONFIDENTIALITY_CLAUSE,

  // Section 14 - Person
  personName: "Yaraslau Urbanovich",
  personEmail: "y.urbanovich@odylion.pl",
  personPhone: "+48 512 345 678",
};
