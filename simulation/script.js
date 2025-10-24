// === Raiku SlotScope — Fixed Pending + Real Comparison ===

const slotsContainer = document.getElementById("slots");
const startBtn = document.getElementById("startBtn");
const resetBtn = document.getElementById("resetBtn");
const compareBtn = document.getElementById("compareBtn");
const txCountInput = document.getElementById("txCount");
const scenarioSelect = document.getElementById("scenario");

let txChart, gasChart;
let totalExec = 0, totalPend = 0, totalFail = 0;
let totalGasAOT = 0, totalGasJIT = 0;
let totalRun = 0;
let jitData = { exec: 0, pend: 0, fail: 0, gas: 0 };
let aotData = { exec: 0, pend: 0, fail: 0, gas: 0 };

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
    <div><span class="exec">0</span> / <span class="pend">0</span> / <span class="fail">0</span></div>`;
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
    options: { responsive: true, maintainAspectRatio: false }
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
    options: { responsive: true, maintainAspectRatio: false }
  });
}
initCharts();

// === Helper Functions ===
const randomBetween = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const randomGas = (min, max) => +(Math.random() * (max - min) + min).toFixed(6);

function getRates(scenario, mode) {
  const base = {
    Normal: { exec: 0.93, pend: 0.05, fail: 0.02 },
    HighFee: { exec: 0.88, pend: 0.09, fail: 0.03 },
    Congested: { exec: 0.82, pend: 0.12, fail: 0.06 },
  }[scenario];
  
  if (mode === "AOT") {
    return {
      exec: base.exec + 0.03,
      pend: Math.max(base.pend - 0.02, 0.01),
      fail: Math.max(base.fail - 0.01, 0.005)
    };
  }
  return base;
}

// === Reset All ===
resetBtn.onclick = () => location.reload();

// === Simulation ===
startBtn.onclick = () => {
  const mode = document.querySelector('input[name="mode"]:checked').value;
  const scenario = scenarioSelect.value;
  const totalTX = parseInt(txCountInput.value) || 100;
  runSimulation(mode, scenario, totalTX);
};

function runSimulation(mode, scenario, totalTX) {
  const { exec, pend, fail } = getRates(scenario, mode);
  const slotTx = Array.from({ length: 10 }, () => randomBetween(8, 12));
  const scale = totalTX / slotTx.reduce((a, b) => a + b, 0);
  totalRun = totalTX;

  slotTx.forEach((base, i) => {
    const slot = document.getElementById(`slot-${i + 1}`);
    const txCount = Math.round(base * scale);
    const execCount = Math.round(txCount * exec);
    const pendCount = Math.round(txCount * pend);
    const failCount = txCount - execCount - pendCount;

    slot.querySelector(".exec").textContent = 0;
    slot.querySelector(".pend").textContent = pendCount;
    slot.querySelector(".fail").textContent = 0;

    txChart.data.datasets[1].data[i] = pendCount;
    totalPend += pendCount;

    const sequence = [...Array(execCount).fill("E"), ...Array(failCount).fill("F")].sort(() => Math.random() - 0.5);
    let pendingLeft = pendCount;

    // simulate pending decay
    const pendInterval = setInterval(() => {
      if (pendingLeft > 0) {
        pendingLeft--;
        slot.querySelector(".pend").textContent = pendingLeft;
        txChart.data.datasets[1].data[i] = pendingLeft;
        txChart.update("none");
      } else clearInterval(pendInterval);
    }, randomBetween(300, 700));

    sequence.forEach((s, idx) => {
      setTimeout(() => {
        if (s === "E") {
          const e = +slot.querySelector(".exec").textContent + 1;
          slot.querySelector(".exec").textContent = e;
          txChart.data.datasets[0].data[i] = e;
          totalExec++;
          const gas = mode === "AOT" ? randomGas(0.00005, 0.00008) : randomGas(0.00002, 0.00005);
          if (mode === "AOT") { gasChart.data.datasets[0].data[i] += gas; totalGasAOT += gas; aotData.gas += gas; }
          else { gasChart.data.datasets[1].data[i] += gas; totalGasJIT += gas; jitData.gas += gas; }
        } else {
          const f = +slot.querySelector(".fail").textContent + 1;
          slot.querySelector(".fail").textContent = f;
          txChart.data.datasets[2].data[i] = f;
          totalFail++;
        }

        txChart.update("none");
        gasChart.update("none");
        updateStats();

        // Cập nhật dữ liệu lưu theo mode
        if (mode === "JIT") { jitData.exec = totalExec; jitData.fail = totalFail; jitData.pend = totalPend; }
        else { aotData.exec = totalExec; aotData.fail = totalFail; aotData.pend = totalPend; }

      }, idx * randomBetween(100, 160));
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

// === Compare JIT & AOT Popup ===
compareBtn.onclick = () => {
  if (!jitData.exec && !aotData.exec) return;

  const popup = document.createElement("div");
  popup.className = "popup-compare";
  popup.innerHTML = `
    <div class="popup-inner" style="width: 480px; max-width: 95%;">
      <strong>📊 JIT vs AOT Comparison</strong>
      <canvas id="compareChart"></canvas>
      <div class="compare-text">
        <p>AOT ổn định hơn trong môi trường tắc nghẽn, đổi lại gas cao hơn một chút.</p>
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
        { label: "JIT", backgroundColor: "#2979ff", data: [jitData.exec, jitData.pend, jitData.fail, jitData.gas] },
        { label: "AOT", backgroundColor: "#00c853", data: [aotData.exec, aotData.pend, aotData.fail, aotData.gas] }
      ]
    },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: "top" } } }
  });

  popup.querySelector(".closePopup").addEventListener("click", () => popup.remove());
};
