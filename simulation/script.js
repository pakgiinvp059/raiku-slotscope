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

// === Create Slots ===
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

// === Charts ===
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

// === Helpers ===
const randomBetween = (a, b) => Math.floor(Math.random() * (b - a + 1)) + a;
const randomGas = () => +(Math.random() * 0.00008 + 0.00002).toFixed(6);
const getRates = (s) =>
  s === "HighFee" ? { exec: 0.88, pend: 0.09, fail: 0.03 } :
  s === "Congested" ? { exec: 0.82, pend: 0.12, fail: 0.06 } :
  { exec: 0.93, pend: 0.05, fail: 0.02 };

// === Reset ===
resetBtn.onclick = () => location.reload();

// === Run Simulation ===
startBtn.onclick = () => {
  const mode = document.querySelector('input[name="mode"]:checked').value;
  const sc = scenarioSelect.value;
  const totalTX = parseInt(txCountInput.value) || 100;
  simulate(mode, sc, totalTX);
};

function simulate(mode, sc, totalTX) {
  const { exec, pend, fail } = getRates(sc);
  const slotTx = Array.from({ length: 10 }, () => randomBetween(8, 12));
  const scale = totalTX / slotTx.reduce((a, b) => a + b, 0);
  let totalRun = 0;

  slotTx.forEach((base, i) => {
    const slot = document.getElementById(`slot-${i + 1}`);
    const tx = Math.round(base * scale);
    totalRun += tx;

    const eCount = Math.round(tx * exec);
    const pCount = Math.round(tx * pend);
    const fCount = tx - eCount - pCount;
    let pend = pCount;

    slot.querySelector(".exec").textContent = 0;
    slot.querySelector(".pend").textContent = pend;
    slot.querySelector(".fail").textContent = 0;

    txChart.data.datasets[1].data[i] = pend;
    totalPend += pend;

    const decay = setInterval(() => {
      if (pend > 0) {
        pend--;
        slot.querySelector(".pend").textContent = pend;
        txChart.data.datasets[1].data[i] = pend;
        txChart.update("none");
      } else clearInterval(decay);
    }, randomBetween(300, 600));

    const seq = [...Array(eCount).fill("E"), ...Array(fCount).fill("F")].sort(() => Math.random() - 0.5);
    seq.forEach((s, idx) => {
      setTimeout(() => {
        if (s === "E") {
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
        updateStats(totalRun);
      }, idx * randomBetween(80, 130) + randomBetween(250, 500));
    });
  });
}

function updateStats(totalRun) {
  document.getElementById("executedVal").textContent = totalExec;
  document.getElementById("failedVal").textContent = totalFail;
  document.getElementById("pendingVal").textContent = totalPend;
  document.getElementById("totalRunVal").textContent = totalRun;
  document.getElementById("jitGasVal").textContent = totalGasJIT.toFixed(6);
  document.getElementById("aotGasVal").textContent = totalGasAOT.toFixed(6);
  document.getElementById("totalGasVal").textContent = (totalGasAOT + totalGasJIT).toFixed(6);
}

// === Compare Popup (large, no efficiency text) ===
compareBtn.onclick = () => {
  const total = totalExec + totalFail + totalPend;
  if (!total) return;
  const execRate = ((totalExec / total) * 100).toFixed(1);
  const failRate = ((totalFail / total) * 100).toFixed(1);
  const pendRate = ((totalPend / total) * 100).toFixed(1);

  const popup = document.createElement("div");
  popup.className = "popup-compare";
  popup.innerHTML = `
    <div class="popup-inner">
      <strong>📊 JIT vs AOT Comparison</strong>
      <canvas id="compareChart"></canvas>
      <div class="compare-text">
        <p>✅ Executed: <b>${execRate}%</b> | ⚠️ Pending: <b>${pendRate}%</b> | ❌ Failed: <b>${failRate}%</b></p>
      </div>
      <button class="closePopup">Đóng</button>
    </div>`;
  document.body.appendChild(popup);

  const ctx = document.getElementById("compareChart").getContext("2d");
  new Chart(ctx, {
    type: "bar",
    data: {
      labels: ["Executed", "Pending", "Failed"],
      datasets: [
        { label: "JIT", backgroundColor:
