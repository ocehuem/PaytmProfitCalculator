function processLog() {
  const logText = document.getElementById("logInput").value;
  const transactions = parseTransactionLog(logText);
  const output = calculateProfitOnlyToBank(transactions);
  document.getElementById("output").textContent = output;
}
