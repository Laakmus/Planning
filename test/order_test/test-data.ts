import { DEFAULT_CONFIDENTIALITY_CLAUSE } from "./constants";
import type {
  OrderViewData,
  TestProduct,
  TestCompany,
  TestLocation,
} from "./types";

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
 * Test companies dictionary for stop autocomplete
 */
export const TEST_COMPANIES: TestCompany[] = [
  {
    id: "c-01",
    name: "ArcelorMittal Poland S.A.",
    isActive: true,
    taxId: "6340003877",
    type: "PRODUCER",
    address: "ul. Tadeusza Sendzimira 1, 31-752 Kraków",
  },
  {
    id: "c-02",
    name: "KGHM Polska Miedź S.A.",
    isActive: true,
    taxId: "6920000019",
    type: "PRODUCER",
    address: "ul. M. Skłodowskiej-Curie 48, 59-301 Lubin",
  },
  {
    id: "c-03",
    name: "REMONDIS Sp. z o.o.",
    isActive: true,
    taxId: "7250028982",
    type: "RECYCLER",
    address: "ul. Zawodzie 16, 02-981 Warszawa",
  },
  {
    id: "c-04",
    name: 'UAB "VC BALTIC"',
    isActive: true,
    taxId: "LT100003721611",
    type: "RECYCLER",
    address: "V. A. Graičiūno 10-3, 02241 Vilnius",
  },
  {
    id: "c-05",
    name: "CMC Poland Sp. z o.o.",
    isActive: true,
    taxId: "7542786563",
    type: "PRODUCER",
    address: "ul. Piłsudskiego 82, 42-400 Zawiercie",
  },
  {
    id: "c-06",
    name: "Stena Recycling Sp. z o.o.",
    isActive: true,
    taxId: "5261025421",
    type: "RECYCLER",
    address: "ul. Stefana Batorego 2, 05-800 Pruszków",
  },
  {
    id: "c-07",
    name: "MARIUSZ MIERZEJEWSKI",
    isActive: true,
    taxId: "7581777477",
    type: "CARRIER",
    address: "ul. GEN. AUGUSTA EMILA FIELDORFA, 07-410 Ostrołęka",
  },
];

/**
 * Test locations dictionary for stop autocomplete (linked to companies)
 */
export const TEST_LOCATIONS: TestLocation[] = [
  {
    id: "l-01",
    name: "Huta Kraków",
    companyId: "c-01",
    companyName: "ArcelorMittal Poland S.A.",
    city: "Kraków",
    country: "PL",
    streetAndNumber: "ul. Tadeusza Sendzimira 1",
    postalCode: "31-752",
    isActive: true,
  },
  {
    id: "l-02",
    name: "Huta Miedzi Głogów",
    companyId: "c-02",
    companyName: "KGHM Polska Miedź S.A.",
    city: "Żukowice",
    country: "PL",
    streetAndNumber: "ul. Żukowicka 1",
    postalCode: "67-231",
    isActive: true,
  },
  {
    id: "l-03",
    name: "Oddział Warszawa",
    companyId: "c-03",
    companyName: "REMONDIS Sp. z o.o.",
    city: "Warszawa",
    country: "PL",
    streetAndNumber: "ul. Zawodzie 16",
    postalCode: "02-981",
    isActive: true,
  },
  {
    id: "l-04",
    name: "Vilnius HQ",
    companyId: "c-04",
    companyName: 'UAB "VC BALTIC"',
    city: "Vilnius",
    country: "LT",
    streetAndNumber: "V. A. Graičiūno 10-3",
    postalCode: "02241",
    isActive: true,
  },
  {
    id: "l-05",
    name: "Oddział Zawiercie",
    companyId: "c-05",
    companyName: "CMC Poland Sp. z o.o.",
    city: "Zawiercie",
    country: "PL",
    streetAndNumber: "ul. Piłsudskiego 82",
    postalCode: "42-400",
    isActive: true,
  },
  {
    id: "l-06",
    name: "Oddział Pruszków",
    companyId: "c-06",
    companyName: "Stena Recycling Sp. z o.o.",
    city: "Pruszków",
    country: "PL",
    streetAndNumber: "ul. Stefana Batorego 2",
    postalCode: "05-800",
    isActive: true,
  },
];

/**
 * Extended test data based on order_2.html mockup
 * with unified stops array (2 LOADING + 2 UNLOADING)
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

  // Section 7-9 - Stops (unified)
  stops: [
    {
      id: "stop-1",
      kind: "LOADING",
      sequenceNo: 1,
      date: "2025-08-11",
      time: "10:00",
      companyId: "c-01",
      companyName: "ArcelorMittal Poland S.A.",
      locationId: "l-01",
      locationName: "Huta Kraków",
      address: "ul. Tadeusza Sendzimira 1, 31-752 Kraków",
      country: "PL",
      place: "ARCELORMITTAL POLAND Kraków 31-752, ul. Tadeusza Sendzimira 1",
    },
    {
      id: "stop-2",
      kind: "LOADING",
      sequenceNo: 2,
      date: "2025-08-11",
      time: "14:00",
      companyId: "c-02",
      companyName: "KGHM Polska Miedź S.A.",
      locationId: "l-02",
      locationName: "Huta Miedzi Głogów",
      address: "ul. Żukowicka 1, 67-231 Żukowice",
      country: "PL",
      place: "KGHM Huta Miedzi Głogów, ul. Żukowicka 1, 67-231 Żukowice",
    },
    {
      id: "stop-3",
      kind: "UNLOADING",
      sequenceNo: 3,
      date: "2025-08-12",
      time: "06:00",
      companyId: "c-03",
      companyName: "REMONDIS Sp. z o.o.",
      locationId: "l-03",
      locationName: "Oddział Warszawa",
      address: "ul. Zawodzie 16, 02-981 Warszawa",
      country: "PL",
      place: "REMONDIS Sp. z o.o., ul. Zawodzie 16, 02-981 Warszawa",
    },
    {
      id: "stop-4",
      kind: "UNLOADING",
      sequenceNo: 4,
      date: "2025-08-12",
      time: "08:00",
      companyId: "c-04",
      companyName: 'UAB "VC BALTIC"',
      locationId: "l-04",
      locationName: "Vilnius HQ",
      address: "V. A. Graičiūno 10-3, 02241 Vilnius",
      country: "LT",
      place: 'UAB "VC BALTIC" V. A GRAICIUNO 10-3, VILNIUS, LIETUVA',
    },
  ],

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
