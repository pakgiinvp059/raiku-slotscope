// === Raiku SlotScope — Cumulative Charts + Accurate Totals ===

const slotsContainer = document.getElementById("slots");
const startBtn = document.getElementById("startBtn");
const resetBtn = document.getElementById("resetBtn");
const compareBtn = document.getElementById("compareBtn");
const txCountInput = document.getElementById("txCount");
const scenarioSelect = document.getElementById("scenario");

let txChart, gasChart;
let totalExec = 0, totalPend = 0, totalFail = 0;
let totalGasAOT = 0, totalGasJIT = 0;
let cumulative = { JIT: { exec:0, pend:0, fail:0, gas:0 }, AOT: { exec:0, pend:0, fail:0, gas:0 } };
let running = false;

// session-per-gate cumulative arrays (keep charts consistent with stats)
let sessionExec = Array(10).fill(0);
let sessionPend = Array(10).fill(0);
let sessionFail = Array(10).fill(0);
let sessionGasAOT = Array(10).fill(0);
let sessionGasJIT = Array(10).fill(0);

// === Create slots (UI boxes) ===
for (let i=1;i<=10;i++){
  const slot = document.createElement("div");
  slot.className = "slot";
  slot.id = `slot-${i}`;
  slot.innerHTML = `
    <b>Gate ${i}</b>
    <div class="dots"><div class="dot green"></div><div class="dot yellow"></div><div class="dot red"></div></div>
    <div><span class="exec">0</span> / <span class="pend">0</span> / <span class="fail">0</span></div>`;
  slotsContainer.appendChild(slot);
}

// === Init charts ===
function initCharts(){
  const txCtx = document.getElementById("txChart").getContext("2d");
  txChart = new Chart(txCtx, {
    type: "line",
    data: {
      labels: Array.from({length:10},(_,i)=>`Gate ${i+1}`),
      datasets: [
        { label: "Executed", borderColor:"#22c55e", backgroundColor:"rgba(34,197,94,0.08)", data:[...sessionExec], fill:true, pointRadius:3 },
        { label: "Pending", borderColor:"#facc15", backgroundColor:"rgba(250,204,21,0.06)", data:[...sessionPend], fill:true, pointRadius:3 },
        { label: "Failed", borderColor:"#ef4444", backgroundColor:"rgba(239,68,68,0.06)", data:[...sessionFail], fill:true, pointRadius:3 }
      ]
    },
    options:{
      responsive:true,
      maintainAspectRatio:false,
      plugins:{legend:{position:'top'}},
      scales:{
        y:{
          beginAtZero:true,
          ticks:{
            precision:0 // integer ticks for TX counts
          }
        }
      }
    }
  });

  const gasCtx = document.getElementById("gasChart").getContext("2d");
  gasChart = new Chart(gasCtx, {
    type:"bar",
    data:{
      labels: Array.from({length:10},(_,i)=>`Gate ${i+1}`),
      datasets:[
        { label: "AOT Gas", backgroundColor:"#00c853", data:[...sessionGasAOT] },
        { label: "JIT Gas", backgroundColor:"#2979ff", data:[...sessionGasJIT] }
      ]
    },
    options:{
      responsive:true,
      maintainAspectRatio:false,
      scales:{
        y:{
          beginAtZero:true,
          ticks:{
            callback: v => parseFloat(v).toFixed(6)
          }
        }
      },
      plugins:{legend:{position:'top'}}
    }
  });
}
initCharts();

// === Helpers ===
const rand = (min,max)=> Math.random()*(max-min)+min;
const distribute = (total, n=10)=>{
  const base = Math.floor(total/n);
  let rem = total - base*n;
  const arr = Array(n).fill(base);
  for (let i=0;i<rem;i++) arr[i % n]++;
  return arr;
};
function determineRates(scenario, mode){
  let base;
  if (scenario === "HighFee") base = {exec:0.82, pend:0.13, fail:0.05};
  else if (scenario === "Congested") base = {exec:0.75, pend:0.18, fail:0.07};
  else base = {exec:0.90, pend:0.07, fail:0.03};
  if (mode === "AOT"){
    base.exec = Math.min(base.exec + 0.05, 0.98);
    base.pend = Math.max(base.pend - 0.03, 0.01);
    base.fail = Math.max(base.fail - 0.02, 0.001);
  }
  // normalize so sum = 1 (guard vs rounding)
  const s = base.exec + base.pend + base.fail;
  base.exec/=s; base.pend/=s; base.fail/=s;
  return base;
}
function gasForExec(mode){
  return +(mode==="AOT"? rand(0.00004,0.00008): rand(0.00002,0.000045)).toFixed(6);
}

// === Reset ===
resetBtn.onclick = () => {
  if (running) return;
  totalExec = totalPend = totalFail = 0;
  totalGasAOT = totalGasJIT = 0;
  cumulative = { JIT: { exec:0, pend:0, fail:0, gas:0 }, AOT: { exec:0, pend:0, fail:0, gas:0 } };
  sessionExec = Array(10).fill(0);
  sessionPend = Array(10).fill(0);
  sessionFail = Array(10).fill(0);
  sessionGasAOT = Array(10).fill(0);
  sessionGasJIT = Array(10).fill(0);

  document.querySelectorAll(".exec,.pend,.fail").forEach(el => el.textContent = "0");
  txChart.data.datasets[0].data = [...sessionExec];
  txChart.data.datasets[1].data = [...sessionPend];
  txChart.data.datasets[2].data = [...sessionFail];
  gasChart.data.datasets[0].data = [...sessionGasAOT];
  gasChart.data.datasets[1].data = [...sessionGasJIT];
  txChart.update(); gasChart.update();
  updateStats();
  document.querySelectorAll(".popup-compare").forEach(p=>p.remove());
};

// === Start Simulation ===
startBtn.onclick = async () => {
  if (running) return;
  running = true;
  startBtn.disabled = true;

  const mode = document.querySelector('input[name="mode"]:checked').value;
  const scenario = scenarioSelect.value;
  let totalTX = Math.max(1, parseInt(txCountInput.value) || 100);

  const rates = determineRates(scenario, mode);
  const perGate = distribute(totalTX, 10);

  // compute deterministic counts per gate for this run
  const execArr = Array(10).fill(0);
  const pendArr = Array(10).fill(0);
  const failArr = Array(10).fill(0);

  let sExec=0, sPend=0, sFail=0;
  for (let i=0;i<10;i++){
    const tx = perGate[i];
    const e = Math.round(tx * rates.exec);
    const f = Math.round(tx * rates.fail);
    const p = Math.max(0, tx - e - f);
    execArr[i]=e; pendArr[i]=p; failArr[i]=f;
    sExec+=e; sPend+=p; sFail+=f;
  }

  // fix drift so sum equals totalTX
  let drift = (sExec+sPend+sFail) - totalTX;
  while (drift !== 0){
    if (drift > 0){
      // remove from pending first, then failed, then exec
      let removed=false;
      for (let pick of ['pend','fail','exec']){
        for (let j=0;j<10;j++){
          if (pick==='pend' && pendArr[j]>0){ pendArr[j]--; sPend--; drift--; removed=true; break; }
          if (pick==='fail' && failArr[j]>0){ failArr[j]--; sFail--; drift--; removed=true; break; }
          if (pick==='exec' && execArr[j]>0){ execArr[j]--; sExec--; drift--; removed=true; break; }
        }
        if (removed) break;
      }
    } else {
      // drift < 0 -> need to add to exec
      for (let j=0;j<10 && drift<0;j++){
        execArr[j]++; sExec++; drift++;
      }
    }
  }

  // Update UI boxes for this run (display last-run counts beside cumulative)
  for (let i=0;i<10;i++){
    const slot = document.getElementById(`slot-${i+1}`);
    // Show cumulative in the boxes (as you wanted consistent)
    sessionExec[i] += execArr[i];
    sessionPend[i] += pendArr[i];
    sessionFail[i] += failArr[i];

    slot.querySelector(".exec").textContent = sessionExec[i];
    slot.querySelector(".pend").textContent = sessionPend[i];
    slot.querySelector(".fail").textContent = sessionFail[i];

    // gas for this run (per-gate) and add to session gas arrays
    const gasUsed = +(gasForExec(mode) * execArr[i]).toFixed(6);
    if (mode === "AOT"){
      sessionGasAOT[i] = +( (sessionGasAOT[i] || 0) + gasUsed ).toFixed(6);
      totalGasAOT += gasUsed;
      cumulative.AOT.gas += gasUsed;
    } else {
      sessionGasJIT[i] = +( (sessionGasJIT[i] || 0) + gasUsed ).toFixed(6);
      totalGasJIT += gasUsed;
      cumulative.JIT.gas += gasUsed;
    }
  }

  // accumulate totals
  totalExec += sExec; totalPend += sPend; totalFail += sFail;
  if (mode === "AOT"){ cumulative.AOT.exec += sExec; cumulative.AOT.pend += sPend; cumulative.AOT.fail += sFail; }
  else { cumulative.JIT.exec += sExec; cumulative.JIT.pend += sPend; cumulative.JIT.fail += sFail; }

  // Update charts to reflect session (cumulative) arrays
  txChart.data.datasets[0].data = [...sessionExec];
  txChart.data.datasets[1].data = [...sessionPend];
  txChart.data.datasets[2].data = [...sessionFail];
  gasChart.data.datasets[0].data = [...sessionGasAOT];
  gasChart.data.datasets[1].data = [...sessionGasJIT];

  // Dynamically adjust y-axis max for txChart so proportions look natural
  const maxTx = Math.max(...sessionExec, ...sessionPend, ...sessionFail, 1);
  txChart.options.scales.y.suggestedMax = Math.ceil(maxTx * 1.15); // small headroom
  txChart.update();
  gasChart.update();
  updateStats();

  // Pending resolution (decay) — operate on session arrays and totals so charts remain consistent
  const decayTicks = 5;
  let tick = 0;
  const gasPerTick = gasForExec(mode); // approximate per-tick gas for conversions
  const interval = setInterval(()=>{
    tick++;
    const pendingNow = sessionPend.reduce((a,b)=>a+b,0);
    if (pendingNow <= 0 || tick > decayTicks){
      clearInterval(interval);
      running = false;
      startBtn.disabled = false;
      updateStats();
      return;
    }
    // convert a fraction of pending to exec deterministically
    const convertTarget = Math.ceil(pendingNow / (decayTicks - tick + 1));
    // distribute convert across gates proportionally
    const pendingPerGate = sessionPend.map(v=>v);
    const pendingSum = pendingPerGate.reduce((a,b)=>a+b,0) || 1;
    let convertedTotal = 0;
    for (let i=0;i<10;i++){
      if (sessionPend[i] <= 0) continue;
      const take = Math.min(sessionPend[i], Math.max(1, Math.round(convertTarget * (sessionPend[i]/pendingSum))));
      sessionPend[i] -= take;
      sessionExec[i] += take;
      convertedTotal += take;
      totalPend -= take;
      totalExec += take;
      // add gas for these newly executed tx
      const gasAdd = +(gasPerTick * take).toFixed(6);
      if (mode === "AOT"){
        sessionGasAOT[i] = +( (sessionGasAOT[i] || 0) + gasAdd ).toFixed(6);
        totalGasAOT += gasAdd;
        cumulative.AOT.gas += gasAdd;
      } else {
        sessionGasJIT[i] = +( (sessionGasJIT[i] || 0) + gasAdd ).toFixed(6);
        totalGasJIT += gasAdd;
        cumulative.JIT.gas += gasAdd;
      }
    }
    // if due to rounding nothing converted (rare), force convert 1 pending
    if (convertedTotal === 0 && pendingNow > 0){
      for (let i=0;i<10;i++){
        if (sessionPend[i] > 0){
          sessionPend[i]--; sessionExec[i]++; totalPend--; totalExec++;
          const gasAdd = +(gasPerTick).toFixed(6);
          if (mode === "AOT"){ sessionGasAOT[i] += gasAdd; totalGasAOT += gasAdd; cumulative.AOT.gas += gasAdd; }
          else { sessionGasJIT[i] += gasAdd; totalGasJIT += gasAdd; cumulative.JIT.gas += gasAdd; }
          break;
        }
      }
    }

    // sync UI boxes and charts
    for (let i=0;i<10;i++){
      const slot = document.getElementById(`slot-${i+1}`);
      slot.querySelector(".exec").textContent = sessionExec[i];
      slot.querySelector(".pend").textContent = sessionPend[i];
      slot.querySelector(".fail").textContent = sessionFail[i];
    }
    txChart.data.datasets[0].data = [...sessionExec];
    txChart.data.datasets[1].data = [...sessionPend];
    gasChart.data.datasets[0].data = [...sessionGasAOT];
    gasChart.data.datasets[1].data = [...sessionGasJIT];

    const maxTxNow = Math.max(...sessionExec, ...sessionPend, ...sessionFail, 1);
    txChart.options.scales.y.suggestedMax = Math.ceil(maxTxNow * 1.15);
    txChart.update(); gasChart.update(); updateStats();
  }, 900);
};

// === Update Stats UI ===
function updateStats(){
  const total = totalExec + totalPend + totalFail;
  document.getElementById("executedVal").textContent = totalExec;
  document.getElementById("failedVal").textContent = totalFail;
  document.getElementById("pendingVal").textContent = totalPend;
  document.getElementById("totalRunVal").textContent = total;
  document.getElementById("jitGasVal").textContent = totalGasJIT.toFixed(6);
  document.getElementById("aotGasVal").textContent = totalGasAOT.toFixed(6);
  document.getElementById("totalGasVal").textContent = (totalGasAOT + totalGasJIT).toFixed(6);
}

// === Compare Popup (unchanged semantics, uses cumulative) ===
compareBtn.onclick = () => {
  if (cumulative.JIT.exec === 0 && cumulative.AOT.exec === 0){
    alert("Chưa có dữ liệu để so sánh — hãy chạy mô phỏng JIT hoặc AOT ít nhất một lần.");
    return;
  }
  document.querySelectorAll(".popup-compare").forEach(p=>p.remove());
  const popup = document.createElement("div");
  popup.className = "popup-compare";
  popup.innerHTML = `
    <div class="popup-inner">
      <strong>📊 JIT vs AOT Comparison</strong>
      <canvas id="compareChart"></canvas>
      <p style="margin-top:8px;font-size:13px">Số liệu cộng dồn (mỗi lần bạn bấm Start). Reset sẽ xóa.</p>
      <button class="closePopup">OK</button>
    </div>`;
  document.body.appendChild(popup);

  const ctx = document.getElementById("compareChart").getContext("2d");
  new Chart(ctx, {
    type: "bar",
    data: {
      labels: ["Executed","Pending","Failed","Avg Gas (SOL)"],
      datasets: [
        {
          label: "JIT",
          backgroundColor: "#2979ff",
          data: [
            cumulative.JIT.exec,
            cumulative.JIT.pend,
            cumulative.JIT.fail,
            cumulative.JIT.exec ? +(cumulative.JIT.gas / cumulative.JIT.exec).toFixed(6) : 0
          ]
        },
        {
          label: "AOT",
          backgroundColor: "#00c853",
          data: [
            cumulative.AOT.exec,
            cumulative.AOT.pend,
            cumulative.AOT.fail,
            cumulative.AOT.exec ? +(cumulative.AOT.gas / cumulative.AOT.exec).toFixed(6) : 0
          ]
        }
      ]
    },
    options: { responsive:true, maintainAspectRatio:false, plugins:{legend:{position:'top'}} }
  });

  popup.querySelector(".closePopup").onclick = () => popup.remove();
};
