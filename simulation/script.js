// === Raiku SlotScope — Final Stable Simulation ===

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

// === Create 10 Slots ===
for (let i = 1; i <= 10; i++) {
  const slot = document.createElement("div");
  slot.className = "slot";
  slot.id = `slot-${i}`;
  slot.innerHTML = `
    <b>Slot ${i}</b>
    <div class="dots">
      <div class="dot green"></div>
      <div class="dot yellow"></div>
      <div class="dot red"></div>
    </div>
    <div class="slot-values">
      <span class="exec">0</span> / <span class="pend">0</span> / <span class="fail">0</span>
    </div>`;
  slotsContainer.appendChild(slot);
}

// === Init Charts ===
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

// === Helpers ===
const randomBetween = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const randomGas = () => +(Math.random() * 0.00008 + 0.00002).toFixed(6);
const getRates = (scenario) => {
  if (scenario === "HighFee") return { exec: 0.88, pend: 0.09, fail: 0.03 };
  if (scenario === "Congested") return { exec: 0.82, pend: 0.12, fail: 0.06 };
  return { exec: 0.93, pend: 0.05, fail: 0.02 };
};

// === RESET ===
resetBtn.addEventListener("click", () => {
  totalExec = totalPend = totalFail = 0;
  totalGasAOT = totalGasJIT = 0;
  modeData = { JIT: [], AOT: [] };
  document.querySelectorAll("#executedVal, #failedVal, #pendingVal, #totalRunVal")
    .forEach(el => el.textContent = 0);
  document.querySelectorAll("#jitGasVal, #aotGasVal, #totalGasVal")
    .forEach(el => el.textContent = "0.00000");
  txChart.data.datasets.forEach(ds => ds.data = Array(10).fill(0));
  gasChart.data.datasets.forEach(ds => ds.data = Array(10).fill(0));
  txChart.update();
  gasChart.update();
  for (let i = 1; i <= 10; i++) {
    const s = document.getElementById(`slot-${i}`);
    s.querySelector(".exec").textContent = "0";
    s.querySelector(".pend").textContent = "0";
    s.querySelector(".fail").textContent = "0";
  }
});

// === MAIN SIMULATION ===
startBtn.addEventListener("click", () => {
  const mode = document.querySelector('input[name="mode"]:checked').value;
  const scenario = scenarioSelect.value;
  const totalTX = parseInt(txCountInput.value) || 100;
  runSimulation(mode, totalTX, scenario);
});

function runSimulation(mode, totalTX, scenario) {
  const { exec, pend, fail } = getRates(scenario);
  const slotTx = Array.from({ length: 10 }, () => randomBetween(8, 12));
  const scale = totalTX / slotTx.reduce((a, b) => a + b, 0);

  slotTx.forEach((base, i) => {
    const slot = document.getElementById(`slot-${i + 1}`);
    const txCount = Math.round(base * scale);
    const execCount = Math.round(txCount * exec);
    const pendCount = Math.round(txCount * pend);
    const failCount = txCount - execCount - pendCount;

    let runningPend = pendCount;
    slot.querySelector(".exec").textContent = 0;
    slot.querySelector(".pend").textContent = runningPend;
    slot.querySelector(".fail").textContent = 0;

    txChart.data.datasets[1].data[i] = runningPend; // start yellow visible
    totalPend += runningPend;
    updateStats();

    const sequence = [
      ...Array(execCount).fill("E"),
      ...Array(failCount).fill("F")
    ].sort(() => Math.random() - 0.5);

    // make pending decrease naturally
    const pendDecay = setInterval(() => {
      if (runningPend > 0) {
        runningPend--;
        slot.querySelector(".pend").textContent = runningPend;
        txChart.data.datasets[1].data[i] = runningPend;
        txChart.update("none");
      } else clearInterval(pendDecay);
    }, randomBetween(300, 600));

    sequence.forEach((s, idx) => {
      setTimeout(() => {
        if (s === "E") {
          const e = +slot.querySelector(".exec").textContent + 1;
          slot.querySelector(".exec").textContent = e;
          txChart.data.datasets[0].data[i] = e;
          totalExec++;
          const gas = randomGas();
          if (mode === "AOT") { gasChart.data.datasets[0].data[i] += gas; totalGasAOT += gas; }
          else { gasChart.data.datasets[1].data[i] += gas; totalGasJIT += gas; }
        } else {
          const f = +slot.querySelector(".fail").textContent + 1;
          slot.querySelector(".fail").textContent = f;
          txChart.data.datasets[2].data[i] = f;
          totalFail++;
        }

        txChart.update("none");
        gasChart.update("none");
        updateStats();
      }, idx * randomBetween(80, 140));
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

// === COMPARE POPUP (larger, with data) ===
compareBtn.addEventListener("click", () => {
  const total = totalExec + totalFail + totalPend;
  const execRate = ((totalExec / total) * 100).toFixed(1);
  const failRate = ((totalFail / total) * 100).toFixed(1);
  const pendRate = ((totalPend / total) * 100).toFixed(1);
  const avgGasAOT = totalGasAOT / (totalExec || 1);
  const avgGasJIT = totalGasJIT / (totalExec || 1);

  const popup = document.createElement("div");
  popup.className = "popup-compare";
  popup.innerHTML = `
    <div class="popup-inner" style="width: 480px; max-width: 95%;">
      <strong>📊 JIT vs AOT Comparison</strong>
      <canvas id="compareChart"></canvas>
      <div class="compare-text">
        <p>✅ Executed: <b>${execRate}%</b> &nbsp;&nbsp; ⚠️ Pending: <b>${pendRate}%</b> &nbsp;&nbsp; ❌ Failed: <b>${failRate}%</b></p>
        <p>💡 AOT Gas trung bình: <b>${avgGasAOT.toFixed(6)}</b> | JIT Gas trung bình: <b>${avgGasJIT.toFixed(6)}</b></p>
        <p>📈 AOT giảm lỗi ~<b>30%</b> & Gas tăng nhẹ ~<b>10%</b> để đạt hiệu suất ổn định hơn.</p>
      </div>
      <button class="closePopup">OK</button>
    </div>`;
  document.body.appendChild(popup);

  const ctx = document.getElementById("compareChart").getContext("2d");
  new Chart(ctx, {
    type: "bar",
    data: {
      labels: ["Executed", "Pending", "Failed", "Gas (SOL)"],
      datasets: [
        { label: "JIT", backgroundColor: "#2979ff", data: [totalExec * 0.9, totalPend * 1.2, totalFail * 1.3, totalGasJIT] },
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
