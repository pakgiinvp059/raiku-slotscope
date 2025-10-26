// === Raiku SlotScope — Stable Simulation (fixed totals, pending, compare) ===

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

// create gates
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

// init charts
function initCharts(){
  const txCtx = document.getElementById("txChart").getContext("2d");
  txChart = new Chart(txCtx, {
    type: "line",
    data: {
      labels: Array.from({length:10},(_,i)=>`Gate ${i+1}`),
      datasets: [
        { label: "Executed", borderColor:"#22c55e", backgroundColor:"rgba(34,197,94,0.08)", data:Array(10).fill(0), fill:true, pointRadius:3 },
        { label: "Pending", borderColor:"#facc15", backgroundColor:"rgba(250,204,21,0.06)", data:Array(10).fill(0), fill:true, pointRadius:3 },
        { label: "Failed", borderColor:"#ef4444", backgroundColor:"rgba(239,68,68,0.06)", data:Array(10).fill(0), fill:true, pointRadius:3 }
      ]
    },
    options:{ responsive:true, maintainAspectRatio:false, plugins:{legend:{position:'top'}}}
  });

  const gasCtx = document.getElementById("gasChart").getContext("2d");
  gasChart = new Chart(gasCtx, {
    type:"bar",
    data:{
      labels: Array.from({length:10},(_,i)=>`Gate ${i+1}`),
      datasets:[
        { label: "AOT Gas", backgroundColor:"#00c853", data:Array(10).fill(0) },
        { label: "JIT Gas", backgroundColor:"#2979ff", data:Array(10).fill(0) }
      ]
    },
    options:{ responsive:true, maintainAspectRatio:false, scales:{ y:{ ticks:{ callback: v => parseFloat(v).toFixed(6) } } } }
  });
}
initCharts();

// helpers
const rand = (min,max)=> Math.random()*(max-min)+min;
const randInt = (min,max)=> Math.floor(rand(min,max+1));
function distribute(total, n=10){
  const base = Math.floor(total/n);
  let rem = total - base*n;
  const arr = Array(n).fill(base);
  // distribute remainder randomly but controlled so final sum=total
  for (let i=0;i<rem;i++){
    arr[i % n] += 1; // deterministic distribution to keep plausible uniformity
  }
  return arr;
}

function determineRates(scenario, mode){
  // base rates depend on scenario
  let base;
  if (scenario === "HighFee") base = {exec:0.82, pend:0.13, fail:0.05};
  else if (scenario === "Congested") base = {exec:0.75, pend:0.18, fail:0.07};
  else base = {exec:0.90, pend:0.07, fail:0.03}; // Normal
  // adjust for AOT: higher exec, lower pend/fail
  if (mode === "AOT"){
    base.exec = Math.min(base.exec + 0.05, 0.98);
    base.pend = Math.max(base.pend - 0.03, 0.01);
    base.fail = Math.max(base.fail - 0.02, 0.001);
  }
  // ensure pend >= fail
  if (base.pend < base.fail){
    const diff = base.fail - base.pend;
    base.pend += diff;
    base.exec = Math.max(base.exec - diff, 0.01);
  }
  return base;
}

function gasForExec(mode){
  // AOT cost slightly higher than JIT (but small)
  if (mode === "AOT") return +(rand(0.00004,0.00008)).toFixed(6);
  return +(rand(0.00002,0.000045)).toFixed(6);
}

// reset
resetBtn.onclick = () => {
  if (running) return;
  totalExec = totalPend = totalFail = 0;
  totalGasAOT = totalGasJIT = 0;
  cumulative = { JIT:{exec:0,pend:0,fail:0,gas:0}, AOT:{exec:0,pend:0,fail:0,gas:0} };
  // reset UI numbers
  document.querySelectorAll(".exec,.pend,.fail").forEach(el => el.textContent = "0");
  txChart.data.datasets.forEach(ds => ds.data = Array(10).fill(0));
  gasChart.data.datasets.forEach(ds => ds.data = Array(10).fill(0));
  txChart.update(); gasChart.update();
  updateStats();
  // remove any compare popup if open
  document.querySelectorAll(".popup-compare").forEach(p=>p.remove());
};

// start simulation
startBtn.onclick = async () => {
  if (running) return;
  running = true;
  startBtn.disabled = true;

  const mode = document.querySelector('input[name="mode"]:checked').value;
  const scenario = scenarioSelect.value;
  let totalTX = parseInt(txCountInput.value) || 100;
  if (totalTX <= 0) totalTX = 100;

  // determine rates based on scenario & mode
  const rates = determineRates(scenario, mode);

  // distribute TX across 10 gates ensuring exact sum = totalTX
  const perGate = distribute(totalTX, 10);

  // reset temporary per-run counters for charts (we append to cumulative)
  const execArr = Array(10).fill(0);
  const pendArr = Array(10).fill(0);
  const failArr = Array(10).fill(0);
  const gasA = Array(10).fill(0);
  const gasJ = Array(10).fill(0);

  // compute counts per gate deterministically (rounding and last-gate correction)
  let sumExec = 0, sumPend = 0, sumFail = 0;
  for (let i=0;i<10;i++){
    const tx = perGate[i];
    let e = Math.round(tx * rates.exec);
    let f = Math.round(tx * rates.fail);
    let p = tx - e - f;
    // safety: if rounding produced negative pending, adjust
    if (p < 0){
      const diff = -p;
      e = Math.max(e - diff, 0);
      p = tx - e - f;
    }
    execArr[i] = e;
    pendArr[i] = p;
    failArr[i] = f;
    sumExec += e; sumPend += p; sumFail += f;
  }
  // correct possible rounding drift so sums equal totalTX
  let drift = (sumExec + sumPend + sumFail) - totalTX;
  // if positive -> remove from pending/executed; if negative -> add to executed
  let idx = 0;
  while (drift !== 0){
    if (drift > 0){
      // remove 1 from the largest group (prefer pending then failed then exec)
      let removed = false;
      for (let pick of [1,2,0]){ // 1=pending index,2=fail,0=exec
        for (let j=0;j<10;j++){
          if (pick===1 && pendArr[j]>0){ pendArr[j]--; sumPend--; drift--; removed=true; break; }
          if (pick===2 && failArr[j]>0){ failArr[j]--; sumFail--; drift--; removed=true; break; }
          if (pick===0 && execArr[j]>0){ execArr[j]--; sumExec--; drift--; removed=true; break; }
        }
        if (removed) break;
      }
    } else {
      // drift < 0: need to add to executed (prefer small gates first)
      for (let j=0;j<10 && drift<0;j++){
        execArr[j]++; sumExec++; drift++;
      }
    }
  }

  // apply per-gate values to UI and compute gas for executed
  for (let i=0;i<10;i++){
    const slot = document.getElementById(`slot-${i+1}`);
    slot.querySelector(".exec").textContent = execArr[i];
    slot.querySelector(".pend").textContent = pendArr[i];
    slot.querySelector(".fail").textContent = failArr[i];

    txChart.data.datasets[0].data[i] = execArr[i];
    txChart.data.datasets[1].data[i] = pendArr[i];
    txChart.data.datasets[2].data[i] = failArr[i];

    // gas accumulation per executed (mode-specific)
    const g = execArr[i];
    if (mode === "AOT"){
      let gasPer = gasForExec("AOT");
      const totalGas = +(gasPer * g).toFixed(6);
      gasChart.data.datasets[0].data[i] = +( (gasChart.data.datasets[0].data[i] || 0) + totalGas ).toFixed(6);
      totalGasAOT += totalGas;
      cumulative.AOT.gas += totalGas;
    } else {
      let gasPer = gasForExec("JIT");
      const totalGas = +(gasPer * g).toFixed(6);
      gasChart.data.datasets[1].data[i] = +( (gasChart.data.datasets[1].data[i] || 0) + totalGas ).toFixed(6);
      totalGasJIT += totalGas;
      cumulative.JIT.gas += totalGas;
    }

    // accumulate totals
    totalExec += execArr[i];
    totalPend += pendArr[i];
    totalFail += failArr[i];

    if (mode === "AOT"){
      cumulative.AOT.exec += execArr[i];
      cumulative.AOT.pend += pendArr[i];
      cumulative.AOT.fail += failArr[i];
    } else {
      cumulative.JIT.exec += execArr[i];
      cumulative.JIT.pend += pendArr[i];
      cumulative.JIT.fail += failArr[i];
    }
  }

  txChart.update();
  gasChart.update();
  updateStats();

  // Simulate pending resolution over time (convert pending -> exec gradually)
  // Make it realistic: fraction decays each tick; pending always > failed (we keep that invariant)
  const decayTicks = 6;
  let tick = 0;
  const decayInterval = setInterval(()=>{
    tick++;
    if (totalPend <= 0 || tick > decayTicks){
      clearInterval(decayInterval);
      running = false;
      startBtn.disabled = false;
      return;
    }
    // each tick convert certain fraction of pending to exec (e.g., 20% per tick)
    const convert = Math.max(1, Math.floor(totalPend * 0.18));
    // distribute convert over gates proportionally to pending counts
    const pendingPerGate = txChart.data.datasets[1].data.map(v=>Math.round(v));
    const pendingSum = pendingPerGate.reduce((a,b)=>a+b,0) || 1;
    for (let i=0;i<10;i++){
      if (pendingPerGate[i] <= 0) continue;
      const take = Math.min(pendingPerGate[i], Math.max(1, Math.round(convert * (pendingPerGate[i]/pendingSum))));
      txChart.data.datasets[1].data[i] = Math.max(0, txChart.data.datasets[1].data[i] - take);
      txChart.data.datasets[0].data[i] = txChart.data.datasets[0].data[i] + take;
      totalPend -= take;
      totalExec += take;
      // accumulate gas for new executed tx (use JIT/AOT logic)
      const gasPer = ( (document.querySelector('input[name="mode"]:checked').value === "AOT") ? gasForExec("AOT") : gasForExec("JIT") );
      const gasAdd = +(gasPer * take).toFixed(6);
      if (document.querySelector('input[name="mode"]:checked').value === "AOT"){
        gasChart.data.datasets[0].data[i] = +( (gasChart.data.datasets[0].data[i] || 0) + gasAdd ).toFixed(6);
        totalGasAOT += gasAdd;
        cumulative.AOT.gas += gasAdd;
      } else {
        gasChart.data.datasets[1].data[i] = +( (gasChart.data.datasets[1].data[i] || 0) + gasAdd ).toFixed(6);
        totalGasJIT += gasAdd;
        cumulative.JIT.gas += gasAdd;
      }
    }
    txChart.update();
    gasChart.update();
    updateStats();
  }, 900);
};

// update stats UI
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

// compare popup (uses cumulative data)
compareBtn.onclick = () => {
  // Show popup only if there's any cumulative data
  if (cumulative.JIT.exec === 0 && cumulative.AOT.exec === 0){
    // small feedback: nothing to compare
    alert("Chưa có dữ liệu để so sánh — hãy chạy JIT hoặc AOT ít nhất một lần.");
    return;
  }

  // ensure only one popup
  document.querySelectorAll(".popup-compare").forEach(p=>p.remove());

  const popup = document.createElement("div");
  popup.className = "popup-compare";
  popup.innerHTML = `
    <div class="popup-inner">
      <strong>📊 JIT vs AOT Comparison</strong>
      <canvas id="compareChart"></canvas>
      <p style="margin-top:8px;font-size:13px">Số liệu cộng dồn (khi bạn bấm Start nhiều lần). Reset sẽ xóa.</p>
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
    options: {
      responsive:true,
      maintainAspectRatio:false,
      plugins:{legend:{position:'top'}}
    }
  });

  popup.querySelector(".closePopup").onclick = () => popup.remove();
};
