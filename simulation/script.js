// === Raiku SlotScope — Stable Realistic Simulation ===

const slotsContainer = document.getElementById("slots");
const startBtn = document.getElementById("startBtn");
const resetBtn = document.getElementById("resetBtn");
const compareBtn = document.getElementById("compareBtn");
const txCountInput = document.getElementById("txCount");
const scenarioSelect = document.getElementById("scenario");

let txChart, gasChart;
let totalExec = 0, totalPend = 0, totalFail = 0;
let totalGasAOT = 0, totalGasJIT = 0;

// Keep per-mode snapshot for popup compare
let snapshot = {
  JIT: { exec: 0, pend: 0, fail: 0, gas: 0 },
  AOT: { exec: 0, pend: 0, fail: 0, gas: 0 }
};

// === Create 10 gates (slots) ===
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
    <div><span class="exec">0</span> / <span class="pend">0</span> / <span class="fail">0</span></div>`;
  slotsContainer.appendChild(slot);
}

// === Init Charts ===
function initCharts() {
  const txCtx = document.getElementById("txChart").getContext("2d");
  txChart = new Chart(txCtx, {
    type: "line",
    data: {
      labels: Array.from({ length: 10 }, (_, i) => `Gate ${i + 1}`),
      datasets: [
        { label: "Executed", borderColor: "#22c55e", pointRadius: 3, data: Array(10).fill(0), fill: false, tension: 0.2 },
        { label: "Pending", borderColor: "#facc15", pointRadius: 3, data: Array(10).fill(0), fill: false, tension: 0.2 },
        { label: "Failed", borderColor: "#ef4444", pointRadius: 3, data: Array(10).fill(0), fill: false, tension: 0.2 }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { position: "top" } },
      scales: {
        y: { beginAtZero: true, ticks: { precision: 0 } }
      },
      animation: { duration: 200 }
    }
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
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: { 
          beginAtZero: true,
          ticks: {
            callback: val => Number(val).toFixed(6)
          }
        }
      },
      animation: { duration: 200 }
    }
  });
}
initCharts();

// === Helpers ===
const randomBetween = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const randomGas = (min, max) => +(Math.random() * (max - min) + min).toFixed(6);

function getRates(scenario, mode) {
  // base rates
  const map = {
    Normal: { exec: 0.93, pend: 0.05, fail: 0.02 },
    HighFee: { exec: 0.88, pend: 0.09, fail: 0.03 },
    Congested: { exec: 0.82, pend: 0.12, fail: 0.06 }
  };
  const base = map[scenario] || map.Normal;
  if (mode === "AOT") {
    // AOT reduces pend & fail a bit at cost of slightly higher gas
    return {
      exec: Math.min(0.99, base.exec + 0.03),
      pend: Math.max(0.01, base.pend - 0.02),
      fail: Math.max(0.005, base.fail - 0.01)
    };
  }
  return base;
}

// Reset: clear all numbers, charts
resetBtn.addEventListener("click", () => {
  totalExec = totalPend = totalFail = 0;
  totalGasAOT = totalGasJIT = 0;
  snapshot = { JIT: { exec: 0, pend: 0, fail: 0, gas: 0 }, AOT: { exec: 0, pend: 0, fail: 0, gas: 0 } };

  document.getElementById("executedVal").textContent = 0;
  document.getElementById("failedVal").textContent = 0;
  document.getElementById("pendingVal").textContent = 0;
  document.getElementById("totalRunVal").textContent = 0;
  document.getElementById("jitGasVal").textContent = "0.000000";
  document.getElementById("aotGasVal").textContent = "0.000000";
  document.getElementById("totalGasVal").textContent = "0.000000";

  txChart.data.datasets.forEach(ds => { ds.data = Array(10).fill(0); });
  gasChart.data.datasets.forEach(ds => { ds.data = Array(10).fill(0); });
  txChart.update();
  gasChart.update();

  for (let i = 1; i <= 10; i++) {
    const s = document.getElementById(`slot-${i}`);
    s.querySelector(".exec").textContent = "0";
    s.querySelector(".pend").textContent = "0";
    s.querySelector(".fail").textContent = "0";
  }
});

// Main: start simulation
startBtn.addEventListener("click", () => {
  // avoid double-run if already running: simple reload behavior
  // Reset totals but keep visual canvas (user pressed Start multiple times)
  totalExec = totalPend = totalFail = 0;
  totalGasAOT = totalGasJIT = 0;

  const mode = document.querySelector('input[name="mode"]:checked').value;
  const scenario = scenarioSelect.value;
  const totalTX = Math.max(1, parseInt(txCountInput.value) || 100);

  runSimulation(mode, scenario, totalTX);
});

function runSimulation(mode, scenario, totalTX) {
  // Prepare rates
  const rates = getRates(scenario, mode);

  // Generate 10 base counts (random close numbers) then scale to match totalTX exactly
  let base = Array.from({ length: 10 }, () => randomBetween(8, 12));
  const baseSum = base.reduce((a,b)=>a+b,0);
  const scale = totalTX / baseSum;

  // produce integer per-gate totals and fix rounding difference
  let slotTx = base.map(v => Math.round(v * scale));
  let sumSlots = slotTx.reduce((a,b)=>a+b,0);
  // adjust difference
  let diff = totalTX - sumSlots;
  let idx = 0;
  while (diff !== 0) {
    slotTx[idx % 10] += (diff > 0 ? 1 : -1);
    diff += (diff > 0 ? -1 : 1);
    idx++;
  }

  // initialize charts and stats for this run
  txChart.data.datasets.forEach(ds => ds.data = Array(10).fill(0));
  gasChart.data.datasets.forEach(ds => ds.data = Array(10).fill(0));
  totalPend = 0; // will sum initial pend
  totalExec = totalFail = totalGasAOT = totalGasJIT = 0;

  // Track number of processed ops overall to know when finished
  let processedOps = 0;
  const totalOps = totalTX;

  for (let i = 0; i < 10; i++) {
    const gateIndex = i;
    const txCount = slotTx[i];
    // compute counts: exec & fail first, then pending = remainder to ensure exact sum
    let execCount = Math.floor(txCount * rates.exec);
    let failCount = Math.floor(txCount * rates.fail);
    let pendCount = txCount - execCount - failCount; // ensures sum == txCount

    // small adjustment if rounding caused negative (defensive)
    if (pendCount < 0) { pendCount = 0; execCount = txCount - failCount; }

    // initialize slot UI
    const slot = document.getElementById(`slot-${i+1}`);
    slot.querySelector(".exec").textContent = "0";
    slot.querySelector(".pend").textContent = String(pendCount);
    slot.querySelector(".fail").textContent = "0";

    // update chart pending initial and totalPend
    txChart.data.datasets[1].data[gateIndex] = pendCount;
    totalPend += pendCount;
    txChart.update();

    // build random sequence of E/F but process via a queue: pending will be decremented as items pop
    const seq = [...Array(execCount).fill('E'), ...Array(failCount).fill('F')];
    // shuffle
    for (let s = seq.length - 1; s > 0; s--) {
      const r = Math.floor(Math.random() * (s + 1));
      [seq[s], seq[r]] = [seq[r], seq[s]];
    }

    // Process queue with interval per gate so updates are staggered and smooth
    if (seq.length === 0) {
      // nothing to process (all were pending 0). still update snapshot
      continue;
    }

    let queueIndex = 0;
    const interval = setInterval(() => {
      if (queueIndex >= seq.length) {
        clearInterval(interval);
        // snapshot per-mode when this gate finishes not necessary; we snapshot globally below when all done
        return;
      }

      // When processing one op: pending decreases by 1 (if any), then op becomes E or F
      if (pendCount > 0) {
        pendCount--;
        totalPend--;
        slot.querySelector(".pend").textContent = String(pendCount);
        txChart.data.datasets[1].data[gateIndex] = pendCount;
      } // else pending already 0 (all pending consumed earlier)

      const op = seq[queueIndex++];
      if (op === 'E') {
        // executed
        const curE = +slot.querySelector(".exec").textContent + 1;
        slot.querySelector(".exec").textContent = String(curE);
        txChart.data.datasets[0].data[gateIndex] = curE;
        totalExec++;

        // add gas according to mode (AOT slightly higher)
        const gas = mode === 'AOT' ? randomGas(0.00004, 0.00008) : randomGas(0.00002, 0.00005);
        if (mode === 'AOT') {
          gasChart.data.datasets[0].data[gateIndex] = +(gasChart.data.datasets[0].data[gateIndex] + gas).toFixed(6);
          totalGasAOT += gas;
        } else {
          gasChart.data.datasets[1].data[gateIndex] = +(gasChart.data.datasets[1].data[gateIndex] + gas).toFixed(6);
          totalGasJIT += gas;
        }
      } else {
        // failed
        const curF = +slot.querySelector(".fail").textContent + 1;
        slot.querySelector(".fail").textContent = String(curF);
        txChart.data.datasets[2].data[gateIndex] = curF;
        totalFail++;
      }

      processedOps++;
      // update charts & stats (fast)
      txChart.update('none');
      gasChart.update('none');
      updateStats();

      // if all processed -> finish: create snapshot for mode (use current totals)
      if (processedOps >= totalOps) {
        // create per-mode snapshot exactly from totals and gas totals
        snapshot[mode] = {
          exec: totalExec,
          pend: totalPend,
          fail: totalFail,
          gas: mode === 'AOT' ? totalGasAOT : totalGasJIT
        };
      }
    }, randomBetween(90, 160)); // stagger speed
  }

  // Final safety: ensure totals sum to totalTX after short delay (in case rounding)
  setTimeout(() => {
    const sum = totalExec + totalFail + totalPend;
    if (sum !== totalTX) {
      // adjust pending to match totalTX (rare) by setting pending = totalTX - exec - fail
      totalPend = Math.max(0, totalTX - totalExec - totalFail);
    }
    updateStats();
  }, 1200);
}

// update stats display
function updateStats() {
  document.getElementById("executedVal").textContent = totalExec;
  document.getElementById("failedVal").textContent = totalFail;
  document.getElementById("pendingVal").textContent = totalPend;
  document.getElementById("totalRunVal").textContent = totalExec + totalFail + totalPend;
  document.getElementById("jitGasVal").textContent = totalGasJIT.toFixed(6);
  document.getElementById("aotGasVal").textContent = totalGasAOT.toFixed(6);
  document.getElementById("totalGasVal").textContent = (totalGasAOT + totalGasJIT).toFixed(6);
}

// Compare popup (bigger, centered) — uses collected snapshot values
compareBtn.addEventListener("click", () => {
  // ensure there's some data to compare (either snapshot has exec)
  const hasJIT = snapshot.JIT.exec > 0;
  const hasAOT = snapshot.AOT.exec > 0;
  // if both empty, try to derive from current totals for active mode
  if (!hasJIT && !hasAOT && (totalExec + totalFail + totalPend) === 0) {
    return; // nothing to show
  }

  // Build popup
  const popup = document.createElement("div");
  popup.className = "popup-compare";
  popup.innerHTML = `
    <div class="popup-inner">
      <strong>📊 JIT vs AOT Comparison</strong>
      <canvas id="compareChart"></canvas>
      <div class="compare-text">
        <p style="margin:6px 0 0 0;">AOT: giảm pending/fail so với JIT — đổi lại gas tăng nhẹ.</p>
      </div>
      <button class="closePopup">OK</button>
    </div>
  `;
  document.body.appendChild(popup);

  // Choose numbers to show: if snapshot empty for one mode, use current totals as fallback
  const jitExec = snapshot.JIT.exec || (document.querySelector('input[name="mode"]:checked').value === 'JIT' ? totalExec : 0);
  const jitPend = snapshot.JIT.pend || (document.querySelector('input[name="mode"]:checked').value === 'JIT' ? totalPend : 0);
  const jitFail = snapshot.JIT.fail || (document.querySelector('input[name="mode"]:checked').value === 'JIT' ? totalFail : 0);
  const jitGas = snapshot.JIT.gas || totalGasJIT;

  const aotExec = snapshot.AOT.exec || (document.querySelector('input[name="mode"]:checked').value === 'AOT' ? totalExec : 0);
  const aotPend = snapshot.AOT.pend || (document.querySelector('input[name="mode"]:checked').value === 'AOT' ? totalPend : 0);
  const aotFail = snapshot.AOT.fail || (document.querySelector('input[name="mode"]:checked').value === 'AOT' ? totalFail : 0);
  const aotGas = snapshot.AOT.gas || totalGasAOT;

  const ctx = document.getElementById("compareChart").getContext("2d");
  new Chart(ctx, {
    type: "bar",
    data: {
      labels: ["Executed", "Pending", "Failed", "Gas (SOL)"],
      datasets: [
        { label: "JIT", backgroundColor: "#2979ff", data: [jitExec, jitPend, jitFail, jitGas] },
        { label: "AOT", backgroundColor: "#00c853", data: [aotExec, aotPend, aotFail, aotGas] }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { position: "top" } },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            // Gas may be small, we allow decimals; display with fixed places if number < 1
            callback: function(val) {
              if (val < 1) return Number(val).toFixed(6);
              return val;
            }
          }
        }
      }
    }
  });

  popup.querySelector(".closePopup").addEventListener("click", () => popup.remove());
});
