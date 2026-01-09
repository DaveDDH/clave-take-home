import type { SourceData } from '../preprocessor/index.js';
import type { DataIntegrityResult, PreprocessedData } from './types.js';

export function checkDataIntegrity(
  sources: SourceData,
  preprocessedData: PreprocessedData
): DataIntegrityResult {
  const warnings: string[] = [];

  // Count source orders (excluding voided/deleted)
  const toastOrders = sources.toast.orders.filter(o => !o.voided && !o.deleted).length;
  const doordashOrders = sources.doordash.orders.length;
  const squareOrders = sources.square.orders.orders.length;
  const totalSourceOrders = toastOrders + doordashOrders + squareOrders;

  // Count preprocessed orders
  const preprocessedOrders = preprocessedData.normalized.orders.length;

  // Count source payments
  const toastPayments = sources.toast.orders
    .filter(o => !o.voided && !o.deleted)
    .reduce((sum, order) => {
      return sum + order.checks
        .filter(c => !c.voided && !c.deleted)
        .reduce((checkSum, check) => {
          return checkSum + check.payments.filter(p => p.refundStatus !== 'FULL_REFUND').length;
        }, 0);
    }, 0);
  // DoorDash payments: 1 per order (handled by DoorDash platform)
  const doordashPayments = doordashOrders;
  const squarePayments = sources.square.payments.payments.length;
  const totalSourcePayments = toastPayments + doordashPayments + squarePayments;

  // Count preprocessed payments
  const preprocessedPayments = preprocessedData.normalized.payments.length;

  // Count orders with/without payments
  const orderIdsWithPayments = new Set(
    preprocessedData.normalized.payments.map(p => p.order_id)
  );
  const ordersWithPayments = orderIdsWithPayments.size;
  const ordersWithoutPayments = preprocessedOrders - ordersWithPayments;

  // Check for discrepancies
  if (preprocessedOrders !== totalSourceOrders) {
    warnings.push(
      `Order count mismatch: ${totalSourceOrders} source orders → ${preprocessedOrders} preprocessed ` +
      `(Toast: ${toastOrders}, DoorDash: ${doordashOrders}, Square: ${squareOrders})`
    );
  }

  if (preprocessedPayments !== totalSourcePayments) {
    warnings.push(
      `Payment count mismatch: ${totalSourcePayments} source payments → ${preprocessedPayments} preprocessed ` +
      `(Toast: ${toastPayments}, DoorDash: ${doordashPayments}, Square: ${squarePayments})`
    );
  }

  // All orders should have payments now (including DoorDash)
  if (ordersWithoutPayments > 0) {
    warnings.push(
      `${ordersWithoutPayments} orders have no payments (expected 0)`
    );
  }

  return {
    success: warnings.length === 0,
    warnings,
    summary: {
      sourceOrders: { toast: toastOrders, doordash: doordashOrders, square: squareOrders, total: totalSourceOrders },
      preprocessedOrders,
      sourcePayments: { toast: toastPayments, doordash: doordashPayments, square: squarePayments, total: totalSourcePayments },
      preprocessedPayments,
      ordersWithPayments,
      ordersWithoutPayments,
    },
  };
}

export function logDataIntegrityReport(result: DataIntegrityResult): void {
  const { summary } = result;
  const W = 41; // inner width
  const line = (s: string) => `│${s.padEnd(W)}│`;
  const sep = `├${'─'.repeat(W)}┤`;

  console.log(`\n┌${'─'.repeat(W)}┐`);
  console.log(line('         Data Integrity Report           '));
  console.log(sep);

  console.log(line(' Orders:'));
  console.log(line(`   Toast:      ${String(summary.sourceOrders.toast).padStart(4)} orders`));
  console.log(line(`   DoorDash:   ${String(summary.sourceOrders.doordash).padStart(4)} orders`));
  console.log(line(`   Square:     ${String(summary.sourceOrders.square).padStart(4)} orders`));
  console.log(line('   ───────────────────────'));
  console.log(line(`   Total:      ${String(summary.sourceOrders.total).padStart(4)} → ${String(summary.preprocessedOrders).padStart(4)} preprocessed`));

  console.log(sep);
  console.log(line(' Payments:'));
  console.log(line(`   Toast:      ${String(summary.sourcePayments.toast).padStart(4)} payments`));
  console.log(line(`   DoorDash:   ${String(summary.sourcePayments.doordash).padStart(4)} payments`));
  console.log(line(`   Square:     ${String(summary.sourcePayments.square).padStart(4)} payments`));
  console.log(line('   ───────────────────────'));
  console.log(line(`   Total:      ${String(summary.sourcePayments.total).padStart(4)} → ${String(summary.preprocessedPayments).padStart(4)} preprocessed`));

  console.log(sep);
  console.log(line(' Payment Coverage:'));
  console.log(line(`   Orders with payments:     ${String(summary.ordersWithPayments).padStart(4)}`));
  console.log(line(`   Orders without payments:  ${String(summary.ordersWithoutPayments).padStart(4)}`));
  console.log(`└${'─'.repeat(W)}┘`);

  if (result.success) {
    console.log('\n✓ Data integrity check passed!');
  } else {
    console.log('\n⚠ Data integrity warnings:');
    result.warnings.forEach(w => console.log(`  - ${w}`));
  }
}
