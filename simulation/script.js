document.addEventListener("DOMContentLoaded", () => {
  const startBtn = document.getElementById("startBtn");
  const resetBtn = document.getElementById("resetBtn");
  const compareBtn = document.getElementById("compareBtn");
  const autoRunCheckbox = document.getElementById("autoRun");
  const modeRadios = document.querySelectorAll("input[name='mode']");
  const slotEls = document.querySelectorAll(".slot-value");

  const executedEl = document.getElementById("executedTx");
  const failedEl = document.getElementById("failedTx");
  const pendingEl = document.getElementById("pendingTx");
  const aotGasEl = document.getElementById("aotGas");
  const jitGasEl = document.getElementById("jitGas");
  const totalGasEl = document.getElementById("totalGas");

  const compareBox = document.getElementById("comparison");
  const jitTxTotalEl = document.getElementById("jitTxTotal");
  const aotTxTotalEl = document.getElementById("aotTxTotal");
  const jitGasCompareEl = document.getElementById("jitGasCompare");
  const aotGasCompareEl = document.getElementById("aotGasCompare");

  let executed = 0, failed = 0, pending = 0;
  let aotGas = 0, jitGas = 0;
  let jitTotal = 0, aotTotal = 0;
  let currentMode = "JIT";

  modeRadios.forEach(r => r.addEventListener("change", () => currentMode = r.value));

  const txChart = new Chart(document.getElementById("txChart"), {
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

  const gasChart = new Chart(document.getElementById("gasChart"), {
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
      let ex = Math.floor(80 + Math.random() * 20);
      let pend = Math.floor(Math.random() * 5);
      let fail = Math.floor(Math.random() * 5);
      let gas = +(0.00006 + Math.random() * 0.00004).toFixed(5);
      if (mode === "AOT") gas *= 1.2;
      return { ex, pend, fail, gas };
    });
  }

  function updateSlots(d) {
    d.forEach((x, i) => slotEls[i].textContent = x.ex + x.pend + x.fail);
  }

  function updateDisplay(d) {
    executed += d.reduce((s, x) => s + x.ex, 0);
    failed += d.reduce((s, x) => s + x.fail, 0);
    pending += d.reduce((s, x) => s + x.pend, 0);
    const gasSum = d.reduce((s, x) => s + x.gas, 0);

    if (currentMode === "AOT") { aotGas += gasSum; aotTotal += executed + failed + pending; }
    else { jitGas += gasSum; jitTotal += executed + failed + pending; }

    executedEl.textContent = executed;
    failedEl.textContent = failed;
    pendingEl.textContent = pending;
    aotGasEl.textContent = aotGas.toFixed(5);
    jitGasEl.textContent = jitGas.toFixed(5);
    totalGasEl.textContent = (aotGas + jitGas).toFixed(5);
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

    updateSlots(d);
    updateDisplay(d);
  }

  async function autoRun() {
    for (let i = 0; i < 5; i++) {
      simulate();
      await new Promise(r => setTimeout(r, 800));
    }
  }

  startBtn.addEventListener("click", () => {
    simulate();
    if (autoRunCheckbox.checked) autoRun();
  });

  resetBtn.addEventListener("click", () => {
    executed = failed = pending = 0;
    aotGas = jitGas = 0;
    jitTotal = aotTotal = 0;
    txChart.data.datasets.forEach(d => d.data = Array(10).fill(0));
    gasChart.data.datasets.forEach(d => d.data = Array(10).fill(0));
    txChart.update(); gasChart.update();
    slotEls.forEach(el => el.textContent = 0);
    executedEl.textContent = failedEl.textContent = pendingEl.textContent = 0;
    aotGasEl.textContent = jitGasEl.textContent = totalGasEl.textContent = "0.00000";
    compareBox.classList.add("hidden");
  });

  compareBtn.addEventListener("click", () => {
    compareBox.classList.toggle("hidden");
    jitTxTotalEl.textContent = jitTotal;
    aotTxTotalEl.textContent
