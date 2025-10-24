document.addEventListener("DOMContentLoaded", () => {
  const slots = document.getElementById("slots");
  const startBtn = document.getElementById("startBtn");
  const resetBtn = document.getElementById("resetBtn");
  const compareBtn = document.getElementById("compareBtn");
  const comparePanel = document.getElementById("comparePanel");

  const executedTx = document.getElementById("executedTx");
  const failedTx = document.getElementById("failedTx");
  const pendingTx = document.getElementById("pendingTx");
  const jitGas = document.getElementById("jitGas");
  const aotGas = document.getElementById("aotGas");
  const totalGas = document.getElementById("totalGas");

  const jitExecuted = document.getElementById("jitExecuted");
  const jitFailed = document.getElementById("jitFailed");
  const jitPending = document.getElementById("jitPending");
  const jitGasCompare = document.getElementById("jitGasCompare");
  const aotExecuted = document.getElementById("aotExecuted");
  const aotFailed = document.getElementById("aotFailed");
  const aotPending = document.getElementById("aotPending");
  const aotGasCompare = document.getElementById("aotGasCompare");

  let mode = "JIT";
  document.querySelectorAll('input[name="mode"]').forEach(r => {
    r.addEventListener("change", e => (mode = e.target.value));
  });

  for (let i = 1; i <= 10; i++) {
    slots.innerHTML += `
      <div class="slot">
        <h3>Slot ${i}</h3>
        <div class="dots">
          <span class="dot green"></span>
          <span class="dot orange"></span>
          <span class="dot red"></span>
        </div>
        <div id="slot-${i}" class="slot-value">0</div>
      </div>`;
  }

  const txChart = new Chart(document.getElementById("txChart"), {
    type: "line",
    data: {
      labels: Array.from({ length: 10 }, (_, i) => `Slot ${i + 1}`),
      datasets: [
        { label: "Executed", data: Array(10).fill(0), borderColor: "#27ae60", fill: false },
        { label: "Pending", data: Array(10).fill(0), borderColor: "#f1c40f", fill: false },
        { label: "Failed", data: Array(10).fill(0), borderColor: "#e74c3c", fill: false }
      ]
    },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
  });

  const gasChart = new Chart(document.getElementById("gasChart"), {
    type: "bar",
    data: {
      labels: Array.from({ length: 10 }, (_, i) => `Slot ${i + 1}`),
      datasets: [
        { label: "AOT Gas", backgroundColor: "#16a085", data: Array(10).fill(0.00005) },
        { label: "JIT Gas", backgroundColor: "#2980b9", data: Array(10).fill(0.00005) }
      ]
    },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
  });

  function simulate() {
    const data = Array.from({ length: 10 }, () => ({
      executed: Math.floor(Math.random() * 100),
      pending: Math.floor(Math.random() * 10),
      failed: Math.floor(Math.random() * 5),
      gas: +(Math.random() * 0.0001).toFixed(5)
    }));

    txChart.data.datasets[0].data = data.map(d => d.executed);
    txChart.data.datasets[1].data = data.map(d => d.pending);
    txChart.data.datasets[2].data = data.map(d => d.failed);

    if (mode === "JIT") gasChart.data.datasets[1].data = data.map(d => d.gas);
    else gasChart.data.datasets[0].data = data.map(d => d.gas);

    txChart.update();
    gasChart.update();

    const sumExec = data.reduce((a, b) => a + b.executed, 0);
    const sumPend = data.reduce((a, b) => a + b.pending, 0);
    const sumFail = data.reduce((a, b) => a + b.failed, 0);
    const sumGas = data.reduce((a, b) => a + b.gas, 0);

    executedTx.textContent = sumExec;
    failedTx.textContent = sumFail;
    pendingTx.textContent = sumPend;

    if (mode === "JIT") {
      jitGas.textContent = sumGas.toFixed(5);
      jitExecuted.textContent = sumExec;
      jitPending.textContent = sumPend;
      jitFailed.textContent = sumFail;
      jitGasCompare.textContent = sumGas.toFixed(5);
    } else {
      aotGas.textContent = sumGas.toFixed(5);
      aotExecuted.textContent = sumExec;
      aotPending.textContent = sumPend;
      aotFailed.textContent = sumFail;
      aotGasCompare.textContent = sumGas.toFixed(5);
    }

    totalGas.textContent = (
      parseFloat(jitGas.textContent) + parseFloat(aotGas.textContent)
    ).toFixed(5);
  }

  startBtn.addEventListener("click", simulate);

  compareBtn.addEventListener("click", () => {
    comparePanel.classList.toggle("hidden");
  });

  resetBtn.addEventListener("click", () => {
    txChart.data.datasets.forEach(d => (d.data = Array(10).fill(0)));
    gasChart.data.datasets.forEach(d => (d.data = Array(10).fill(0.00005)));
    txChart.update();
    gasChart.update();
    document.querySelectorAll(".slot-value").forEach(s => (s.textContent = "0"));
    executedTx.textContent = failedTx.textContent = pendingTx.textContent = 0;
    jitGas.textContent = aotGas.textContent = totalGas.textContent = "0.00000";
    jitExecuted.textContent = jitPending.textContent = jitFailed.textContent = 0;
    aotExecuted.textContent = aotPending.textContent = aotFailed.textContent = 0;
    comparePanel.classList.add("hidden");
  });
});
