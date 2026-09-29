document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("optionForm");
  const resultBox = document.getElementById("result");
  const analyzeBtn = document.getElementById("analyzeBtn");
  const tickerInput = document.getElementById("ticker");
  const currentPriceInput = document.getElementById("currentPrice");

  // Automated quotes are disabled until a server-owned adapter is available.
  // Never provision a provider key in this browser helper.
  currentPriceInput.placeholder = "Enter a manual price (not a live quote)";

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
