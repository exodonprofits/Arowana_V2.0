document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("optionForm");
  const resultBox = document.getElementById("result");
  const analyzeBtn = document.getElementById("analyzeBtn");
  const tickerInput = document.getElementById("ticker");
  const currentPriceInput = document.getElementById("currentPrice");

  // Replace with your own Twelve Data API key
  const API_KEY = "a9dec530e25f43ef828d2c3e1bfe6d37";

  // Auto-fetch stock price on ticker input blur
  tickerInput.addEventListener("blur", async () => {
    const symbol = tickerInput.value.trim().toUpperCase();
    if (!symbol) return;

    currentPriceInput.placeholder = "⏳ Fetching price...";

    try {
      const response = await fetch(`https://api.twelvedata.com/price?symbol=${symbol}&apikey=${API_KEY}`);
      const data = await response.json();

      if (data.price) {
        currentPriceInput.value = parseFloat(data.price).toFixed(2);
        currentPriceInput.placeholder = "";
      } else {
        currentPriceInput.value = "";
        currentPriceInput.placeholder = "⚠️ Price not found";
        console.warn("Price fetch error:", data.message || data);
      }
    } catch (err) {
      console.error("Error fetching stock price:", err);
      currentPriceInput.placeholder = "⚠️ Fetch error";
    }
  });

  analyzeBtn.addEventListener("click", async () => {
    const data = {
      ticker: tickerInput.value.trim(),
      type: document.getElementById("type").value,
      role: document.getElementById("role").value,
      daysLeft: parseInt(document.getElementById("daysLeft").value),
      strike: parseFloat(document.getElementById("strike").value),
      currentPrice: parseFloat(currentPriceInput.value),
      premium: parseFloat(document.getElementById("premium").value),
      goal: document.getElementById("goal").value
    };

    if (!data.ticker || isNaN(data.daysLeft) || isNaN(data.strike) || isNaN(data.currentPrice)) {
      resultBox.innerHTML = "⚠️ Please fill out all required fields with valid values.";
      resultBox.classList.remove("hidden");
      return;
    }

    resultBox.innerHTML = "⏳ Analyzing your option position...";
    resultBox.classList.remove("hidden");

    try {
      const response = await fetch("https://your-n8n-instance-url/webhook/option-roll-analyzer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
      });

      if (!response.ok) throw new Error("Webhook failed");

      const result = await response.json();
      resultBox.innerHTML = `<strong>📋 Recommendation:</strong><br>${result.advice || "No advice returned."}`;
    } catch (err) {
      console.error(err);
      resultBox.innerHTML = "❌ Could not analyze. Please try again.";
    }
  });
});
