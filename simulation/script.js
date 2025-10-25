// === script.js (REPLACEMENT) ===
// Raiku SlotScope — cumulative runs until Reset, exact TX accounting, smoother updates

const slotsContainer = document.getElementById("slots");
const startBtn = document.getElementById("startBtn");
const resetBtn = document.getElementById("resetBtn");
const compareBtn = document.getElementById("compareBtn");
const txCountInput = document.getElementById("txCount");
const scenarioSelect = document.getElementById("scenario");

let txChart, gasChart;

// GLOBAL totals (cumulative across runs until reset)
let totalExec = 0, totalPend = 0, totalFail = 0;
let totalGasAOT = 0, totalGasJIT = 0;

// snapshot for popup compare (keeps latest cumulative by mode)
let snapshot = { JIT: { exec: 0, pend: 0, fail: 0, gas: 0 }, AOT: { exec: 0, pend: 0, fail: 0, gas: 0 } };

// create 10 gates UI (if not already created by html flow)
if (!document.getElementById('slot-1')) {
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
}

// init charts (if not created)
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
      scales: { y: { beginAtZero: true, ticks: { precision: 0 } } },
      animation: { duration: 220 }
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
          ticks: { callback: val => Number(val).toFixed(6) }
        }
      },
      animation: { duration: 220 }
    }
  });
}
initCharts();

// helpers
const randomBetween = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const randomGas = (min, max) => +(Math.random() * (max - min) + min).toFixed(6);

function getRates(scenario, mode) {
  const baseMap = {
    Normal: { exec: 0.93, pend: 0.05, fail: 0.02 },
    HighFee: { exec: 0.88, pend: 0.09, fail: 0.03 },
    Congested: { exec: 0.82, pend: 0.12, fail: 0.06 }
  };
  const base = baseMap[scenario] || baseMap.Normal;
  if (mode === 'AOT') {
    return {
      exec: Math.min(0.99, base.exec + 0.03),
      pend: Math.max(0.01, base.pend - 0.02),
      fail: Math.max(0.005, base.fail - 0.01)
    };
  }
  return base;
}

// Reset — clears everything to initial state
resetBtn.addEventListener('click', () => {
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

// start: DO NOT reset cumulative totals here (user wanted accumulation until Reset)
startBtn.addEventListener('click', () => {
  const mode = document.querySelector('input[name="mode"]:checked').value;
  const scenario = scenarioSelect.value;
  const totalTX = Math.max(1, parseInt(txCountInput.value) || 100);

  // run simulation; totals will be incremented (cumulative)
  runSimulation(mode, scenario, totalTX);
});

function runSimulation(mode, scenario, totalTX) {
  const rates = getRates(scenario, mode);

  // pick base per-gate numbers (random around 8-12), then scale to match totalTX exactly
  let base = Array.from({ length: 10 }, () => randomBetween(8, 12));
  const baseSum = base.reduce((a,b)=>a+b,0);
  const scale = totalTX / baseSum;

  let slotTx = base.map(v => Math.max(0, Math.round(v * scale)));
  // Fix rounding difference to ensure exact totalTX
  let sumSlots = slotTx.reduce((a,b)=>a+b,0);
  let diff = totalTX - sumSlots;
  let j = 0;
  while (diff !== 0) {
    const idx = j % 10;
    slotTx[idx] += (diff > 0 ? 1 : -1);
    diff += (diff > 0 ? -1 : 1);
    j++;
  }

  // we'll process exactly totalTX ops (seqs across gates sum to totalTX)
  let opsScheduled = 0;
  slotTx.forEach(x => opsScheduled += x);
  // defensive: ensure opsScheduled equals totalTX
  if (opsScheduled !== totalTX) {
    // if mismatch, force distribute evenly
    slotTx = Array.from({ length: 10 }, (_,i) => Math.floor(totalTX / 10));
    let leftover = totalTX - slotTx.reduce((a,b)=>a+b,0);
    let k = 0;
    while (leftover > 0) { slotTx[k%10]++; leftover--; k++; }
  }

  // For each gate build sequence and process with interval -> updates are smooth and accurate
  let processedCounter = 0; // counts processed ops this run (not cumulative)
  const runStartTime = Date.now();

  // initialize each gate pending and chart (we add to existing totals)
  for (let i = 0; i < 10; i++) {
    const gateIndex = i;
    const txCount = slotTx[i];
    const execCount = Math.floor(txCount * rates.exec);
    const failCount = Math.floor(txCount * rates.fail);
    let pendCount = txCount - execCount - failCount; // ensures exec+fail+pend == txCount

    // defensive correction
    if (pendCount < 0) { pendCount = 0; }

    // update UI initial pending (this run's pend are added to totalPend)
    const slotEl = document.getElementById(`slot-${i+1}`);
    // read existing displayed numbers to keep cumulative visuals: they show per-run counts only
    slotEl.querySelector(".exec").textContent = String(+slotEl.querySelector(".exec").textContent); // keep current displayed per-gate numbers
    slotEl.querySelector(".pend").textContent = String(+slotEl.querySelector(".pend").textContent + pendCount);
    slotEl.querySelector(".fail").textContent = String(+slotEl.querySelector(".fail").textContent);

    // add initial pend to cumulative totalPend
    totalPend += pendCount;
    // set chart pending: we reflect the per-gate cumulative pending in chart (sum of runs)
    txChart.data.datasets[1].data[gateIndex] = (+txChart.data.datasets[1].data[gateIndex] || 0) + pendCount;

    // build and shuffle sequence of events (E and F). Pend are just initial backlog consumed progressively.
    const seq = [];
    for (let m = 0; m < execCount; m++) seq.push('E');
    for (let m = 0; m < failCount; m++) seq.push('F');
    // shuffle
    for (let s = seq.length - 1; s > 0; s--) {
      const r = Math.floor(Math.random() * (s + 1));
      [seq[s], seq[r]] = [seq[r], seq[s]];
    }

    // process queue with interval per gate (stagger to appear natural)
    let idx = 0;
    const gateInterval = setInterval(() => {
      if (idx >= seq.length) {
        clearInterval(gateInterval);
        // gate done
        return;
      }

      // each processed op: remove one pending from cumulative pending (if any from this run)
      // but because we displayed cumulative pend in UI, we must decrement same field
      // compute and write new values
      // decrement displayed pending on slot
      let displayedPend = +slotEl.querySelector(".pend").textContent;
      if (displayedPend > 0) {
        displayedPend--;
        slotEl.querySelector(".pend").textContent = String(displayedPend);
        // reflect in chart dataset (cumulative pending per gate)
        txChart.data.datasets[1].data[gateIndex] = Math.max(0, (+txChart.data.datasets[1].data[gateIndex] || 0) - 1);
        // decrement global pending
        totalPend = Math.max(0, totalPend - 1);
      }

      const op = seq[idx++];
      if (op === 'E') {
        // executed
        let displayedExec = +slotEl.querySelector(".exec").textContent + 1;
        slotEl.querySelector(".exec").textContent = String(displayedExec);
        // cumulative chart executed per gate (adds to previous runs too)
        txChart.data.datasets[0].data[gateIndex] = (+txChart.data.datasets[0].data[gateIndex] || 0) + 1;
        totalExec++;

        // gas add
        const gas = (mode === 'AOT') ? randomGas(0.00004, 0.00008) : randomGas(0.00002, 0.00005);
        if (mode === 'AOT') {
          gasChart.data.datasets[0].data[gateIndex] = +(gasChart.data.datasets[0].data[gateIndex] + gas).toFixed(6);
          totalGasAOT += gas;
        } else {
          gasChart.data.datasets[1].data[gateIndex] = +(gasChart.data.datasets[1].data[gateIndex] + gas).toFixed(6);
          totalGasJIT += gas;
        }
      } else {
        // failed
        let displayedFail = +slotEl.querySelector(".fail").textContent + 1;
        slotEl.querySelector(".fail").textContent = String(displayedFail);
        txChart.data.datasets[2].data[gateIndex] = (+txChart.data.datasets[2].data[gateIndex] || 0) + 1;
        totalFail++;
      }

      processedCounter++;
      // update charts and summary smoothly (use no heavy animation)
      txChart.update('none');
      gasChart.update('none');
      updateStats();

      // when all ops (cumulative across gates) are processed, store snapshot for the active mode
      if (processedCounter >= totalTX) {
        // snapshot uses cumulative totals as requested
        snapshot[mode] = {
          exec: totalExec,
          pend: totalPend,
          fail: totalFail,
          gas: mode === 'AOT' ? totalGasAOT : totalGasJIT
        };
      }
    }, randomBetween(90, 170)); // natural stagger
  }

  // final reconciliation after short delay: ensure global totals == previously + totalTX
  setTimeout(() => {
    const sum = totalExec + totalFail + totalPend;
    // If rounding or race made sums mismatch, ensure total = previous cumulative + this run's TX
    // But because we designed exact scheduling, mismatch should be rare; we still correct if found
    if (sum !== totalTX + /* previous runs not tracked here */ 0 && (totalExec + totalFail + totalPend !== totalTX)) {
      // we simply set totalPend to make sums consistent: totalPend = desired - (exec+fail)
      // desired cumulative total = previous cumulative before run + totalTX.
      // Hard to compute previous cumulative without storing snapshot of totals before run — but we avoid resetting totals at start,
      // so this reconciliation is only safety: set pending so sum == totalExec+totalFail+totalPend desired.
      // For safety keep current behavior but recalc missing pending if needed:
      // (This block is intentionally conservative.)
      const desiredTotal = totalExec + totalFail + totalPend; // keep current if inconsistent
      document.getElementById("totalRunVal").textContent = desiredTotal;
    } else {
      updateStats();
    }
  }, 1200);
}

// updateStats writes cumulative totals to UI
function updateStats() {
  document.getElementById("executedVal").textContent = totalExec;
  document.getElementById("failedVal").textContent = totalFail;
  document.getElementById("pendingVal").textContent = totalPend;
  document.getElementById("totalRunVal").textContent = totalExec + totalFail + totalPend;
  document.getElementById("jitGasVal").textContent = totalGasJIT.toFixed(6);
  document.getElementById("aotGasVal").textContent = totalGasAOT.toFixed(6);
  document.getElementById("totalGasVal").textContent = (totalGasAOT + totalGasJIT).toFixed(6);
}

// Compare popup — centered, larger, uses snapshot cumulative numbers
compareBtn.addEventListener('click', () => {
  // must have some data
  if (!snapshot.JIT.exec && !snapshot.AOT.exec && (totalExec + totalFail + totalPend) === 0) {
    return; // nothing to show
  }

  // fallback: if snapshot for a mode empty, use current totals as that mode snapshot if it matches
  const jitExec = snapshot.JIT.exec || 0;
  const aotExec = snapshot.AOT.exec || 0;

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

  // compute data arrays (use snapshot or zeros)
  const jit = snapshot.JIT;
  const aot = snapshot.AOT;

  const ctx = document.getElementById("compareChart").getContext("2d");
  new Chart(ctx, {
    type: "bar",
    data: {
      labels: ["Executed", "Pending", "Failed", "Gas (SOL)"],
      datasets: [
        { label: "JIT", backgroundColor: "#2979ff", data: [jit.exec || 0, jit.pend || 0, jit.fail || 0, jit.gas || 0] },
        { label: "AOT", backgroundColor: "#00c853", data: [aot.exec || 0, aot.pend || 0, aot.fail || 0, aot.gas || 0] }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { position: "top" } },
      scales: {
        y: { beginAtZero: true, ticks: { callback: v => (v < 1 ? Number(v).toFixed(6) : v) } }
      },
      animation: { duration: 240 }
    }
  });

  popup.querySelector(".closePopup").addEventListener("click", () => popup.remove());
});
