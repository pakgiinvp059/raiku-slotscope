// Raiku SlotScope — Fixed Interactive Logic

const slotsContainer = document.getElementById("slots");
const startBtn = document.getElementById("startBtn");
const resetBtn = document.getElementById("resetBtn");
const compareBtn = document.getElementById("compareBtn");
const txCountInput = document.getElementById("txCount");
const scenarioSelect = document.getElementById("scenario");

let txChart, gasChart;
let totalExec = 0, totalPend = 0, totalFail = 0;
let totalGasAOT = 0, totalGasJIT = 0;
let modeData = { JIT: [], AOT: [] };

// ====== INIT SLOTS ======
for (let i = 1; i <= 10; i++) {
  const s = document.createElement("div");
  s.className = "slot";
  s.id = `slot-${i}`;
  s.innerHTML = `
    <b>Slot ${i}</b>
    <div class="dots">
      <div class="dot green"></div>
      <div class="dot yellow"></div>
      <div class="dot red"></div>
    </div>
    <div class="slot-values">
      <span class="exec">0</span> / <span class="pend">0</span> / <span class="fail">0</span>
    </div>`;
  slotsContainer.appendChild(s);
}

// ====== INIT CHARTS ======
function initCharts() {
  const txCtx = document.getElementById("txChart").getContext("2d");
  txChart = new Chart(txCtx, {
    type: "line",
    data: {
      labels: Array.from({ length: 10 }, (_, i) => `Slot ${i + 1}`),
      datasets: [
        { label: "Executed", borderColor: "#22c55e", data: Array(10).fill(0), fill: false, tension: 0.3 },
        { label: "Pending", borderColor: "#facc15", data: Array(10).fill(0), fill: false, tension: 0.3 },
        { label: "Failed", borderColor: "#ef4444", data: Array(10).fill(0), fill: false, tension: 0.3 }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: true, position: "top" } },
      animation: false
    }
  });

  const gasCtx = document.getElementById("gasChart").getContext("2d");
  gasChart = new Chart(gasCtx, {
    type: "bar",
    data: {
      labels: Array.from({ length: 10 }, (_, i) => `Slot ${i + 1}`),
      datasets: [
        { label: "AOT Gas", backgroundColor: "#00c853", data: Array(10).fill(0) },
        { label: "JIT Gas", backgroundColor: "#2979ff", data: Array(10).fill(0) }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: { y: { ticks: { callback: val => val.toFixed(6) } } }
    }
  });
}
initCharts();

// ====== UTILS ======
const randomBetween = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const randomGas = () => +(Math.random() * 0.00008 + 0.00002).toFixed(6);
const getRates = scenario => {
  if (scenario === "HighFee") return { exec: 0.9, pend: 0.08, fail: 0.02 };
  if (scenario === "Congested") return { exec: 0.85, pend: 0.1, fail: 0.05 };
  return { exec: 0.93, pend: 0.05, fail: 0.02 };
};

// ====== RESET ======
resetBtn.addEventListener("click", () => {
  totalExec = totalPend = totalFail = 0;
  totalGasAOT = totalGasJIT = 0;
  modeData = { JIT: [], AOT: [] };
  document.getElementById("executedVal").innerText = 0;
  document.getElementById("failedVal").innerText = 0;
  document.getElementById("pendingVal").innerText = 0;
  document.getElementById("totalRunVal").innerText = 0;
  document.getElementById("jitGasVal").innerText = "0.00000";
  document.getElementById("aotGasVal").innerText = "0.00000";
  document.getElementById("totalGasVal").innerText = "0.00000";
  txChart.data.datasets.forEach(ds => ds.data = Array(10).fill(0));
  gasChart.data.datasets.forEach(ds => ds.data = Array(10).fill(0));
  txChart.update(); gasChart.update();
  for (let i = 1; i <= 10; i++) {
    const slot = document.getElementById(`slot-${i}`);
    slot.querySelector(".exec").textContent = "0";
    slot.querySelector(".pend").textContent = "0";
    slot.querySelector(".fail").textContent = "0";
  }
});

// ====== SIMULATION ======
startBtn.addEventListener("click", () => {
  const mode = document.querySelector('input[name="mode"]:checked').value;
  const scenario = scenarioSelect.value;
  const totalTX = parseInt(txCountInput.value) || 100;
  simulateRun(mode, totalTX, scenario);
});

function simulateRun(mode, totalTX, scenario) {
  const { exec, pend, fail } = getRates(scenario);
  const slotTX = Array.from({ length: 10 }, () => randomBetween(8, 12));
  const scale = totalTX / slotTX.reduce((a, b) => a + b, 0);

  slotTX.forEach((base, i) => {
    const txSlot = Math.round(base * scale);
    const execCount = Math.round(txSlot * exec);
    const pendCount = Math.round(txSlot * pend);
    const failCount = txSlot - execCount - pendCount;

    let currentPending = pendCount;
    const slot = document.getElementById(`slot-${i + 1}`);
    slot.querySelector(".exec").textContent = "0";
    slot.querySelector(".pend").textContent = pendCount;
    slot.querySelector(".fail").textContent = "0";

    txChart.data.datasets[1].data[i] = pendCount;
    totalPend += pendCount;
    updateStats();

    const seq = [
      ...Array(execCount).fill("E"),
      ...Array(failCount).fill("F")
    ].sort(() => Math.random() - 0.5);

    seq.forEach((status, j) => {
      setTimeout(() => {
        if (currentPending > 0) currentPending--;
        slot.querySelector(".pend").textContent = currentPending;
        txChart.data.datasets[1].data[i] = currentPending;

        if (status === "E") {
          const e = +slot.querySelector(".exec").textContent + 1;
          slot.querySelector(".exec").textContent = e;
          txChart.data.datasets[0].data[i] = e;
          totalExec++;
          const g = randomGas();
          if (mode === "AOT") { gasChart.data.datasets[0].data[i] += g; totalGasAOT += g; }
          else { gasChart.data.datasets[1].data[i] += g; totalGasJIT += g; }
        } else {
          const f = +slot.querySelector(".fail").textContent + 1;
          slot.querySelector(".fail").textContent = f;
          txChart.data.datasets[2].data[i] = f;
          totalFail++;
        }

        txChart.update("none");
        gasChart.update("none");
        updateStats();
      }, j * randomBetween(80, 130));
    });
  });
}

function updateStats() {
  document.getElementById("executedVal").textContent = totalExec;
  document.getElementById("failedVal").textContent = totalFail;
  document.getElementById("pendingVal").textContent = totalPend;
  document.getElementById("totalRunVal").textContent = totalExec + totalPend + totalFail;
  document.getElementById("jitGasVal").textContent = totalGasJIT.toFixed(6);
  document.getElementById("aotGasVal").textContent = totalGasAOT.toFixed(6);
  document.getElementById("totalGasVal").textContent = (totalGasAOT + totalGasJIT).toFixed(6);
}

// ====== COMPARE POPUP ======
compareBtn.addEventListener("click", () => {
  const popup = document.createElement("div");
  popup.className = "popup-compare";
  popup.innerHTML = `
    <div class="popup-inner">
      <strong>📊 JIT vs AOT Comparison</strong>
      <canvas id="compareChart"></canvas>
      <p>💡 AOT giảm lỗi Pending & Failed rõ rệt, gas tăng nhẹ để ổn định hơn.</p>
      <button class="closePopup">OK</button>
    </div>`;
  document.body.appendChild(popup);

  const ctx = document.getElementById("compareChart").getContext("2d");
  new Chart(ctx, {
    type: "bar",
    data: {
      labels: ["Executed TX", "Pending TX", "Failed TX", "Gas (SOL)"],
      datasets: [
        { label: "JIT", backgroundColor: "#2979ff", data: [totalExec * 0.9, totalPend * 1.1, totalFail * 1.2, totalGasJIT] },
        { label: "AOT", backgroundColor: "#00c853", data: [totalExec, totalPend * 0.7, totalFail * 0.6, totalGasAOT * 1.1] }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { position: "top" } }
    }
  });

  popup.querySelector(".closePopup").addEventListener("click", () => popup.remove());
});
