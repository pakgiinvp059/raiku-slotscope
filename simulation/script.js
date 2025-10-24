// script.js — persistent cumulative simulation with realistic pending + isolated gas

const slotsContainer = document.getElementById('slots');
const startBtn = document.getElementById('startBtn');
const resetBtn = document.getElementById('resetBtn');
const compareBtn = document.getElementById('compareBtn');
const txCountInput = document.getElementById('txCount');
const scenarioSelect = document.getElementById('scenario');

let txChart, gasChart, compareChart;

// cumulative totals (persist until reset)
let totalExec = 0, totalPend = 0, totalFail = 0;
let totalGasAOT = 0, totalGasJIT = 0;
let modeData = { JIT: [], AOT: [] };

// create 10 slot elements
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

// init charts (datasets start at zero)
function initCharts() {
  const txCtx = document.getElementById('txChart').getContext('2d');
  txChart = new Chart(txCtx, {
    type: 'bar',
    data: {
      labels: Array.from({ length: 10 }, (_, i) => `Slot ${i + 1}`),
      datasets: [
        { label: 'Executed', backgroundColor: '#22c55e', data: Array(10).fill(0) },
        { label: 'Pending',  backgroundColor: '#facc15', data: Array(10).fill(0) },
        { label: 'Failed',   backgroundColor: '#ef4444', data: Array(10).fill(0) }
      ]
    },
    options: { responsive: true, maintainAspectRatio: false, plugins:{ legend:{ position:'top' } }, scales:{ y:{ beginAtZero:true } } }
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
      responsive: true,
      maintainAspectRatio: false,
      scales: { y: { ticks: { callback: v => Number(v).toFixed(6) } } },
      plugins: { legend: { position: 'top' } }
    }
  });
}
initCharts();

// utilities
function formatGas(n){ return Number(n).toFixed(6); }
function rndGas(){ return +(0.00003 + Math.random()*0.00003).toFixed(6); } // 0.00003..0.00006
function partition(total){
  const per = Math.floor(total / 10);
  const rem = total % 10;
  return Array.from({length:10}, (_,i) => per + (i < rem ? 1 : 0));
}
function shuffle(a){ for (let i=a.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]] } return a; }

function scenarioRates(s){
  if (s === 'HighFee') return { exec:0.85, pend:0.10, fail:0.05 };
  if (s === 'Congested') return { exec:0.70, pend:0.22, fail:0.08 };
  return { exec:0.92, pend:0.06, fail:0.02 };
}

// update totals display
function updateTotalsDisplay(){
  document.getElementById('executedVal').innerText = totalExec;
  document.getElementById('failedVal').innerText = totalFail;
  document.getElementById('pendingVal').innerText = totalPend;
  document.getElementById('jitGasVal').innerText = formatGas(totalGasJIT);
  document.getElementById('aotGasVal').innerText = formatGas(totalGasAOT);
  document.getElementById('totalGasVal').innerText = formatGas(totalGasAOT + totalGasJIT);
}

// main: run simulation (with pending immediate + conversions over time)
function runSimulation(mode, totalTX, scenario) {
  const slots = partition(totalTX);
  const baseRates = scenarioRates(scenario);
  const modeAdj = mode === 'AOT' ? { exec:+0.05, pend:-0.03, fail:-0.02 } : { exec:0, pend:0, fail:0 };

  // per-run summary (for modeData)
  const runSummary = { exec:0, pend:0, fail:0, gasAOT:0, gasJIT:0 };

  // For each slot: compute targets and schedule conversions
  slots.forEach((base, i) => {
    // compute probabilities
    let execP = baseRates.exec + (modeAdj.exec || 0);
    let pendP = baseRates.pend + (modeAdj.pend || 0);
    let failP = 1 - execP - pendP;
    // normalize if necessary
    const sumP = execP + pendP + failP;
    execP /= sumP; pendP /= sumP; failP /= sumP;
    // ensure pend >= fail
    if (pendP < failP) { const d = (failP - pendP); pendP += d; execP = Math.max(0, 1 - pendP - failP); }

    // compute counts
    let execT = Math.round(base * execP);
    let pendT = Math.round(base * pendP);
    let failT = base - execT - pendT;
    // guard
    if (pendT < failT) {
      const need = failT - pendT;
      const mv = Math.min(need, execT);
      pendT += mv; execT -= mv; failT = base - execT - pendT;
    }
    let sum = execT + pendT + failT;
    if (sum !== base) execT += (base - sum); // small adjust

    // Increase pending immediately (both display and global)
    const slotEl = document.getElementById(`slot-${i+1}`);
    const curPend = parseInt(slotEl.querySelector('.pend').textContent || '0', 10);
    slotEl.querySelector('.pend').textContent = curPend + pendT;
    // Update chart pending cumulative
    txChart.data.datasets[1].data[i] += pendT;
    totalPend += pendT;
    runSummary.pend += pendT;

    // Prepare conversions list: execT times 'E', failT times 'F'
    const conversions = [];
    for (let k=0;k<execT;k++) conversions.push('E');
    for (let k=0;k<failT;k++) conversions.push('F');
    shuffle(conversions);

    // schedule conversions with small random delays to look realistic
    const slotStart = i * 120; // stagger slot starts
    conversions.forEach((outcome, idx) => {
      const delay = slotStart + idx * (25 + Math.random()*40);
      setTimeout(() => {
        // decrement displayed pending
        const el = document.getElementById(`slot-${i+1}`);
        const pendNow = Math.max(0, parseInt(el.querySelector('.pend').textContent || '0',10) - 1);
        el.querySelector('.pend').textContent = pendNow;

        if (outcome === 'E') {
          // executed: increment display and totals; add gas for mode
          const execNow = parseInt(el.querySelector('.exec').textContent || '0',10) + 1;
          el.querySelector('.exec').textContent = execNow;
          totalExec += 1; runSummary.exec += 1;
          const g = rndGas();
          if (mode === 'AOT') { totalGasAOT += g; runSummary.gasAOT += g; gasChart.data.datasets[0].data[i] += g; }
          else { totalGasJIT += g; runSummary.gasJIT += g; gasChart.data.datasets[1].data[i] += g; }
          // update charts (add 1 executed, remove 1 pending)
          txChart.data.datasets[0].data[i] += 1;
          txChart.data.datasets[1].data[i] = Math.max(0, txChart.data.datasets[1].data[i] - 1);
        } else {
          // failed
          const failNow = parseInt(el.querySelector('.fail').textContent || '0',10) + 1;
          el.querySelector('.fail').textContent = failNow;
          totalFail += 1; runSummary.fail += 1;
          txChart.data.datasets[2].data[i] += 1;
          txChart.data.datasets[1].data[i] = Math.max(0, txChart.data.datasets[1].data[i] - 1);
        }

        // after each conversion update charts and totals display
        txChart.update();
        gasChart.update();
        updateTotalsDisplay();
      }, delay);
    });
  });

  // save run summary (note: runSummary.exec/pending/fail are per-run counts, gas too)
  modeData[mode].push({
    exec: runSummary.exec,
    pend: runSummary.pend,
    fail: runSummary.fail,
    gasAOT: +runSummary.gasAOT.toFixed(6),
    gasJIT: +runSummary.gasJIT.toFixed(6)
  });

  // update charts and totals (pending already added)
  txChart.update();
  gasChart.update();
  updateTotalsDisplay();
}

// handlers
startBtn.addEventListener('click', () => {
  const mode = document.querySelector('input[name="mode"]:checked').value;
  const scenario = scenarioSelect.value;
  const totalTX = Math.max(1, parseInt(txCountInput.value) || 100);
  runSimulation(mode, totalTX, scenario);
});

resetBtn.addEventListener('click', () => {
  // reset totals & per-slot displays & charts & compare
  totalExec = totalPend = totalFail = 0;
  totalGasAOT = totalGasJIT = 0;
  modeData = { JIT: [], AOT: [] };

  for (let i=1;i<=10;i++){
    const s = document.getElementById(`slot-${i}`);
    s.querySelector('.exec').textContent = 0;
    s.querySelector('.pend').textContent = 0;
    s.querySelector('.fail').textContent = 0;
    txChart.data.datasets.forEach(ds => ds.data[i-1] = 0);
    gasChart.data.datasets.forEach(ds => ds.data[i-1] = 0);
  }
  txChart.update();
  gasChart.update();
  updateTotalsDisplay();

  // remove compare chart/info
  const old = document.getElementById('compareChart');
  if (old) old.remove();
  const info = document.querySelector('.compare-info');
  if (info) info.remove();
  if (compareChart){ try{ compareChart.destroy(); }catch(e){} compareChart=null; }
});

// compare
compareBtn.addEventListener('click', () => {
  // remove old compare canvas/info
  const old = document.getElementById('compareChart');
  if (old) old.remove();
  const oldInfo = document.querySelector('.compare-info');
  if (oldInfo) oldInfo.remove();
  if (compareChart) try{ compareChart.destroy(); }catch(e){}

  // averages across recorded runs for each mode
  const avg = (arr, key) => arr.length ? arr.reduce((a,b)=>a+b[key],0)/arr.length : 0;
  const j = modeData.JIT, a = modeData.AOT;
  const avgJ = { exec: avg(j,'exec'), pend: avg(j,'pend'), fail: avg(j,'fail'), gas: avg(j,'gasJIT') || avg(j,'gas') || 0 };
  const avgA = { exec: avg(a,'exec'), pend: avg(a,'pend'), fail: avg(a,'fail'), gas: avg(a,'gasAOT') || avg(a,'gas') || 0 };

  // canvas
  const c = document.createElement('canvas');
  c.id = 'compareChart';
  document.querySelector('.stats').after(c);

  compareChart = new Chart(c.getContext('2d'), {
    type: 'bar',
    data: {
      labels: ['Executed','Pending','Failed','Gas (SOL)'],
      datasets: [
        { label: 'JIT', backgroundColor:'#2979ff', data: [avgJ.exec, avgJ.pend, avgJ.fail, avgJ.gas] },
        { label: 'AOT', backgroundColor:'#00c853', data: [avgA.exec, avgA.pend, avgA.fail, avgA.gas] }
      ]
    },
    options: { responsive:true, maintainAspectRatio:false, plugins:{ legend:{ position:'top' } } }
  });

  // summary
  const pendImprove = avgJ.pend ? ((avgJ.pend - avgA.pend)/avgJ.pend*100).toFixed(1) : '0.0';
  const failImprove = avgJ.fail ? ((avgJ.fail - avgA.fail)/avgJ.fail*100).toFixed(1) : '0.0';
  const gasIncrease = avgJ.gas ? ((avgA.gas - avgJ.gas)/avgJ.gas*100).toFixed(1) : '0.0';

  const info = document.createElement('div');
  info.className = 'compare-info';
  info.innerHTML = `
    <p>💡 <strong>AOT</strong> reduces <strong>${pendImprove}%</strong> Pending and <strong>${failImprove}%</strong> Failed vs JIT (avg per-run).</p>
    <p>⚙️ Gas AOT increases ~ <strong>${gasIncrease}%</strong> vs JIT to achieve higher stability.</p>
  `;
  document.body.appendChild(info);
});
