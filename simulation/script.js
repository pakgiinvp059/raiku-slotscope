document.addEventListener("DOMContentLoaded", () => {
  const startBtn = document.getElementById("startBtn");
  const resetBtn = document.getElementById("resetBtn");
  const autoRunCheckbox = document.getElementById("autoRun");
  const modeRadios = document.querySelectorAll("input[name='mode']");
  const ctxTx = document.getElementById("txChart").getContext("2d");
  const ctxGas = document.getElementById("gasChart").getContext("2d");

  const executedEl = document.getElementById("executedTx");
  const failedEl = document.getElementById("failedTx");
  const pendingEl = document.getElementById("pendingTx");
  const aotGasEl = document.getElementById("aotGas");
  const jitGasEl = document.getElementById("jitGas");
  const totalGasEl = document.getElementById("totalGas");

  const summary = document.getElementById("summary");
  const extraLine = document.createElement("div");
  extraLine.classList.add("summary-extra");
  extraLine.innerHTML = `
    <div class="summary-row">
      <div><b>JIT Executed TX:</b> <span id="jitExecutedTx">0</span></div>
      <div><b>JIT Failed TX:</b> <span id="jitFailedTx">0</span></div>
      <div><b>JIT Pending TX:</b> <span id="jitPendingTx">0</span></div>
      <div><b>JIT Gas (SOL):</b> <span id="jitGasDetail">0.00000</span></div>
    </div>
    <div class="summary-row">
      <div><b>AOT Executed TX:</b> <span id="aotExecutedTx">0</span></div>
      <div><b>AOT Failed TX:</b> <span id="aotFailedTx">0</span></div>
      <div><b>AOT Pending TX:</b> <span id="aotPendingTx">0</span></div>
      <div><b>AOT Gas (SOL):</b> <span id="aotGasDetail">0.00000</span></div>
    </div>`;
  summary.insertAdjacentElement("afterend", extraLine);

  let executed = 0, failed = 0, pending = 0;
  let aotGas = 0, jitGas = 0;
  let aotExecuted = 0, jitExecuted = 0;
  let aotPending = 0, jitPending = 0;
  let aotFailed = 0, jitFailed = 0;
  let currentMode = "JIT";

  modeRadios.forEach(r => r.addEventListener("change", () => currentMode = r.value));

  const txChart = new Chart(ctxTx, {
    type: "line",
    data: {
      labels: Array.from({ length: 10 }, (_, i) => `Slot ${i + 1}`),
      datasets: [
        { label: "Executed", data: Array(10).fill(0), borderColor: "#2ecc71", fill: false },
        { label: "Pending", data: Array(10).fill(0), borderColor: "#f1c40f", fill: false },
        { label: "Failed", data: Array(10).fill(0), borderColor: "#e74c3c", fill: false }
      ]
    },
    options: { plugins: { legend: { display: false } }, responsive: true, maintainAspectRatio: false }
  });

  const gasChart = new Chart(ctxGas, {
    type: "bar",
    data: {
      labels: Array.from({ length: 10 }, (_, i) => `Slot ${i + 1}`),
      datasets: [
        { label: "AOT Gas", backgroundColor: "#27ae60", data: Array(10).fill(0) },
        { label: "JIT Gas", backgroundColor: "#2980b9", data: Array(10).fill(0) }
      ]
    },
    options: { plugins: { legend: { position: "bottom" } }, responsive: true, maintainAspectRatio: false }
  });

  function randomizeData(mode) {
    return Array.from({ length: 10 }, () => {
      let ex, pend, fail, gas;
      if (mode === "AOT") {
        ex = Math.floor(90 + Math.random() * 10);
        pend = Math.floor(Math.random() * 2);
        fail = Math.floor(Math.random() * 2);
        gas = +(0.00008 + Math.random() * 0.00004).toFixed(5);
      } else {
        ex = Math.floor(80 + Math.random() * 10);
        pend = Math.floor(2 + Math.random() * 3);
        fail = Math.floor(2 + Math.random() * 3);
        gas = +(0.00006 + Math.random() * 0.00003).toFixed(5);
      }
      return { ex, pend, fail, gas };
    });
  }

  function updateDisplay(d) {
    const exSum = d.reduce((s, x) => s + x.ex, 0);
    const pendSum = d.reduce((s, x) => s + x.pend, 0);
    const failSum = d.reduce((s, x) => s + x.fail, 0);
    const gasSum = d.reduce((s, x) => s + x.gas, 0);

    executed += exSum;
    failed += failSum;
    pending += pendSum;

    if (currentMode === "AOT") {
      aotExecuted += exSum;
      aotPending += pendSum;
      aotFailed += failSum;
      aotGas += gasSum;
    } else {
      jitExecuted += exSum;
      jitPending += pendSum;
      jitFailed += failSum;
      jitGas += gasSum;
    }

    executedEl.textContent = executed;
    failedEl.textContent = failed;
    pendingEl.textContent = pending;
    aotGasEl.textContent = aotGas.toFixed(5);
    jitGasEl.textContent = jitGas.toFixed(5);
    totalGasEl.textContent = (aotGas + jitGas).toFixed(5);

    document.getElementById("jitExecutedTx").textContent = jitExecuted;
    document.getElementById("jitFailedTx").textContent = jitFailed;
    document.getElementById("jitPendingTx").textContent = jitPending;
    document.getElementById("jitGasDetail").textContent = jitGas.toFixed(5);

    document.getElementById("aotExecutedTx").textContent = aotExecuted;
    document.getElementById("aotFailedTx").textContent = aotFailed;
    document.getElementById("aotPendingTx").textContent = aotPending;
    document.getElementById("aotGasDetail").textContent = aotGas.toFixed(5);
  }

  function simulate() {
    const d = randomizeData(currentMode);
    txChart.data.datasets[0].data = d.map(x => x.ex);
    txChart.data.datasets[1].data = d.map(x => x.pend);
    txChart.data.datasets[2].data = d.map(x => x.fail);
    txChart.update();

    if (currentMode === "AOT") gasChart.data.datasets[0].data = d.map(x => x.gas);
    else gasChart.data.datasets[1].data = d.map(x => x.gas);
    gasChart.update();

    updateDisplay(d);
  }

  async function autoRun() {
    for (let i = 0; i < 5; i++) {
      simulate();
      await new Promise(r => setTimeout(r, 800));
    }
    if (confirm("Auto-run finished 5 rounds. Continue?")) autoRun();
    else autoRunCheckbox.checked = false;
  }

  startBtn.addEventListener("click", () => {
    simulate();
    if (autoRunCheckbox.checked) autoRun();
  });

  resetBtn.addEventListener("click", () => {
    executed = failed = pending = 0;
    aotGas = jitGas = 0;
    aotExecuted = jitExecuted = 0;
    aotPending = jitPending = 0;
    aotFailed = jitFailed = 0;

    txChart.data.datasets.forEach(d => d.data = Array(10).fill(0));
    gasChart.data.datasets.forEach(d => d.data = Array(10).fill(0));
    txChart.update(); gasChart.update();

    [executedEl, failedEl, pendingEl].forEach(e => e.textContent = 0);
    [aotGasEl, jitGasEl, totalGasEl].forEach(e => e.textContent = "0.00000");
    document.querySelectorAll(".summary-extra span").forEach(e => e.textContent = "0");
  });
});
