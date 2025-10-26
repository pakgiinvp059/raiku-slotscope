// === Raiku SlotScope — Final Stable Version (Fixed TX Flow, Accurate Totals, Deterministic Decay) ===

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

// === Create slots ===
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

// === Helpers ===
const rand = (min,max)=> Math.random()*(max-min)+min;
const randInt = (min,max)=> Math.floor(rand(min,max+1));
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
  const sum = base.exec + base.pend + base.fail;
  base.exec /= sum; base.pend /= sum; base.fail /= sum; // normalize
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
  cumulative = { JIT:{exec:0,pend:0,fail:0,gas:0}, AOT:{exec:0,pend:0,fail:0,gas:0} };
  document.querySelectorAll(".exec,.pend,.fail").forEach(el => el.textContent = "0");
  txChart.data.datasets.forEach(ds => ds.data = Array(10).fill(0));
  gasChart.data.datasets.forEach(ds => ds.data = Array(10).fill(0));
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
  const execArr = Array(10).fill(0);
  const pendArr = Array(10).fill(0);
  const failArr = Array(10).fill(0);
  const gasArr = Array(10).fill(0);

  // === Deterministic TX distribution ===
  let sumExec=0,sumPend=0,sumFail=0;
  for (let i=0;i<10;i++){
    const tx = perGate[i];
    const e = Math.round(tx * rates.exec);
    const f = Math.round(tx * rates.fail);
    const p = Math.max(0, tx - e - f);
    execArr[i]=e; pendArr[i]=p; failArr[i]=f;
    sumExec+=e; sumPend+=p; sumFail+=f;
  }

  // Adjust total to exact txCount
  let drift = (sumExec+sumPend+sumFail)-totalTX;
  while (drift!==0){
    for (let i=0;i<10 && drift!==0;i++){
      if (drift>0 && pendArr[i]>0){ pendArr[i]--; sumPend--; drift--; }
      else if (drift<0){ execArr[i]++; sumExec++; drift++; }
    }
  }

  // === Update UI for initial run ===
  for (let i=0;i<10;i++){
    const slot=document.getElementById(`slot-${i+1}`);
    slot.querySelector(".exec").textContent=execArr[i];
    slot.querySelector(".pend").textContent=pendArr[i];
    slot.querySelector(".fail").textContent=failArr[i];

    txChart.data.datasets[0].data[i]=execArr[i];
    txChart.data.datasets[1].data[i]=pendArr[i];
    txChart.data.datasets[2].data[i]=failArr[i];

    const gasUsed = +(gasForExec(mode)*execArr[i]).toFixed(6);
    if(mode==="AOT"){ gasChart.data.datasets[0].data[i]+=gasUsed; totalGasAOT+=gasUsed; cumulative.AOT.gas+=gasUsed; }
    else{ gasChart.data.datasets[1].data[i]+=gasUsed; totalGasJIT+=gasUsed; cumulative.JIT.gas+=gasUsed; }
    gasArr[i]=gasUsed;
  }

  totalExec+=sumExec; totalPend+=sumPend; totalFail+=sumFail;
  if(mode==="AOT"){ cumulative.AOT.exec+=sumExec; cumulative.AOT.pend+=sumPend; cumulative.AOT.fail+=sumFail; }
  else{ cumulative.JIT.exec+=sumExec; cumulative.JIT.pend+=sumPend; cumulative.JIT.fail+=sumFail; }

  txChart.update(); gasChart.update(); updateStats();

  // === Pending resolution (decay) ===
  const decayTicks = 5;
  let tick=0;
  const gasPer = gasForExec(mode);
  const interval=setInterval(()=>{
    tick++;
    const totalPendingNow = pendArr.reduce((a,b)=>a+b,0);
    if(totalPendingNow<=0 || tick>decayTicks){
      clearInterval(interval);
      running=false;
      startBtn.disabled=false;
      updateStats();
      return;
    }
    const convertTarget = Math.ceil(totalPendingNow*(1/decayTicks));
    for(let i=0;i<10 && totalPend>0;i++){
      const take = Math.min(pendArr[i], Math.round(convertTarget*(pendArr[i]/totalPendingNow)));
      pendArr[i]-=take;
      execArr[i]+=take;
      totalPend-=take; totalExec+=take;
      const gasAdd = +(gasPer*take).toFixed(6);
      if(mode==="AOT"){ gasChart.data.datasets[0].data[i]+=gasAdd; totalGasAOT+=gasAdd; cumulative.AOT.gas+=gasAdd; }
      else{ gasChart.data.datasets[1].data[i]+=gasAdd; totalGasJIT+=gasAdd; cumulative.JIT.gas+=gasAdd; }
    }
    txChart.data.datasets[0].data=[...execArr];
    txChart.data.datasets[1].data=[...pendArr];
    txChart.update(); gasChart.update(); updateStats();
  },1000);
};

// === Update Stats ===
function updateStats(){
  const total = totalExec + totalPend + totalFail;
  document.getElementById("executedVal").textContent = totalExec;
  document.getElementById("failedVal").textContent = totalFail;
  document.getElementById("pendingVal").textContent = totalPend;
  document.getElementById("totalRunVal").textContent = total;
  document.getElementById("jitGasVal").textContent = totalGasJIT.toFixed(6);
  document.getElementById("aotGasVal").textContent = totalGasAOT.toFixed(6);
  document.getElementById("totalGasVal").textContent = (totalGasAOT+totalGasJIT).toFixed(6);
}

// === Compare Popup ===
compareBtn.onclick = ()=>{
  if(cumulative.JIT.exec===0 && cumulative.AOT.exec===0){
    alert("Chưa có dữ liệu để so sánh — hãy chạy mô phỏng JIT hoặc AOT ít nhất một lần.");
    return;
  }
  document.querySelectorAll(".popup-compare").forEach(p=>p.remove());
  const popup=document.createElement("div");
  popup.className="popup-compare";
  popup.innerHTML=`
    <div class="popup-inner">
      <strong>📊 JIT vs AOT Comparison</strong>
      <canvas id="compareChart"></canvas>
      <p style="margin-top:8px;font-size:13px">Số liệu cộng dồn (mỗi lần bạn bấm Start). Reset sẽ xóa.</p>
      <button class="closePopup">OK</button>
    </div>`;
  document.body.appendChild(popup);

  const ctx=document.getElementById("compareChart").getContext("2d");
  new Chart(ctx,{
    type:"bar",
    data:{
      labels:["Executed","Pending","Failed","Avg Gas (SOL)"],
      datasets:[
        {label:"JIT",backgroundColor:"#2979ff",data:[
          cumulative.JIT.exec,
          cumulative.JIT.pend,
          cumulative.JIT.fail,
          cumulative.JIT.exec ? +(cumulative.JIT.gas/cumulative.JIT.exec).toFixed(6):0
        ]},
        {label:"AOT",backgroundColor:"#00c853",data:[
          cumulative.AOT.exec,
          cumulative.AOT.pend,
          cumulative.AOT.fail,
          cumulative.AOT.exec ? +(cumulative.AOT.gas/cumulative.AOT.exec).toFixed(6):0
        ]}
      ]
    },
    options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'top'}}}
  });
  popup.querySelector(".closePopup").onclick=()=>popup.remove();
};
