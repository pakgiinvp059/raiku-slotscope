document.addEventListener("DOMContentLoaded", () => {
  const startBtn = document.querySelector("#startBtn");
  const resetBtn = document.querySelector("#resetBtn");
  const autoRunCheckbox = document.querySelector("#autoRun");
  const txCountInput = document.querySelector("#txCount");
  const modeRadios = document.querySelectorAll("input[name='mode']");

  const ctxTx = document.getElementById("txChart").getContext("2d");
  const ctxGas = document.getElementById("gasChart").getContext("2d");

  const totalTxDisplay = document.querySelector("#totalTx");
  const totalGasAOTDisplay = document.querySelector("#totalGasAOT");
  const totalGasJITDisplay = document.querySelector("#totalGasJIT");

  let currentMode = "AOT";
  const autoRunLimit = 5;

  let totalTx = 0, totalGasAOT = 0, totalGasJIT = 0;

  modeRadios.forEach(radio => {
    radio.addEventListener("change", () => {
      currentMode = radio.value;
      resetSimulation();
    });
  });

  const txChart = new Chart(ctxTx, {
    type: "line",
    data: {
      labels: Array.from({ length: 10 }, (_, i) => `Slot ${i + 1}`),
      datasets: [
        { label: "Executed", data: Array(10).fill(0), borderColor: "#2ecc71", fill: false },
        { label: "Pending", data: Array(10).fill(0), borderColor: "#f1c40f", fill: false },
        { label: "Failed", data: Array(10).fill(0), borderColor: "#e74c3c", fill: false }
      ],
    },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
  });

  const gasChart = new Chart(ctxGas, {
    type: "bar",
    data: {
      labels: Array.from({ length: 10 }, (_, i) => `Slot ${i + 1}`),
      datasets: [
        { label: "AOT Gas", data: Array(10).fill(0), backgroundColor: "#27ae60" },
        { label: "JIT Gas", data: Array(10).fill(0), backgroundColor: "#3498db" }
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { position: "bottom" } },
      scales: { y: { beginAtZero: true, title: { display: true, text: "Gas (SOL)" } } },
    },
  });

  function resetSimulation() {
    txChart.data.datasets.forEach(ds => (ds.data = Array(10).fill(0)));
    gasChart.data.datasets.forEach(ds => (ds.data = Array(10).fill(0)));
    totalTx = totalGasAOT = totalGasJIT = 0;
    updateTotals();
    txChart.update(); gasChart.update();
  }

  function generateData(mode, txCount) {
    return Array(10).fill(0).map(() => {
      let executed, pending, failed, gas;
      if (mode === "AOT") {
        executed = Math.floor(txCount / 10 * (0.88 + Math.random() * 0.07));
        pending = Math.floor(txCount / 10 * (0.015 + Math.random() * 0.015));
        failed = Math.floor(txCount / 10 * (0.02 + Math.random() * 0.03));
        gas = +(0.0018 + Math.random() * 0.0007).toFixed(4);
      } else {
        executed = Math.floor(txCount / 10 * (0.8 + Math.random() * 0.1));
        pending = Math.floor(txCount / 10 * (0.04 + Math.random() * 0.05));
        failed = Math.floor(txCount / 10 * (0.03 + Math.random() * 0.05));
        gas = +(0.0013 + Math.random() * 0.0007).toFixed(4);
      }
      return { executed, pending, failed, gas };
    });
  }

  function simulateOnce() {
    const txCount = parseInt(txCountInput.value) || 100;
    const data = generateData(currentMode, txCount);

    txChart.data.datasets.forEach((ds, i) => ds.data = data.map(d => [d.executed, d.pending, d.failed][i]));
    txChart.update();

    if (currentMode === "AOT") {
      gasChart.data.datasets[0].data = data.map(d => d.gas);
      gasChart.data.datasets[1].data = Array(10).fill(0);
      totalGasAOT += data.reduce((s, d) => s + d.gas, 0);
    } else {
      gasChart.data.datasets[1].data = data.map(d => d.gas);
      gasChart.data.datasets[0].data = Array(10).fill(0);
      totalGasJIT += data.reduce((s, d) => s + d.gas, 0);
    }
    gasChart.update();

    totalTx += data.reduce((s, d) => s + d.executed + d.pending + d.failed, 0);
    updateTotals();
  }

  function updateTotals() {
    totalTxDisplay.textContent = totalTx.toLocaleString();
    totalGasAOTDisplay.textContent = totalGasAOT.toFixed(4);
    totalGasJITDisplay.textContent = totalGasJIT.toFixed(4);
  }

  async function autoRun() {
    for (let i = 0; i < 5; i++) {
      simulateOnce();
      await new Promise(r => setTimeout(r, 1200));
    }
    const cont = confirm("Auto-run finished 5 rounds. Continue?");
    if (cont) autoRun(); else autoRunCheckbox.checked = false;
  }

  startBtn.addEventListener("click", () => {
    simulateOnce();
    if (autoRunCheckbox.checked) autoRun();
  });

  resetBtn.addEventListener("click", resetSimulation);
});
