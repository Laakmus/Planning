import OrderView from "./OrderView";
import { TEST_ORDER_DATA } from "./test-data";

export default function OrderViewPage() {
  return (
    <OrderView
      initialData={TEST_ORDER_DATA}
      onSave={(data) => {
        console.log("Saved data:", data);
        alert("Zapisano zmiany!");
      }}
      onCancel={() => {
        alert("Anulowano - powrót do drawera");
      }}
    />
  );
}
