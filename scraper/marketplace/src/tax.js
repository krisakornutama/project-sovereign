// tax.js — VAT and input tax.
//
// The point of this module is that ภ.พ.30 must match reality. Two things ruin it:
//
//   1. Marketplace fees were never thought of as revenue but they are income,
//      so VAT is due on them.
//   2. Input tax (ภาษีซื้อ) is claimed on what we paid, including the platform
//      fee and shipping we were charged. Ignore those and the ภ.พ.30 numbers
//      come out wrong — too high if you claim too little.
//
// Everything is integer satang. Thai platforms compute in satang; float
// arithmetic drifts and a ฿0.01 gap becomes a ภ.พ.30 that won't reconcile.

/**
 * Split a gross-inclusive amount into net + VAT.
 *
 * `grossSatang` is already in satang — do NOT run it through toSatang() again.
 * That mistake multiplies every number by 100 and quietly inflates ภ.พ.30 by
 * two orders of magnitude.
 *
 * When a platform gives you only the total the buyer paid and does not break
 * out VAT, that total is VAT-inclusive by law in Thailand. Dividing by 1.07 is
 * the honest way to recover the base — not multiplying by 1.07, which would
 * inflate revenue by 7%.
 */
export function extractVat(grossSatang, rate = 0.07) {
  const gross = Math.max(0, Math.round(Number(grossSatang) || 0));
  const net = Math.round(gross / (1 + rate));
  return {
    netSatang: net,
    taxSatang: gross - net, // residual absorbs the rounding error
    grossSatang: gross
  };
}

/**
 * Work out what we owe and what we can claim.
 *
 * @param {object} order  from makeOrder()
 * @param {object} opts   { platformVatOnShipping, includeFeeInRevenue }
 */
export function computeTax(order, opts = {}) {
  const {
    // Shopee charges the buyer shipping and collects VAT on it; Lazada handles
    // shipping separately. Default false = treat shipping as a pass-through the
    // platform remits, which matches Shopee's payout statement.
    platformVatOnShipping = false,
    // The fee is income. But some platforms quote fees net of VAT, so this is
    // configurable and the choice is recorded on the order.
    includeFeeInRevenue = true
  } = opts;

  const rate = order.vatRate;

  // --- Revenue side (ขาย) ---
  // The buyer paid gross = goods + seller shipping + any seller-funded discount
  // the platform already deducted. Platform-funded discounts are the
  // platform's marketing, not a discount we granted, so they stay out.
  const grossFromBuyer = order.grossSatang;
  const { netSatang: netGoods, taxSatang: vatGoods } = extractVat(grossFromBuyer, rate);

  // When the platform charges VAT on shipping, the quoted figure is
  // VAT-inclusive, so the net part has to be pulled out. Otherwise shippingNet
  // would be the VAT-inclusive amount and the base would be overstated by 7%.
  const shipping = extractVat(order.shippingSatang, rate);
  const shippingNet = shipping.netSatang;
  const shippingVat = platformVatOnShipping ? shipping.taxSatang : 0;

  // Seller voucher is our money given back → reduces revenue.
  // Platform voucher is theirs → ignore.
  const sellerDiscount = order.discountSatang + order.voucherSellerSatang;

  const feeAsRevenue = includeFeeInRevenue ? order.platformFeeSatang : 0;
  const feeVat = includeFeeInRevenue ? extractVat(feeAsRevenue, rate).taxSatang : 0;

  const netSales = Math.max(0, netGoods + shippingNet - sellerDiscount + feeAsRevenue);
  const outputVat = Math.max(0, vatGoods + shippingVat + feeVat);

  // --- Input side (ซื้อ) ---
  // Claimable: what we paid for the goods (if we're a registered business and
  // have a tax invoice), plus VAT the platform charged on its own fee.
  let inputVat = 0;
  for (const line of order.lines) {
    if (line.costKnown) {
      inputVat += extractVat(line.unitCostSatang * line.qty, rate).taxSatang;
    }
  }
  // Platform fee usually has its own VAT line on the payout statement.
  const feeInputVat = includeFeeInRevenue ? extractVat(order.platformFeeSatang, rate).taxSatang : 0;
  inputVat += feeInputVat;

  // Discounts scale the purchase invoice down, so they scale the input tax too.
  const discountRatio = grossFromBuyer + shippingNet > 0
    ? (netGoods + shippingNet - sellerDiscount) / (netGoods + shippingNet)
    : 1;
  if (discountRatio < 1) {
    inputVat = Math.round(inputVat * Math.max(discountRatio, 0));
  }

  const payableVat = Math.max(0, outputVat - inputVat);
  const warnings = [...order.warnings];

  if (!order.lines.every((l) => l.costKnown)) {
    warnings.push(
      'บางรายการไม่ทราบต้นทุน → ภาษีซื้อของรายการนั้นเป็น 0 ตัวเลข VAT จะสูงกว่าจริง'
    );
  }
  if (grossFromBuyer === 0 && order.lines.length > 0) {
    warnings.push('ไม่พบยอดรวมที่ลูกค้าจ่าย — ตรวจคอลัมน์ในไฟล์ต้นทาง');
  }

  order.itemSubtotalSatang = netSales;
  order.taxSatang = outputVat;
  order.taxBreakdown = {
    rate,
    grossFromBuyerSatang: grossFromBuyer,
    netGoodsSatang: netGoods,
    shippingNetSatang: shippingNet,
    shippingVatSatang: shippingVat,
    sellerDiscountSatang: sellerDiscount,
    platformVatOnShipping,
    includeFeeInRevenue,
    feeAsRevenueSatang: feeAsRevenue,
    feeVatSatang: feeVat,
    netSalesSatang: netSales,
    outputVatSatang: outputVat,
    inputVatSatang: inputVat,
    payableVatSatang: payableVat,
    profitSatang: computeProfitSatang(order),
    discountRatioApplied: Number(discountRatio.toFixed(6))
  };
  order.warnings = warnings;
  return order;
}

/** Profit is only meaningful when cost is known; otherwise say so loudly. */
function computeProfitSatang(order) {
  let profit = 0;
  let complete = true;
  for (const line of order.lines) {
    if (!line.costKnown) {
      complete = false;
      continue;
    }
    profit += line.unitPriceSatang * line.qty - line.unitCostSatang * line.qty;
  }
  if (!complete) return null;
  // Platform fees and discounts are real money out of the margin.
  profit -= order.platformFeeSatang + order.discountSatang + order.voucherSellerSatang;
  return profit;
}

/** The ภ.พ.30 line for this order, in satang. */
export function pp30Line(order) {
  const t = order.taxBreakdown;
  if (!t) throw new Error('run computeTax() first');
  return {
    day: order.orderDate.slice(0, 10),
    taxableSalesSatang: t.netSalesSatang,
    outputVatSatang: t.outputVatSatang,
    inputVatSatang: t.inputVatSatang,
    netPayableVatSatang: t.payableVatSatang
  };
}