
document.addEventListener("DOMContentLoaded", () => {
  const runButton = document.getElementById("runScan");
  const resetButton = document.getElementById("resetFilters");
  const resultsDiv = document.getElementById("results");

  runButton.addEventListener("click", async () => {
    const minYield = parseFloat(document.getElementById("minYield").value);
    const maxPayout = parseFloat(document.getElementById("maxPayout").value);

    const payload = {
      minYield,
      maxPayout
    };

    resultsDiv.innerHTML = '<div class="text-gray-600">⏳ Running AI Scan...</div>';

    try {
      const response = await fetch("https://exodonprofits.app.n8n.cloud/webhook/ai-dividend-screener", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });

      const data = await response.json();
      resultsDiv.innerHTML = "";

      if (data.length === 0 || data[0].message) {
        resultsDiv.innerHTML = `<div class="text-red-600">${data[0].message || "❌ No results found."}</div>`;
        return;
      }

      data.forEach((stock) => {
        const card = document.createElement("div");
        card.className = "bg-white rounded-xl shadow-md p-4";
        card.innerHTML = `
          <h2 class="text-lg font-bold mb-2">🔹 ${stock.name} (${stock.ticker})</h2>
          <ul class="text-sm text-gray-700 space-y-1">
            <li>💵 Yield: ${stock.dividendYield}%</li>
            <li>📊 Payout Ratio: ${stock.payoutRatio}%</li>
            <li>📈 Growth Rate: ${stock.dividendGrowth}%/yr</li>
            <li>📆 Paid Dividends: ${stock.yearsPaying}+ years</li>
            <li>🤖 AI Verdict: ${stock.aiVerdict}</li>
          </ul>
        `;
        resultsDiv.appendChild(card);
      });
    } catch (error) {
      resultsDiv.innerHTML = '<div class="text-red-600">❌ Error fetching data. Please try again later.</div>';
      console.error("Fetch error:", error);
    }
  });

  resetButton.addEventListener("click", () => {
    document.getElementById("minYield").value = 3;
    document.getElementById("maxPayout").value = 70;
    resultsDiv.innerHTML = "";
  });
});
