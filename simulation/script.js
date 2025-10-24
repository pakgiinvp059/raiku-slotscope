// script.js — Realistic slot simulation with delay + proper gas handling + cumulative totals
const slotsContainer = document.getElementById('slots');
const startBtn = document.getElementById('startBtn');
const resetBtn = document.getElementById('resetBtn');
const compareBtn = document.getElementById('compareBtn');
const txCountInput = document.getElementById('txCount');
const scenarioSelect = document.getElementById('scenario');

let txChart, gasChart, compareChart;

// cumulative totals (persist across runs until Reset)
let totalExec = 0, totalPend = 0, totalFail = 0;
let totalGasAOT = 0, totalGasJIT = 0;
let runCount = 0;
let modeData = { JIT: [], AOT: [] }; // store per-run summaries for compare

// create 10 slot DOMs
for (let i = 1; i <= 10; i++) {
  const s = document.createElement('div');
  s.className = 'slot';
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

// Initialize charts
function initCharts() {
  const txCtx = document.getElementById('txChart').getContext('2d');
  txChart = new Chart(txCtx, {
    type: 'line',
    data: {
      labels: Array.from({ length: 10 }, (_, i) => `Slot ${i + 1}`),
      datasets: [
        { label: 'Executed', borderColor: '#22c55e', data: Array(10).fill(0), fill: false, tension: 0.25, pointRadius:3 },
        { label: 'Pending',  borderColor: '#facc15', data: Array(10).fill(0), fill: false, tension: 0.25, pointRadius:3 },
        { label: 'Failed',   borderColor: '#ef4444', data: Array(10).fill(0), fill: false, tension: 0.25, pointRadius:3 }
      ]
    },
    options: { responsive:true, maintainAspectRatio:false, plugins:{ legend:{ display:false } }, scales:{ y:{ beginAtZero:true } } }
  });

  const gasCtx = document.getElementById('gasChart').getContext('2d');
  gasChart = new Chart(gasCtx, {
    type: 'bar',
    data: {
      labels: Array.from({ length: 10 }, (_, i) => `Slot ${i + 1}`),
      datasets: [
        { label: 'AOT Gas', backgroundColor: '#00c853', data: Array(10).fill(0) },
        { label: 'JIT Gas', backgroundColor: '#2979ff', data: Array(10).fill(0) }
      ]
    },
    options: {
      responsive:true, maintainAspectRatio:false,
      scales:{ y:{ ticks:{ callback:(v)=>Number(v).toFixed(6) } } },
      plugins:{ legend:{ position:'top' } }
    }
  });
}
initCharts();

// Helpers
function partitionIntoSlots(total) {
  const per = Math.floor(total / 10);
  const rem = total % 10;
  return Array.from({length:10}, (_,i) => per + (i < rem ? 1 : 0));
}
function shuffleArray(a){
  for (let i = a.length-1; i>0; i--){
    const j = Math.floor(Math.random()*(i+1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
function formatGas(n){ return Number(n).toFixed(6); }
function rndGasPerTx(){ return +(0.00003 + Math.random()*0.00003).toFixed(6); } // 0.00003..0.00006

// scenario base probabilities (exec, pending, fail) before mode adjustments
function scenarioProbs(scenario){
  if (scenario === 'HighFee') return { exec: 0.85, pend: 0.10, fail: 0.05 };
  if (scenario === 'Congested') return { exec: 0.70, pend: 0.22, fail: 0.08 };
  return { exec: 0.92, pend: 0.06, fail: 0.02 }; // Normal
}

// mode adjustments: AOT improves execution/reduces pending/fail
function modeAdjust(mode){
  if (mode === 'AOT') return { execBoost: 0.07, pendReduce: 0.05, failReduce:0.02 };
  return { execBoost: 0, pendReduce: 0, failReduce: 0 };
}

// update displayed totals (DOM)
function updateTotalsDisplay(){
  document.getElementById("executedVal").innerText = totalExec;
  document.getElementById("failedVal").innerText = totalFail;
  document.getElementById("pendingVal").innerText = totalPend;
  document.getElementById("jitGasVal").innerText = formatGas(totalGasJIT);
  document.getElementById("aotGasVal").innerText = formatGas(totalGasAOT);
  document.getElementById("totalGasVal").innerText = formatGas(totalGasAOT + totalGasJIT);
}

// main run: uses animation to convert pending -> executed/failed, leaves some pending
async function runSimulation(mode, totalTX, scenario){
  // partition totalTX into 10 slots exact sum = totalTX
  const slots = partitionIntoSlots(totalTX);

  // compute per-slot target distributions
  const baseProbs = scenarioProbs(scenario);
  const adjust = modeAdjust(mode);
  const execArrTarget = [], pendArrTarget = [], failArrTarget = [];

  for (let i=0;i<10;i++){
    const base = slots[i];
    // apply adjustments
    let execP = baseProbs.exec + adjust.execBoost;
    let pendP = baseProbs.pend - adjust.pendReduce;
    let failP = 1 - execP - pendP;
    // normalize and ensure pend >= fail
    const s = execP + pendP + failP;
    execP/=s; pendP/=s; failP/=s;
    if (pendP < failP) { // enforce pending >= fail by shifting tiny epsilon from exec
      const diff = failP - pendP;
      pendP += diff + 0.01;
      execP = Math.max(0, 1 - pendP - failP);
    }
    // compute target counts (round reasonably)
    let execT = Math.round(base * execP);
    let pendT = Math.round(base * pendP);
    let failT = base - execT - pendT;
    // adjust if rounding caused pend < fail
    if (pendT < failT) {
      // move from exec to pend to ensure pend>=fail
      const need = failT - pendT;
      const move = Math.min(need, execT);
      pendT += move;
      execT -= move;
      failT = base - execT - pendT;
    }
    // final guard: adjust to sum exactly base
    let sum = execT + pendT + failT;
    if (sum !== base) {
      const diff = base - sum;
      execT += diff; // small adjust
    }
    // ensure non-negative
    execT = Math.max(0, execT);
    pendT = Math.max(0, pendT);
    failT = Math.max(0, failT);

    execArrTarget.push(execT);
    pendArrTarget.push(pendT);
    failArrTarget.push(failT);
  }

  // For cumulative logic:
  // We will add pendArrTarget to totalPend immediately (they remain pending until processed),
  // and then schedule conversions for (base - pendTarget) tx to become exec or fail over time.
  let runSummary = { exec:0, pend:0, fail:0, gasAOT:0, gasJIT:0 };

  // Increase pending totals immediately by the pending targets (persistent)
  const pendingSum = pendArrTarget.reduce((a,b)=>a+b,0);
  totalPend += pendingSum;
  runSummary.pend = pendingSum;
  updateTotalsDisplay();

  // Prepare processing per slot with delays
  const slotBaseDelay = 250; // ms between starting each slot processing
  const perTxDelay = 40;     // ms between each pending->result conversion

  for (let i=0;i<10;i++){
    // initial display: exec=0, pend=pendTarget, fail=0 for this run; but keep previous executed/pending shown in chart? We'll show current run values on chart (not cumulative)
    const slotEl = document.getElementById(`slot-${i+1}`);
    slotEl.querySelector('.exec').textContent = 0;
    slotEl.querySelector('.pend').textContent = pendArrTarget[i];
    slotEl.querySelector('.fail').textContent = 0;

    // update txChart to show per-slot current-run values (executed/pending/failed)
    txChart.data.datasets[0].data[i] = 0;
    txChart.data.datasets[1].data[i] = pendArrTarget[i];
    txChart.data.datasets[2].data[i] = 0;
    txChart.update();

    // prepare list of conversions that should happen now (convertCount = base - pendTarget)
    const base = partitionIntoSlots(totalTX)[i]; // recompute same partition (deterministic)
    const convertCount = base - pendArrTarget[i];
    const execTarget = execArrTarget[i];
    const failTarget = failArrTarget[i];

    // Build array of 'E' and 'F' of length convertCount with exact counts execTarget and failTarget
    const conversions = [];
    let eRemaining = execTarget;
    let fRemaining = failTarget;
    for (let k=0;k<convertCount;k++){
      if (eRemaining > 0) { conversions.push('E'); eRemaining--; }
      else { conversions.push('F'); fRemaining--; }
    }
    shuffleArray(conversions);

    // schedule conversions for this slot
    (function(slotIndex, conversionsArr){
      const startDelay = slotIndex * slotBaseDelay;
      for (let j=0;j<conversionsArr.length;j++){
        const outcome = conversionsArr[j];
        const timer = startDelay + j * perTxDelay;
        setTimeout(() => {
          // perform conversion: pending -> executed or failed
          // decrement global pending, increment respective global counters
          if (totalPend > 0) totalPend -= 1;
          if (outcome === 'E') {
            totalExec += 1;
            runSummary.exec += 1;
            // gas consumed only on executed tx
            const g = rndGasPerTx();
            if (mode === 'AOT') {
              totalGasAOT += g;
              runSummary.gasAOT += g;
              gasChart.data.datasets[0].data[slotIndex] = (gasChart.data.datasets[0].data[slotIndex] || 0) + g;
            } else {
              totalGasJIT += g;
              runSummary.gasJIT += g;
              gasChart.data.datasets[1].data[slotIndex] = (gasChart.data.datasets[1].data[slotIndex] || 0) + g;
            }
            // update slot display counts
            const el = document.getElementById(`slot-${slotIndex+1}`);
            const curExec = parseInt(el.querySelector('.exec').textContent || '0', 10);
            el.querySelector('.exec').textContent = curExec + 1;
          } else { // 'F'
            totalFail += 1;
            runSummary.fail += 1;
            const el = document.getElementById(`slot-${slotIndex+1}`);
            const curFail = parseInt(el.querySelector('.fail').textContent || '0', 10);
            el.querySelector('.fail').textContent = curFail + 1;
            // optionally small gas for failed? keep it zero for clarity
          }
          // decrement pending shown on slot
          const elPend = document.getElementById(`slot-${slotIndex+1}`).querySelector('.pend');
          const curPend = parseInt(elPend.textContent || '0', 10);
          elPend.textContent = Math.max(0, curPend - 1);

          // update charts live
          txChart.data.datasets[0].data[slotIndex] = parseInt(document.getElementById(`slot-${slotIndex+1}`).querySelector('.exec').textContent || '0',10);
          txChart.data.datasets[1].data[slotIndex] = parseInt(document.getElementById(`slot-${slotIndex+1}`).querySelector('.pend').textContent || '0',10);
          txChart.data.datasets[2].data[slotIndex] = parseInt(document.getElementById(`slot-${slotIndex+1}`).querySelector('.fail').textContent || '0',10);
          txChart.update();
          gasChart.update();
          updateTotalsDisplay();
        }, timer);
      }
    })(i, conversions);
  }

  // after scheduling all conversions, store run summary to modeData for compare
  runCount++;
  modeData[mode].push({
    exec: runSummary.exec,
    pend: runSummary.pend,
    fail: runSummary.fail,
    gasAOT: +(runSummary.gasAOT.toFixed(6)),
    gasJIT: +(runSummary.gasJIT.toFixed(6))
  });

  // ensure totals display updated (pending was added earlier)
  updateTotalsDisplay();
}

// Start button handler — triggers runSimulation with current selections
startBtn.addEventListener('click', () => {
  const mode = document.querySelector('input[name="mode"]:checked').value;
  const scenario = scenarioSelect.value;
  const totalTX = Math.max(1, parseInt(txCountInput.value) || 100);
  runSimulation(mode, totalTX, scenario);
});

// Reset clears everything
resetBtn.addEventListener('click', () => {
  totalExec = totalPend = totalFail = 0;
  totalGasAOT = totalGasJIT = 0;
  runCount = 0;
  modeData = { JIT: [], AOT: [] };
  // reset slot displays
  for (let i=1;i<=10;i++){
    const s = document.getElementById(`slot-${i}`);
    s.querySelector('.exec').textContent = 0;
    s.querySelector('.pend').textContent = 0;
    s.querySelector('.fail').textContent = 0;
  }
  // reset charts
  txChart.data.datasets.forEach(ds => ds.data = Array(10).fill(0));
  gasChart.data.datasets.forEach(ds => ds.data = Array(10).fill(0));
  txChart.update(); gasChart.update();
  // totals
  updateTotalsDisplay();
  // remove compare chart if exists
  if (compareChart) {
    try { compareChart.destroy(); } catch(e) {}
    compareChart = null;
  }
  // remove compare info if exists
  const oldInfo = document.querySelector('.compare-info');
  if (oldInfo) oldInfo.remove();
});

// Compare: show average JIT vs AOT (executed/pending/failed/gas) — drawn as bar chart
compareBtn.addEventListener('click', () => {
  function avg(arr, key){ return arr.length ? (arr.reduce((a,b)=>a+b[key],0)/arr.length) : 0; }
  const avgJ = { exec: avg(modeData.JIT,'exec'), pend: avg(modeData.JIT,'pend'), fail: avg(modeData.JIT,'fail'), gas: avg(modeData.JIT,'gasJIT') };
  const avgA = { exec: avg(modeData.AOT,'exec'), pend: avg(modeData.AOT,'pend'), fail: avg(modeData.AOT,'fail'), gas: avg(modeData.AOT,'gasAOT') };

  // remove old canvas/info
  const oldCanvas = document.getElementById('compareChart');
  if (oldCanvas) oldCanvas.remove();
  const oldInfo = document.querySelector('.compare-info');
  if (oldInfo) oldInfo.remove();

  // create canvas and insert after stats
  const ctxEl = document.createElement('canvas');
  ctxEl.id = 'compareChart';
  document.querySelector('.stats').after(ctxEl);

  compareChart = new Chart(ctxEl.getContext('2d'), {
    type: 'bar',
    data: {
      labels: ['Executed TX','Pending TX','Failed TX','Gas (SOL)'],
      datasets: [
        { label: 'JIT', backgroundColor:'#2979ff', data: [avgJ.exec, avgJ.pend, avgJ.fail, avgJ.gas] },
        { label: 'AOT', backgroundColor:'#00c853', data: [avgA.exec, avgA.pend, avgA.fail, avgA.gas] }
      ]
    },
    options: { responsive:true, maintainAspectRatio:false, plugins:{ legend:{ position:'top' } } }
  });

  // performance summary text
  const pendImprove = avgJ.pend ? ((avgJ.pend - avgA.pend)/avgJ.pend*100).toFixed(1) : '0.0';
  const failImprove = avgJ.fail ? ((avgJ.fail - avgA.fail)/avgJ.fail*100).toFixed(1) : '0.0';
  const gasIncrease = avgJ.gas ? ((avgA.gas - avgJ.gas)/avgJ.gas*100).toFixed(1) : '0.0';

  const info = document.createElement('div');
  info.className = 'compare-info';
  info.style.maxWidth = '85%';
  info.style.margin = '12px auto';
  info.style.fontSize = '14px';
  info.innerHTML = `
    <p>💡 <strong>AOT</strong> giảm <strong>${pendImprove}% Pending</strong> và <strong>${failImprove}% Failed</strong> so với JIT (trung bình các lần chạy).</p>
    <p>⚙️ <strong>Gas</strong> AOT tăng ~ <strong>${gasIncrease}%</strong> so với JIT để đổi lấy độ ổn định cao hơn.</p>
  `;
  document.body.appendChild(info);
});
