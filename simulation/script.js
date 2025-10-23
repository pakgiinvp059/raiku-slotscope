document.addEventListener("DOMContentLoaded", () => {
  const startBtn = document.querySelector("#startBtn");
  const resetBtn = document.querySelector("#resetBtn");
  const autoRunCheckbox = document.querySelector("#autoRun");
  const modeRadios = document.querySelectorAll("input[name='mode']");
  const ctxTx = document.getElementById("txChart").getContext("2d");
  const ctxGas = document.getElementById("gasChart").getContext("2d");

  const totalEl = document.getElementById("totalTx");
  const pendingEl = document.getElementById("pendingTx");
  const executedEl = document.getElementById("executedTx");
  const failedEl = document.getElementById("failedTx");
  const aotGasEl = document.getElementById("aotGas");
  const jitGasEl = document.getElementById("jitGas");

  let total = 0, pending = 0, executed = 0, failed = 0, aotGas = 0, jitGas = 0;
  let currentMode = "AOT";

  modeRadios.forEach(r => r.addEventListener("change", () => {
    currentMode = r.value;
  }));

  const txChart = new Chart(ctxTx, {
    type: "line",
    data: {
      labels: Array.from({ length: 10 }, (_, i) => `Slot ${i + 1}`),
      datasets: [
        { label: "Executed", data: Array(10).fill(0), borderColor: "#2ecc71", fill: false },
        { label: "Pending", data: Array(10).fill(0), borderColor: "#f1c40f", fill: false },
        { label: "Failed", data: Array(10).fill(0), borderColor: "#e74c3c", fill: false },
      ],
    },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } },
  });

  const gasChart = new Chart(ctxGas, {
    type: "bar",
    data: {
      labels: Array.from({ length: 10 }, (_, i) => `Slot ${i + 1}`),
      datasets: [
        { label: "AOT Gas", backgroundColor: "#27ae60", data: Array(10).fill(0) },
        { label: "JIT Gas", backgroundColor: "#2980b9", data: Array(10).fill(0) },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { position: "bottom" } },
      scales: { y: { beginAtZero: true, title: { display: true, text: "Gas (SOL)" } } },
    },
  });

  function randomizeData(mode) {
    return Array(10).fill(0).map(() => {
      let ex, pend, fail, gas;
      if (mode === "AOT") {
        ex = Math.floor(90 + Math.random() * 5);
        pend = Math.floor(Math.random() * 2);
        fail = Math.floor(Math.random() * 3);
        gas = +(0.0018 + Math.random() * 0.0005).toFixed(4);
      } else {
        ex = Math.floor(80 + Math.random() * 10);
        pend = Math.floor(3 + Math.random() * 4);
        fail = Math.floor(2 + Math.random() * 5);
        gas = +(0.0014 + Math.random() * 0.0004).toFixed(4);
      }
      return { ex, pend, fail, gas };
    });
  }

  function updateMetrics(d) {
    total += d.reduce((sum, s) => sum + s.ex + s.pend + s.fail, 0);
    pending += d.reduce((sum, s) => sum + s.pend, 0);
    executed += d.reduce((sum, s) => sum + s.ex, 0);
    failed += d.reduce((sum, s) => sum + s.fail, 0);
    if (currentMode === "AOT")
      aotGas += d.reduce((s, x) => s + x.gas, 0);
    else jitGas += d.reduce((s, x) => s + x.gas, 0);

    totalEl.textContent = total;
    pendingEl.textContent = pending;
    executedEl.textContent = executed;
    failedEl.textContent = failed;
    aotGasEl.textContent = aotGas.toFixed(4);
    jitGasEl.textContent = jitGas.toFixed(4);
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

    updateMetrics(d);
  }

  async function autoRun() {
    for (let i = 0; i < 5; i++) {
      simulate();
      await new Promise(r => setTimeout(r, 1000));
    }
    const cont = confirm("Auto-run 5 rounds completed. Continue?");
    if (cont) autoRun();
    else autoRunCheckbox.checked = false;
  }

  startBtn.addEventListener("click", () => {
    simulate();
    if (autoRunCheckbox.checked) autoRun();
  });

  resetBtn.addEventListener("click", () => {
    total = pending = executed = failed = aotGas = jitGas = 0;
    txChart.data.datasets.forEach(ds => ds.data = Array(10).fill(0));
    gasChart.data.datasets.forEach(ds => ds.data = Array(10).fill(0));
    txChart.update(); gasChart.update();
    totalEl.textContent = pendingEl.textContent = executedEl.textContent = failedEl.textContent = "0";
    aotGasEl.textContent = jitGasEl.textContent = "0.0000";
  });
});
