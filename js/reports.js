// Pure calculations for reports. No database or UI code belongs here.
export function calculateWorkerMonth(workerId, siteId, month, attendance, transactions) {
  let earned = 0;
  let presentDays = 0;
  let halfDays = 0;
  let absentDays = 0;

  for (const day of attendance) {
    if (day.siteId !== siteId || !day.date.startsWith(month)) continue;
    const entry = day.entries?.[workerId];
    if (!entry) continue;

    if (entry.status === "present") {
      earned += Number(entry.wageAtTime || 0);
      presentDays += 1;
    } else if (entry.status === "half") {
      earned += Number(entry.wageAtTime || 0) / 2;
      halfDays += 1;
    } else if (entry.status === "absent") {
      absentDays += 1;
    }
  }

  const paid = transactions
    .filter(item => item.siteId === siteId && item.workerId === workerId && item.date.startsWith(month))
    .reduce((sum, item) => sum + Number(item.amount || 0), 0);

  return {
    earned,
    paid,
    balance: earned - paid,
    presentDays,
    halfDays,
    absentDays
  };
}
