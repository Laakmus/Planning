/**
 * Re-export hub — zachowuje backward compatibility dla 29 konsumentów.
 * Logika przeniesiona do sub-serwisów: order-list, order-detail, order-create,
 * order-update, order-misc, order-snapshot.
 */

export { listOrders } from "./order-list.service";
export { getOrderDetail } from "./order-detail.service";
export { createOrder } from "./order-create.service";
export { updateOrder, patchStop } from "./order-update.service";
export {
  duplicateOrder,
  prepareEmailForOrder,
  updateCarrierCellColor,
  updateEntryFixed,
} from "./order-misc.service";
export type { PrepareEmailResult } from "./order-misc.service";
