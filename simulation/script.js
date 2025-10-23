document.addEventListener("DOMContentLoaded", () => {
  const startBtn = document.getElementById("startBtn");
  const resetBtn = document.getElementById("resetBtn");
  const autoRunCheckbox = document.getElementById("autoRun");
  const modeRadios = document.querySelectorAll("input[name='mode']");
  const ctxTx = document.getElementById("txChart").getContext("2d");
  const ctxGas = document.getElementById("gasChart").getContext("2d");

  // Phần hiển thị tổng chung
  const executedEl = document.getElementById("executedTx");
  const failedEl = document.getElementById("failedTx");
  const pendingEl = document.getElementById("pendingTx");
  const aotGasEl = document.getElementById("aotGas");
  const jitGasEl = document.getElementById("jitGas");
  const totalGasEl = document.getElementById("totalGas");

  // Tạo 2 dòng tổng riêng cho JIT và AOT
  const summary = document.getElementById("summary");
  const extraSummary = document.createElement("div");
  extraSummary.innerHTML = `
    <div class="extra-summary">
      <div><b>JIT</b> → Total TX: <span id="jitTotal">0</span> | Executed: <span id="jitExecuted">0</span> | Pending: <span id="jitPending">0</span> | Failed: <span id="jitFailed">0</span></div>
      <div><b>AOT</b> → Total TX: <span id="aotTotal">0</span> | Executed: <span id="aotExecuted">0</span> | Pending: <span id="aotPending">0</span> | Failed: <span id="aotFailed">0</span></div>
    </div>
  `;
  summary.insertAdjacentElement("afterend", extraSummary);

  // Biến đếm
  let executed = 0, failed = 0, pending = 0, aotGas = 0, jitGas = 0;
  let jitData = { total: 0, executed: 0, pending: 0, failed: 0 };
  let aotData = { total: 0, executed: 0, pending: 0, failed: 0 };

  let currentMode = "AOT";

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
        gas = +(0.0001 + Math.random() * 0.0001).toFixed(5);
      } else {
        ex = Math.floor(80 + Math.random() * 10);
        pend = Math.floor(2 + Math.random() * 3);
        fail = Math.floor(2 + Math.random() * 3);
        gas = +(0.00008 + Math.random() * 0.00005).toFixed(5);
      }
      return { ex, pend, fail, gas };
    });
  }

  function updateDisplay(d) {
    const total = d.reduce((sum, x) => sum + x.ex + x.pend + x.fail, 0);
    const exSum = d.reduce((sum, x) => sum + x.ex, 0);
    const pendSum = d.reduce((sum, x) => sum + x.pend, 0);
    const failSum = d.reduce((sum, x) => sum + x.fail, 0);
    const gasSum = d.reduce((s, x) => s + x.gas, 0);

    executed += exSum;
    failed += failSum;
    pending += pendSum;

    if (currentMode === "AOT") {
      aotGas += gasSum;
      aotData.total += total;
      aotData.executed += exSum;
      aotData.pending += pendSum;
      aotData.failed += failSum;
    } else {
      jitGas += gasSum;
      jitData.total += total;
      jitData.executed += exSum;
      jitData.pending += pendSum;
      jitData.failed += failSum;
    }

    executedEl.textContent = executed;
    failedEl.textContent = failed;
    pendingEl.textContent = pending;
    aotGasEl.textContent = aotGas.toFixed(5);
    jitGasEl.textContent = jitGas.toFixed(5);
    totalGasEl.textContent = (aotGas + jitGas).toFixed(5);

    document.getElementById("jitTotal").textContent = jitData.total;
    document.getElementById("jitExecuted").textContent = jitData.executed;
    document.getElementById("jitPending").textContent = jitData.pending;
    document.getElementById("jitFailed").textContent = jitData.failed;

    document.getElementById("aotTotal").textContent = aotData.total;
    document.getElementById("aotExecuted").textContent = aotData.executed;
    document.getElementById("aotPending").textContent = aotData.pending;
    document.getElementById("aotFailed").textContent = aotData.failed;
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
    executed = failed = pending = aotGas = jitGas = 0;
    jitData = { total: 0, executed: 0, pending: 0, failed: 0 };
    aotData = { total: 0, executed: 0, pending: 0, failed: 0 };

    txChart.data.datasets.forEach(d => d.data = Array(10).fill(0));
    gasChart.data.datasets.forEach(d => d.data = Array(10).fill(0));
    txChart.update(); gasChart.update();

    executedEl.textContent = failedEl.textContent = pendingEl.textContent = 0;
    aotGasEl.textContent = jitGasEl.textContent = totalGasEl.textContent = "0.0000";

    document.querySelectorAll(".extra-summary span").forEach(e => e.textContent = "0");
  });
});
