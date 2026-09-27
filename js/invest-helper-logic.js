window.addEventListener('DOMContentLoaded', () => {
  const steps = [
    { title: '1. Set Your Goal', content: 'Define your investment purpose and outcome.' },
    { title: '2. Time Horizon', content: 'Choose your investment timeline.' },
    { title: '3. Risk Tolerance', content: 'Assess how much volatility you can handle.' },
    { title: '4. Choose Strategy', content: 'Pick between ETFs, growth, dividend, etc.' },
    { title: '5. Suggested Allocation', content: 'View sample asset allocation.' },
    { title: '6. Compound Interest', content: 'Visualize how your money grows over time.' }
  ];
  let currentStep = 0;

  window.openModal = function(index) {
    currentStep = index;
    updateModal();
    document.getElementById('modal').style.display = 'flex';
  };

  window.updateModal = function() {
    document.getElementById('modalStepTitle').innerText = steps[currentStep].title;
    document.getElementById('modalStepContent').innerText = steps[currentStep].content;
    const formContainer = document.getElementById('modalFormContent');
    formContainer.innerHTML = '';

    const inputs = [
      { key: 'goalInput', label: 'Goal', options: ['Retirement', 'Home Purchase', 'Education', 'Wealth Growth'] },
      { key: 'horizonInput', label: 'Time Horizon', options: ['1-3 years', '3-5 years', '5-10 years', '10+ years'] },
      { key: 'riskInput', label: 'Risk Level', options: ['Low', 'Moderate', 'High'] },
      { key: 'strategyInput', label: 'Strategy', options: ['Index Funds', 'Dividend Investing', 'Growth Stocks', 'Real Estate'] },
      { key: 'allocationInput', label: 'Allocation', options: ['Conservative (30/70)', 'Balanced (60/40)', 'Aggressive (80/20)'] },
      { key: 'compoundInput', label: 'Initial Investment ($)', input: true }
    ];

    const field = inputs[currentStep];
    if (!field) return;

    if (field.input) {
      const input = document.createElement('input');
      input.type = 'number';
      input.placeholder = field.label;
      input.value = localStorage.getItem(field.key) || '';
      input.oninput = () => localStorage.setItem(field.key, input.value);
      formContainer.appendChild(input);
    } else {
      const select = document.createElement('select');
      select.innerHTML = '<option value="">Select ' + field.label + '</option>' +
        field.options.map(o => `<option>${o}</option>`).join('');
      select.value = localStorage.getItem(field.key) || '';
      select.onchange = () => localStorage.setItem(field.key, select.value);
      formContainer.appendChild(select);
    }

    updateProgressBar();
  };

  window.closeModal = function() {
    document.getElementById('modal').style.display = 'none';
  };

  window.nextStep = function() {
    markStepDone(currentStep);
    if (currentStep < steps.length - 1) {
      currentStep++;
      updateModal();
    } else {
      closeModal();
      //showCompletionMessage();
      window.location.href = 'result-loading.html';
    }
  };

  window.prevStep = function() {
    if (currentStep > 0) {
      currentStep--;
      updateModal();
    } else {
      closeModal();
    }
  };

  function markStepDone(i) {
    const card = document.getElementById('card' + i);
    if (card) {
      card.classList.add('done');
      const progress = JSON.parse(localStorage.getItem('investStepProgress')) || [];
      if (!progress.includes(i)) {
        progress.push(i);
        localStorage.setItem('investStepProgress', JSON.stringify(progress));
      }
    }
  }

  function updateProgressBar() {
    const percent = ((currentStep + 1) / steps.length) * 100;
    document.getElementById('progressBar').style.width = `${percent}%`;
  }

  window.resetProgress = function() {
    localStorage.removeItem('investStepProgress');
    for (let i = 0; i < steps.length; i++) {
      const card = document.getElementById('card' + i);
      if (card) card.classList.remove('done');
    }
    updateProgressBar();
  };

  function loadSavedProgress() {
    const saved = JSON.parse(localStorage.getItem('investStepProgress')) || [];
    saved.forEach(i => markStepDone(i));
  }

  async function showCompletionMessage() {
    const goal = localStorage.getItem('goalInput') || 'Not set';
    const horizon = localStorage.getItem('horizonInput') || 'Not set';
    const risk = localStorage.getItem('riskInput') || 'Not set';
    const strategy = localStorage.getItem('strategyInput') || 'Not set';
    const allocation = localStorage.getItem('allocationInput') || 'Not set';
    const initial = localStorage.getItem('compoundInput') || '0';

    const overlay = document.createElement('div');
    overlay.id = 'summaryOverlay';
    overlay.style.position = 'fixed';
    overlay.style.top = 0;
    overlay.style.left = 0;
    overlay.style.width = '100%';
    overlay.style.height = '100%';
    overlay.style.background = 'rgba(0,0,0,0.6)';
    overlay.style.display = 'flex';
    overlay.style.justifyContent = 'center';
    overlay.style.alignItems = 'center';
    overlay.style.zIndex = 9999;

    const modal = document.createElement('div');
    modal.style.background = 'white';
    modal.style.padding = '2rem';
    modal.style.borderRadius = '1rem';
    modal.style.maxWidth = '600px';
    modal.style.textAlign = 'left';
    modal.style.overflowY = 'auto';
    modal.style.maxHeight = '90vh';

    modal.innerHTML = `
      <div style='text-align:right'>
        <button onclick="document.getElementById('summaryOverlay').remove()" style='background:none;border:none;font-size:1.2rem;cursor:pointer;'>❌</button>
      </div>
      <h2>🎉 Congratulations!</h2>
      <p>Here's a summary of your inputs:</p>
      <ul style="padding-left:1.2rem;">
        <li><strong>Goal:</strong> ${goal}</li>
        <li><strong>Time Horizon:</strong> ${horizon}</li>
        <li><strong>Risk Level:</strong> ${risk}</li>
        <li><strong>Strategy:</strong> ${strategy}</li>
        <li><strong>Allocation:</strong> ${allocation}</li>
        <li><strong>Initial Investment:</strong> $${initial}</li>
      </ul>
      <div style="margin-top:1rem;">
        <div style="height: 10px; background: #e0e0e0; border-radius: 5px; overflow: hidden;">
          <div class="ai-loading-bar" style="width: 0%; height: 100%; background: #007bff; animation: aiProgress 2s infinite;"></div>
        </div>
      </div>
    `;

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    try {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer __REMOVED__'
        },
        body: JSON.stringify({
          model: 'gpt-4',
          messages: [
            { role: 'system', content: 'You are a helpful financial assistant.' },
            {
              role: 'user',
              content: `My goal is ${goal}, my horizon is ${horizon}, my risk tolerance is ${risk}, and I prefer ${strategy}. What specific ETFs, funds, or investment accounts do you recommend? Format it clearly.`
            }
          ]
        })
      });

      const data = await res.json();
      const aiText = data.choices?.[0]?.message?.content || 'Unable to retrieve suggestion.';

      // Store it in sessionStorage
      sessionStorage.setItem('aiSuggestionHTML', aiText);

      // 🔍 DEBUG LOGGING
      console.log("✅ AI suggestion saved to sessionStorage:");
      console.log(aiText);
      console.log("✅ sessionStorage['aiSuggestionHTML'] =", sessionStorage.getItem('aiSuggestionHTML'));

      const resultBox = document.createElement('div');
      
      const loadingBar = document.querySelector('.ai-loading-bar');
      if (loadingBar && loadingBar.parentElement) {
        loadingBar.parentElement.remove();
      }

      resultBox.innerHTML = `
        <div style="margin-top:1rem;">
          <strong>🤖 AI Suggestion:</strong>
          <div style="margin-top:0.5rem;border-left:4px solid #007bff;padding-left:1rem;">${aiText.replace(/\n/g, '<br>')}</div>
            <div style="margin-top:0.75rem; text-align:center;">
              <span title="Email" onclick="alert('Send via email')" style="cursor:pointer;font-size:1.25rem;margin-right:1rem;">📧</span>
              <span title="Print" onclick="window.print()" style="cursor:pointer;font-size:1.25rem;margin-right:1rem;">🖨️</span>
              <span title="Download PDF" onclick="alert('Generate PDF feature')" style="cursor:pointer;font-size:1.25rem;">📄</span>
            </div>
          <div style="margin-top:1rem; text-align:center;">
            <a href="how-to-buy.html" style="color:#007bff;font-weight:bold;">📘 How to Buy These Funds</a>
          </div>
        </div>`;
      modal.appendChild(resultBox);
    } catch (err) {
      modal.innerHTML += '<p><strong>🤖 AI Suggestion:</strong> Unable to load suggestion.</p>';
    }
  }

  loadSavedProgress();

  
});