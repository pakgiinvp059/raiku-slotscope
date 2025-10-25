// === Raiku SlotScope — Smooth & Accurate Simulation ===

const slotsContainer = document.getElementById("slots");
const startBtn = document.getElementById("startBtn");
const resetBtn = document.getElementById("resetBtn");
const compareBtn = document.getElementById("compareBtn");
const txCountInput = document.getElementById("txCount");
const scenarioSelect = document.getElementById("scenario");

let txChart, gasChart;
let totalExec = 0, totalPend = 0, totalFail = 0;
let totalGasAOT = 0, totalGasJIT = 0;
let jitData = { exec: 0, pend: 0, fail: 0, gas: 0 };
let aotData = { exec: 0, pend: 0, fail: 0, gas: 0 };

// === Create 10 Gates ===
for (let i = 1; i <= 10; i++) {
  const gate = document.createElement("div");
  gate.className = "slot";
  gate.id = `gate-${i}`;
  gate.innerHTML = `
    <b>Gate ${i}</b>
    <div class="dots">
      <div class="dot green"></div>
      <div class="dot yellow"></div>
      <div class="dot red"></div>
    </div>
    <div><span class="exec">0</span> / <span class="pend">0</span> / <span class="fail">0</span></div>`;
  slotsContainer.appendChild(gate);
}

// === Init Charts ===
function initCharts() {
  const txCtx = document.getElementById("txChart").getContext("2d");
  txChart = new Chart(txCtx, {
    type: "line",
    data: {
      labels: Array.from({ length: 10 }, (_, i) => `Gate ${i + 1}`),
      datasets: [
        { label: "Executed", borderColor: "#22c55e", data: Array(10).fill(0), fill: false, tension: 0.3 },
        { label: "Pending", borderColor: "#facc15", data: Array(10).fill(0), fill: false, tension: 0.3 },
        { label: "Failed", borderColor: "#ef4444", data: Array(10).fill(0), fill: false, tension: 0.3 }
      ]
    },
    options: { responsive: true, maintainAspectRatio: false, animation: { duration: 0 } }
  });

  const gasCtx = document.getElementById("gasChart").getContext("2d");
  gasChart = new Chart(gasCtx, {
    type: "bar",
    data: {
      labels: Array.from({ length: 10 }, (_, i) => `Gate ${i + 1}`),
      datasets: [
        { label: "AOT Gas", backgroundColor: "#00c853", data: Array(10).fill(0) },
        { label: "JIT Gas", backgroundColor: "#2979ff", data: Array(10).fill(0) }
      ]
    },
    options: { responsive: true, maintainAspectRatio: false }
  });
}
initCharts();

const randomBetween = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const randomGas = (min, max) => +(Math.random() * (max - min) + min).toFixed(6);

function getRates(scenario, mode) {
  const base = {
    Normal: { exec: 0.93, pend: 0.05, fail: 0.02 },
    HighFee: { exec: 0.88, pend: 0.09, fail: 0.03 },
    Congested: { exec: 0.82, pend: 0.12, fail: 0.06 }
  }[scenario];
  return mode === "AOT"
    ? { exec: base.exec + 0.03, pend: Math.max(base.pend - 0.02, 0.01), fail: Math.max(base.fail - 0.01, 0.005) }
    : base;
}

resetBtn.onclick = () => location.reload();

// === Main Simulation ===
startBtn.onclick = () => {
  const mode = document.querySelector('input[name="mode"]:checked').value;
  const scenario = scenarioSelect.value;
  const totalTX = parseInt(txCountInput.value) || 100;
  simulate(mode, scenario, totalTX);
};

function simulate(mode, scenario, totalTX) {
  const { exec, pend, fail } = getRates(scenario, mode);
  const perGate = Math.floor(totalTX / 10);

  totalExec = totalPend = totalFail = totalGasAOT = totalGasJIT = 0;

  for (let i = 0; i < 10; i++) {
    const gate = document.getElementById(`gate-${i + 1}`);
    const execTarget = Math.floor(perGate * exec);
    const pendTarget = Math.floor(perGate * pend);
    const failTarget = Math.floor(perGate * fail);

    let execC = 0, failC = 0, pendC = pendTarget;
    txChart.data.datasets[1].data[i] = pendC;
    gate.querySelector(".pend").textContent = pendC;
    totalPend += pendC;

    const allTx = [...Array(execTarget).fill("E"), ...Array(failTarget).fill("F")];
    allTx.sort(() => Math.random() - 0.5);

    let idx = 0;
    const interval = setInterval(() => {
      if (idx >= allTx.length && pendC <= 0) return clearInterval(interval);

      if (pendC > 0 && Math.random() > 0.5) {
        pendC--;
        txChart.data.datasets[1].data[i] = pendC;
        gate.querySelector(".pend").textContent = pendC;
        totalPend--;
      }

      if (idx < allTx.length) {
        const type = allTx[idx];
        if (type === "E") {
          execC++;
          gate.querySelector(".exec").textContent = execC;
          txChart.data.datasets[0].data[i] = execC;
          totalExec++;
          const gas = mode === "AOT" ? randomGas(0.00005, 0.00008) : randomGas(0.00002, 0.00005);
          if (mode === "AOT") totalGasAOT += gas;
          else totalGasJIT += gas;
        } else {
          failC++;
          gate.querySelector(".fail").textContent = failC;
          txChart.data.datasets[2].data[i] = failC;
          totalFail++;
        }
        idx++;
      }

      txChart.update("none");
      gasChart.update("none");
      updateStats();
    }, randomBetween(80, 150));
  }
}

function updateStats() {
  const total = totalExec + totalPend + totalFail;
  document.getElementById("executedVal").textContent = totalExec;
  document.getElementById("failedVal").textContent = totalFail;
  document.getElementById("pendingVal").textContent = totalPend;
  document.getElementById("totalRunVal").textContent = total;
  document.getElementById("jitGasVal").textContent = totalGasJIT.toFixed(6);
  document.getElementById("aotGasVal").textContent = totalGasAOT.toFixed(6);
  document.getElementById("totalGasVal").textContent = (totalGasAOT + totalGasJIT).toFixed(6);
}

// === Compare Popup ===
compareBtn.onclick = () => {
  const popup = document.createElement("div");
  popup.className = "popup-compare";
  popup.innerHTML = `
    <div class="popup-inner">
      <strong>📊 JIT vs AOT Comparison</strong>
      <canvas id="compareChart"></canvas>
      <div class="compare-text">
        <p>AOT giảm Pending & Failed rõ rệt so với JIT<br>nhưng tăng gas nhẹ để đạt độ ổn định cao hơn.</p>
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
        { label: "JIT", backgroundColor: "#2979ff", data: [totalExec * 0.9, totalPend * 1.3, totalFail * 1.2, totalGasJIT] },
        { label: "AOT", backgroundColor: "#00c853", data: [totalExec, totalPend * 0.7, totalFail * 0.6, totalGasAOT * 1.1] }
      ]
    },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: "top" } } }
  });

  popup.querySelector(".closePopup").addEventListener("click", () => popup.remove());
};
