function parseTransactionLog(log) {
  const transactions = [];
  const pattern = /(\d{2} \w+ \d{4} \d{2}:\d{2})\s+([BS])\s+(.*?)\s+Delivery\s+₹\s*([\d,\.]+)\s+(\d+)\s*\/\s*(\d+)\s+([\d,\.]+)\s+(?:[\d,\.]+|MKT)?\s*(\w+)?/g;

  let match;
  while ((match = pattern.exec(log)) !== null) {
    let [
      ,
      date,
      type,
      company,
      price,
      qtyFilled,
      qtyOrdered,
      rate,
      status
    ] = match;

    try {
      price = parseFloat(price.replace(/,/g, ''));
      qtyFilled = parseInt(qtyFilled);
      qtyOrdered = parseInt(qtyOrdered);
      rate = parseFloat(rate.replace(/,/g, ''));
      status = status || "";

      if (status !== 'Successful' && qtyFilled !== qtyOrdered) {
        continue;
      }

      const datetime = new Date(Date.parse(date.replace(/(\d{2}) (\w+) (\d{4})/, '$2 $1, $3')));
      transactions.push({
        date,
        type,
        company: company.trim(),
        price,
        qty: qtyFilled,
        rate,
        status: 'Successful',
        datetime
      });
    } catch (e) {
      continue;
    }
  }

  transactions.sort((a, b) => a.datetime - b.datetime);
  return transactions;
}

function calculateProfitOnlyToBank(transactions) {
  const FLAT_BROKERAGE = 20.0;
  const DP_CHARGE_SELL = 10.0;
  const STT_SELL = 0.001;
  const EXCHANGE = 0.0000375;
  const SEBI = 0.000001;
  const GST = 0.18;

  const companies = {};
  for (const tx of transactions) {
    if (!companies[tx.company]) companies[tx.company] = [];
    companies[tx.company].push(tx);
  }

  let output = "=== BANK CREDIT REPORT (PROFIT ONLY) ===\n";
  let totalCredited = 0;

  for (const company in companies) {
    const txs = companies[company];
    const inventory = [];
    output += `\n--- ${company} ---\n`;

    for (const tx of txs) {
      const qty = tx.qty;
      const rate = tx.rate;

      if (tx.type === 'B') {
        inventory.push([qty, rate]);
        output += `Buy ${qty} @ ₹${rate.toFixed(2)} on ${tx.date}\n`;
      } else if (tx.type === 'S') {
        let remaining = qty;
        let costBasis = 0.0;
        const usedShares = [];

        while (remaining > 0 && inventory.length > 0) {
          let [invQty, invPrice] = inventory[0];
          let used = Math.min(remaining, invQty);
          costBasis += used * invPrice;
          usedShares.push([used, invPrice]);
          inventory[0][0] -= used;
          if (inventory[0][0] === 0) inventory.shift();
          remaining -= used;
        }

        if (remaining > 0) {
          output += `⚠️ Skipped sell of ${qty} shares on ${tx.date}, insufficient inventory.\n`;
          continue;
        }

        const turnover = rate * qty;
        const brokerage = FLAT_BROKERAGE;
        const stt = turnover * STT_SELL;
        const exchange = turnover * EXCHANGE;
        const sebi = turnover * SEBI;
        const gst = (brokerage + exchange + sebi) * GST;
        const totalCharges = brokerage + stt + exchange + sebi + gst + DP_CHARGE_SELL;

        const grossProfit = (rate * qty) - costBasis;
        const netProfit = grossProfit - totalCharges;
        const credited = Math.max(0, netProfit);
        totalCredited += credited;

        output += `Sell ${qty} @ ₹${rate.toFixed(2)} on ${tx.date}\n`;
        output += `  Cost: ₹${costBasis.toFixed(2)}\n`;
        output += `  Gross Profit: ₹${grossProfit.toFixed(2)}\n`;
        output += `  Charges: ₹${totalCharges.toFixed(2)} (₹20 brokerage + ₹10 DP + taxes)\n`;
        output += `  ✅ Bank Credit: ₹${credited.toFixed(2)}\n`;
      }
    }
  }

  output += `\n=== TOTAL ===\n`;
  output += `Total Credited to Bank (only profit): ₹${totalCredited.toFixed(2)}\n`;
  return output;
}
