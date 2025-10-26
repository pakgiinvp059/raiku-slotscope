// === Raiku SlotScope — Corrected Deterministic Simulation ===

const slotsContainer = document.getElementById("slots");
const startBtn = document.getElementById("startBtn");
const resetBtn = document.getElementById("resetBtn");
const compareBtn = document.getElementById("compareBtn");
const txCountInput = document.getElementById("txCount");
const scenarioSelect = document.getElementById("scenario");

let txChart, gasChart;
let totalExec = 0, totalPend = 0, totalFail = 0;
let totalGasAOT = 0, totalGasJIT = 0;

// cumulative per-mode stats (for comparison)
let cumulative = {
  JIT: { exec: 0, pend: 0, fail: 0, gas: 0, runs: 0 },
  AOT: { exec: 0, pend: 0, fail: 0, gas: 0, runs: 0 }
};

let running = false; // block overlapping runs

// create 10 gates (slots)
for (let i = 1; i <= 10; i++) {
  const slot = document.createElement("div");
  slot.className = "slot";
  slot.id = `slot-${i}`;
  slot.innerHTML = `
    <b>Gate ${i}</b>
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

// charts init
function initCharts() {
  const txCtx = document.getElementById("txChart").getContext("2d");
  txChart = new Chart(txCtx, {
    type: "line",
    data: {
      labels: Array.from({length:10}, (_,i) => `Gate ${i+1}`),
      datasets: [
        { label: "Executed", borderColor: "#22c55e", backgroundColor: "rgba(34,197,94,0.06)", data: Array(10).fill(0), fill: true, tension: 0.3, pointRadius: 3 },
        { label: "Pending", borderColor: "#facc15", backgroundColor: "rgba(250,204,21,0.06)", data: Array(10).fill(0), fill: false, tension: 0.3, pointRadius: 3 },
        { label: "Failed", borderColor: "#ef4444", backgroundColor: "rgba(239,68,68,0.04)", data: Array(10).fill(0), fill: false, tension: 0.3, pointRadius: 3 }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: true, position: "top" } },
      animation: { duration: 200 }
    }
  });

  const gasCtx = document.getElementById("gasChart").getContext("2d");
  gasChart = new Chart(gasCtx, {
    type: "bar",
    data: {
      labels: Array.from({length:10}, (_,i) => `Gate ${i+1}`),
      datasets: [
        { label: "AOT Gas", backgroundColor: "#00c853", data: Array(10).fill(0) },
        { label: "JIT Gas", backgroundColor: "#2979ff", data: Array(10).fill(0) }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          ticks: { callback: val => Number(val).toFixed(6) }
        }
      },
      animation: { duration: 200 }
    }
  });
}
initCharts();

// helpers
const randBetween = (min, max) => Math.random() * (max - min) + min;
const randInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
function getRates(scenario, mode) {
  const base = {
    Normal: { exec: 0.93, pend: 0.05, fail: 0.02 },
    HighFee: { exec: 0.88, pend: 0.09, fail: 0.03 },
    Congested: { exec: 0.82, pend: 0.12, fail: 0.06 }
  }[scenario] || { exec: 0.93, pend: 0.05, fail: 0.02 };

  if (mode === "AOT") {
    // AOT reduces pend/fail slightly and increases exec a bit
    return { exec: Math.min(base.exec + 0.03, 0.99), pend: Math.max(base.pend - 0.02, 0.01), fail: Math.max(base.fail - 0.01, 0.001) };
  }
  return base;
}
function randomGasForMode(mode) {
  // JIT cheaper, AOT slightly higher
  if (mode === "AOT") return +(randBetween(0.00004, 0.00007)).toFixed(6);
  return +(randBetween(0.00002, 0.00004)).toFixed(6);
}

// Reset clears everything (cumulative too)
resetBtn.addEventListener("click", () => {
  if (running) return; // prevent reset while running; optional: allow and cancel timers (not implemented)
  totalExec = totalPend = totalFail = 0;
  totalGasAOT = totalGasJIT = 0;
  cumulative = { JIT: {exec:0,pend:0,fail:0,gas:0,runs:0}, AOT: {exec:0,pend:0,fail:0,gas:0,runs:0} };
  document.querySelectorAll("#executedVal, #failedVal, #pendingVal, #totalRunVal, #jitGasVal, #aotGasVal, #totalGasVal")
    .forEach(el => el.textContent = el.id && el.id.includes("Gas") ? "0.000000" : "0");
  // reset slot UI and charts
  for (let i = 1; i <= 10; i++) {
    const s = document.getElementById(`slot-${i}`);
    s.querySelector(".exec").textContent = "0";
    s.querySelector(".pend").textContent = "0";
    s.querySelector(".fail").textContent = "0";
  }
  txChart.data.datasets.forEach(ds => ds.data = Array(10).fill(0));
  gasChart.data.datasets.forEach(ds => ds.data = Array(10).fill(0));
  txChart.update();
  gasChart.update();
});

// Start simulation (single run). Block if already running.
startBtn.addEventListener("click", () => {
  if (running) return;
  running = true;
  startBtn.disabled = true;
  const mode = document.querySelector('input[name="mode"]:checked').value;
  const scenario = scenarioSelect.value;
  const totalTX = Math.max(1, parseInt(txCountInput.value) || 100);
  runSimulation(mode, scenario, totalTX).finally(() => {
    running = false;
    startBtn.disabled = false;
  });
});

// main run — returns a Promise that resolves when all conversions are done
async function runSimulation(mode, scenario, totalTX) {
  const rates = getRates(scenario, mode);

  // Distribute exactly totalTX across 10 gates
  const perGateBase = Math.floor(totalTX / 10);
  let remainder = totalTX % 10;
  const gateCounts = Array.from({length:10}, (_,i) => {
    const add = remainder > 0 ? 1 : 0;
    if (remainder > 0) remainder--;
    return perGateBase + add;
  });

  // Create per-gate arrays of tx objects for this run
  // Each tx object: {status: 'P'|'E'|'F'}
  const runTxsByGate = gateCounts.map(cnt => Array.from({length:cnt}, ()=>({status:'P'})));

  // Immediately register all as pending (so totals match right away)
  const totalThisRun = gateCounts.reduce((a,b)=>a+b,0);
  totalPend += totalThisRun;
  // Also update cumulative pending for chosen mode (counts pending at start)
  cumulative[mode].pend += totalThisRun;
  cumulative[mode].runs += 1;

  // Update UI pending counts per gate and chart
  for (let g=0; g<10; g++) {
    const slot = document.getElementById(`slot-${g+1}`);
    slot.querySelector(".exec").textContent = 0;
    slot.querySelector(".pend").textContent = runTxsByGate[g].length;
    slot.querySelector(".fail").textContent = 0;
    txChart.data.datasets[1].data[g] = runTxsByGate[g].length;
    txChart.data.datasets[0].data[g] = 0;
    txChart.data.datasets[2].data[g] = 0;
    // ensure gas datasets have entries
    if (!gasChart.data.datasets[0].data[g]) gasChart.data.datasets[0].data[g] = 0;
    if (!gasChart.data.datasets[1].data[g]) gasChart.data.datasets[1].data[g] = 0;
  }
  txChart.update();
  gasChart.update();
  updateStats();

  // Process each gate: schedule conversions of each pending TX to E or F
  const promises = [];
  for (let g=0; g<10; g++) {
    const txList = runTxsByGate[g];
    // create a randomized delay table so conversions look realistic but deterministic count
    for (let i=0; i<txList.length; i++) {
      const p = new Promise(resolve => {
        // stagger conversions over 400..1400ms per tx to simulate pipeline (adjustable)
        const delay = randBetween(150 + i*10, 800 + i*20);
        setTimeout(() => {
          // convert one pending tx -> Exec or Fail according to rates
          // Note: We consider pend->exec/fail probabilities on conversion
          const r = Math.random();
          const willExec = r < rates.exec;
          // update txList entry
          txList[i].status = willExec ? 'E' : 'F';

          // update global counters (atomic)
          totalPend--; // this tx left pending
          if (willExec) {
            totalExec++;
            cumulative[mode].exec++;
            // gas assign only on executed
            const gCost = randomGasForMode(mode);
            if (mode === "AOT") { totalGasAOT += gCost; cumulative[mode].gas += gCost; gasChart.data.datasets[0].data[g] = +(gasChart.data.datasets[0].data[g] + gCost); }
            else { totalGasJIT += gCost; cumulative[mode].gas += gCost; gasChart.data.datasets[1].data[g] = +(gasChart.data.datasets[1].data[g] + gCost); }
            // update slot exec count
            const slot = document.getElementById(`slot-${g+1}`);
            slot.querySelector(".exec").textContent = +slot.querySelector(".exec").textContent + 1;
            txChart.data.datasets[0].data[g] = +txChart.data.datasets[0].data[g] + 1;
          } else {
            totalFail++;
            cumulative[mode].fail++;
            const slot = document.getElementById(`slot-${g+1}`);
            slot.querySelector(".fail").textContent = +slot.querySelector(".fail").textContent + 1;
            txChart.data.datasets[2].data[g] = +txChart.data.datasets[2].data[g] + 1;
          }

          // pending display update per gate
          const slot = document.getElementById(`slot-${g+1}`);
          slot.querySelector(".pend").textContent = Math.max(0, +slot.querySelector(".pend").textContent - 1);
          txChart.data.datasets[1].data[g] = Math.max(0, txChart.data.datasets[1].data[g] - 1);

          // update charts & stats
          txChart.update();
          gasChart.update();
          updateStats();

          resolve();
        }, delay);
      });
      promises.push(p);
    }
  }

  // When all TX conversions finished for this run, resolve
  await Promise.all(promises);
  // done — totals already incremented in conversion steps; ensure chart updates final
  txChart.update();
  gasChart.update();
  updateStats();
  return;
}

// update UI stats
function updateStats() {
  document.getElementById("executedVal").textContent = totalExec;
  document.getElementById("failedVal").textContent = totalFail;
  document.getElementById("pendingVal").textContent = totalPend;
  document.getElementById("totalRunVal").textContent = totalExec + totalFail + totalPend;
  document.getElementById("jitGasVal").textContent = totalGasJIT.toFixed(6);
  document.getElementById("aotGasVal").textContent = totalGasAOT.toFixed(6);
  document.getElementById("totalGasVal").textContent = (totalGasAOT + totalGasJIT).toFixed(6);
}

// compare popup (uses cumulative totals per mode)
compareBtn.addEventListener("click", () => {
  // if no runs at all, ignore
  if (cumulative.JIT.runs === 0 && cumulative.AOT.runs === 0) return;

  const popup = document.createElement("div");
  popup.className = "popup-compare";
  popup.innerHTML = `
    <div class="popup-inner">
      <strong>📊 JIT vs AOT Comparison</strong>
      <canvas id="compareChart"></canvas>
      <div class="compare-text">
        <p style="margin:6px 0;font-size:13px;">
          Executed / Pending / Failed — cumulative across runs.<br/>
          AOT trades a small gas increase for fewer pending/failed.
        </p>
      </div>
      <button class="closePopup">Close</button>
    </div>`;
  document.body.appendChild(popup);

  // prepare compare data
  const jit = cumulative.JIT;
  const aot = cumulative.AOT;
  const labels = ["Executed", "Pending", "Failed", "Gas (SOL)"];
  const jitValues = [jit.exec, jit.pend, jit.fail, +jit.gas.toFixed(6)];
  const aotValues = [aot.exec, aot.pend, aot.fail, +aot.gas.toFixed(6)];

  const ctx = document.getElementById("compareChart").getContext("2d");
  new Chart(ctx, {
    type: "bar",
    data: {
      labels,
      datasets: [
        { label: "JIT", backgroundColor: "#2979ff", data: jitValues },
        { label: "AOT", backgroundColor: "#00c853", data: aotValues }
      ]
    },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: "top" } } }
  });

  popup.querySelector(".closePopup").addEventListener("click", () => popup.remove());
});
