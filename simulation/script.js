// script.js — fixed redistribution, gas-mode isolation, compare summary
const slotsContainer = document.getElementById('slots');
const startBtn = document.getElementById('startBtn');
const resetBtn = document.getElementById('resetBtn');
const compareBtn = document.getElementById('compareBtn');
const comparePopup = document.getElementById('comparePopup');
const closeCompare = document.getElementById('closeCompare');
const txCountInput = document.getElementById('txCount');

let txChart, gasChart, compareChart;
let lastSlotPartition = []; // store partition used for last run

// create 10 slot elements
for (let i=1;i<=10;i++){
  const s = document.createElement('div');
  s.className = 'slot';
  s.id = `slot-${i}`;
  s.innerHTML = `<b>Slot ${i}</b>
    <div class="dots">
      <div class="dot green"></div>
      <div class="dot yellow"></div>
      <div class="dot red"></div>
    </div>
    <div class="slot-values"><span class="exec">0</span> / <span class="pend">0</span> / <span class="fail">0</span></div>`;
  slotsContainer.appendChild(s);
}

// Helper: partition integer total into n parts (random, sum exactly total)
function partitionInteger(total, n) {
  // produce n non-negative integers sum = total
  const cuts = new Set();
  while (cuts.size < n-1) cuts.add(Math.floor(Math.random() * (total+1)));
  const arr = [0, ...Array.from(cuts).sort((a,b)=>a-b), total];
  const parts = [];
  for (let i=1;i<arr.length;i++) parts.push(arr[i]-arr[i-1]);
  return parts;
}

// Helper: split slotCount into exec/pend/fail according to probabilities (ensure sum)
function splitSlot(slotCount, probs) {
  // probs = {execProb, pendProb, failProb} sum ~1
  if (slotCount === 0) return [0,0,0];
  let exec = Math.floor(slotCount * probs.execProb);
  let pend = Math.floor(slotCount * probs.pendProb);
  let fail = slotCount - exec - pend;
  // adjust if negative or leftover due to floor
  while (fail < 0) {
    if (exec>0) exec--; else if (pend>0) pend--;
    fail = slotCount - exec - pend;
  }
  // if leftover >0, add to exec
  while (exec+pend+fail < slotCount) exec++;
  return [exec, pend, fail];
}

// init charts
function initCharts(){
  const txCtx = document.getElementById('txChart').getContext('2d');
  txChart = new Chart(txCtx, {
    type: 'line',
    data: {
      labels: Array.from({length:10},(_,i)=>`Slot ${i+1}`),
      datasets: [
        { label: 'Executed', borderColor:'#00c853', data: [], fill:false, tension:0.25, pointRadius:3 },
        { label: 'Pending', borderColor:'#ffb300', data: [], fill:false, tension:0.25, pointRadius:3 },
        { label: 'Failed', borderColor:'#ff5252', data: [], fill:false, tension:0.25, pointRadius:3 }
      ]
    },
    options: {
      responsive:true, maintainAspectRatio:false,
      plugins:{ legend:{ display:false } },
      scales:{ y:{ beginAtZero:true } }
    }
  });

  const gasCtx = document.getElementById('gasChart').getContext('2d');
  gasChart = new Chart(gasCtx, {
    type: 'bar',
    data: {
      labels: Array.from({length:10},(_,i)=>`Slot ${i+1}`),
      datasets: [
        { label:'AOT Gas', backgroundColor:'#00c853', data:[] },
        { label:'JIT Gas', backgroundColor:'#2979ff', data:[] }
      ]
    },
    options: {
      responsive:true, maintainAspectRatio:false,
      scales:{ y:{ beginAtZero:true, ticks:{ callback: v => Number(v).toFixed(5) } } },
      plugins:{ legend:{ display:true } }
    }
  });
}
initCharts();

// main simulate function (uses partition to ensure sum equals txCount)
function simulate(mode, txCount, scenario){
  // partition txCount into 10 slots
  const slotCounts = partitionInteger(txCount, 10);
  lastSlotPartition = slotCounts.slice(); // store for compare
  // scenario tweak: adjust probabilities
  let baseExecProb = 0.80, basePendProb = 0.12;
  if (scenario === 'HighFee'){ baseExecProb += 0.05; basePendProb -= 0.03; }
  if (scenario === 'Congested'){ baseExecProb -= 0.08; basePendProb += 0.06; }

  // mode effect: AOT improves exec, reduces pend & fail
  const modeFactors = (mode==='AOT') ? { execBoost:0.08, pendReduce:0.06 } : { execBoost:0, pendReduce:0 };

  const execArr = [], pendArr = [], failArr = [], gasAOTArr = [], gasJITArr = [];
  let totalExec=0, totalPend=0, totalFail=0, sumAOTgas=0, sumJITgas=0;

  for (let i=0;i<10;i++){
    const slotN = slotCounts[i];
    let execProb = baseExecProb + modeFactors.execBoost;
    let pendProb = basePendProb - modeFactors.pendReduce;
    if (execProb < 0) execProb = 0.7;
    if (pendProb < 0) pendProb = 0.05;
    const failProb = 1 - execProb - pendProb;
    // normalize if negative
    const sumP = execProb + pendProb + failProb;
    execProb /= sumP; pendProb /= sumP;
    const [e,p,f] = splitSlot(slotN, { execProb, pendProb, failProb });
    execArr.push(e); pendArr.push(p); failArr.push(f);
    totalExec += e; totalPend += p; totalFail += f;

    // gas: ONLY produce gas for the selected mode
    let gA=0, gJ=0;
    if (mode === 'AOT'){
      gA = slotN>0 ? +(0.00003 + Math.random()*0.00003).toFixed(5) : 0;
    } else {
      gJ = slotN>0 ? +(0.00003 + Math.random()*0.00003).toFixed(5) : 0;
    }
    gasAOTArr.push(gA); gasJITArr.push(gJ);
    sumAOTgas += gA; sumJITgas += gJ;
  }

  return {
    slotCounts, execArr, pendArr, failArr,
    totals: { exec: totalExec, pend: totalPend, fail: totalFail },
    gas: { aot: +sumAOTgas.toFixed(5), jit: +sumJITgas.toFixed(5) },
    gasArr: { aot: gasAOTArr, jit: gasJITArr }
  };
}

// update UI with result (render into slots and charts)
function renderResult(result){
  // slots
  for (let i=0;i<10;i++){
    const s = document.getElementById(`slot-${i+1}`);
    s.querySelector('.exec').textContent = result.execArr[i];
    s.querySelector('.pend').textContent = result.pendArr[i];
    s.querySelector('.fail').textContent = result.failArr[i];
    const successRate = (result.execArr[i] / Math.max(1, result.slotCounts[i]));
    if (result.slotCounts[i]===0) s.style.backgroundColor = '#fff';
    else if (successRate > 0.85) s.style.backgroundColor = '#e8fdf0';
    else if (result.failArr[i] > result.pendArr[i]) s.style.backgroundColor = '#fff0f0';
    else s.style.backgroundColor = '#fff8e1';
  }

  // charts
  txChart.data.datasets[0].data = result.execArr;
  txChart.data.datasets[1].data = result.pendArr;
  txChart.data.datasets[2].data = result.failArr;
  txChart.update();

  gasChart.data.datasets[0].data = result.gasArr.aot;
  gasChart.data.datasets[1].data = result.gasArr.jit;
  gasChart.update();

  // stats
  document.getElementById('executedVal').textContent = result.totals.exec;
  document.getElementById('failedVal').textContent = result.totals.fail;
  document.getElementById('pendingVal').textContent = result.totals.pend;
  document.getElementById('jitGasVal').textContent = result.gas.jit.toFixed(5);
  document.getElementById('aotGasVal').textContent = result.gas.aot.toFixed(5);
  document.getElementById('totalGasVal').textContent = (result.gas.jit + result.gas.aot).toFixed(5);
}

// Start handler
startBtn.addEventListener('click', () => {
  const txCount = Math.max(1, Math.floor(Number(txCountInput.value) || 100));
  const mode = document.querySelector('input[name="mode"]:checked').value;
  const scenario = document.getElementById('scenario').value;

  const result = simulate(mode, txCount, scenario);
  // sanity check: totals must equal txCount
  const totalSum = result.totals.exec + result.totals.pend + result.totals.fail;
  if (totalSum !== txCount) {
    // adjust small rounding: put difference into executed
    const diff = txCount - totalSum;
    result.execArr[0] += diff;
    result.totals.exec += diff;
  }
  renderResult(result);
});

// Reset
resetBtn.addEventListener('click', () => {
  // reset slots
  for (let i=1;i<=10;i++){
    const s = document.getElementById(`slot-${i}`);
    s.querySelector('.exec').textContent = 0;
    s.querySelector('.pend').textContent = 0;
    s.querySelector('.fail').textContent = 0;
    s.style.backgroundColor = '#fff';
  }
  txChart.data.datasets.forEach(ds => ds.data = []);
  gasChart.data.datasets.forEach(ds => ds.data = []);
  txChart.update(); gasChart.update();
  document.getElementById('executedVal').textContent = 0;
  document.getElementById('failedVal').textContent = 0;
  document.getElementById('pendingVal').textContent = 0;
  document.getElementById('jitGasVal').textContent = '0.00000';
  document.getElementById('aotGasVal').textContent = '0.00000';
  document.getElementById('totalGasVal').textContent = '0.00000';
  lastSlotPartition = [];
});

// Compare button: generate two simulations using the same partition (for fairness)
compareBtn.addEventListener('click', () => {
  const txCount = Math.max(1, Math.floor(Number(txCountInput.value) || 100));
  // create a deterministic partition for comparison
  const partition = partitionInteger(txCount, 10);
  lastSlotPartition = partition.slice();

  // helper to simulate from partition (same partition used)
  function simulateFromPartition(mode, partitionArr, scenario){
    // reuse splitSlot logic but accept partition
    let baseExecProb = 0.80, basePendProb = 0.12;
    const scenarioVal = document.getElementById('scenario').value;
    if (scenarioVal === 'HighFee'){ baseExecProb += 0.05; basePendProb -= 0.03; }
    if (scenarioVal === 'Congested'){ baseExecProb -= 0.08; basePendProb += 0.06; }
    const modeFactors = (mode==='AOT') ? { execBoost:0.08, pendReduce:0.06 } : { execBoost:0, pendReduce:0 };

    const execArr=[], pendArr=[], failArr=[];
    let totalExec=0, totalPend=0, totalFail=0, sumAOT=0, sumJIT=0;
    const gasA=[], gasJ=[];

    for (let s=0;s<10;s++){
      const slotN = partitionArr[s];
      let execProb = baseExecProb + modeFactors.execBoost;
      let pendProb = basePendProb - modeFactors.pendReduce;
      if (execProb<0) execProb=0.7;
      if (pendProb<0) pendProb=0.05;
      const sumP = execProb + pendProb + (1-execProb-pendProb);
      execProb /= sumP; pendProb /= sumP;
      const [e,p,f] = splitSlot(slotN, { execProb, pendProb, failProb: 1-execProb-pendProb });
      execArr.push(e); pendArr.push(p); failArr.push(f);
      totalExec += e; totalPend += p; totalFail += f;

      let gA=0,gJ=0;
      if (mode==='AOT'){ gA = slotN>0 ? +(0.00003 + Math.random()*0.00003).toFixed(5) : 0; }
      else { gJ = slotN>0 ? +(0.00003 + Math.random()*0.00003).toFixed(5) : 0; }
      gasA.push(gA); gasJ.push(gJ);
      sumAOT += (gA||0); sumJIT += (gJ||0);
    }

    return {
      execArr, pendArr, failArr,
      totals: { exec: totalExec, pend: totalPend, fail: totalFail },
      gas: { aot: +sumAOT.toFixed(5), jit: +sumJIT.toFixed(5) },
      gasArr: { aot: gasA, jit: gasJ }
    };
  }

  // compute both
  const jitRes = simulateFromPartition('JIT', partition);
  const aotRes = simulateFromPartition('AOT', partition);

  // draw compare chart under popup
  if (compareChart) compareChart.destroy();
  const ctx = document.getElementById('compareChart').getContext('2d');
  compareChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: ['Executed','Failed','Pending','Total Gas'],
      datasets: [
        { label: 'JIT', backgroundColor:'#2979ff', data: [jitRes.totals.exec, jitRes.totals.fail, jitRes.totals.pend, jitRes.gas.jit] },
        { label: 'AOT', backgroundColor:'#00c853', data: [aotRes.totals.exec, aotRes.totals.fail, aotRes.totals.pend, aotRes.gas.aot] }
      ]
    },
    options: { responsive:true, maintainAspectRatio:false, scales:{ y:{ beginAtZero:true } } }
  });

  // summary lines: counts and performance improvement
  const reducePending = ((jitRes.totals.pend - aotRes.totals.pend) / Math.max(1,jitRes.totals.pend)) * 100 || 0;
  const reduceFailed = ((jitRes.totals.fail - aotRes.totals.fail) / Math.max(1,jitRes.totals.fail)) * 100 || 0;

  const summaryDiv = document.getElementById('compareSummary');
  summaryDiv.innerHTML = `
    <div style="text-align:left;padding:10px;">
      <strong>Số lượng (JIT / AOT):</strong><br/>
      Executed: ${jitRes.totals.exec} / ${aotRes.totals.exec}<br/>
      Failed: ${jitRes.totals.fail} / ${aotRes.totals.fail}<br/>
      Pending: ${jitRes.totals.pend} / ${aotRes.totals.pend}<br/>
      Total Gas (SOL): ${jitRes.gas.jit.toFixed(5)} / ${aotRes.gas.aot.toFixed(5)}
      <hr style="margin:8px 0;">
      <strong>Hiệu suất:</strong><br/>
      Pending giảm: ${reducePending.toFixed(1)}% | Failed giảm: ${reduceFailed.toFixed(1)}%
    </div>`;

  comparePopup.classList.remove('hidden');
});

// close compare
closeCompare.addEventListener('click', ()=> comparePopup.classList.add('hidden'));
