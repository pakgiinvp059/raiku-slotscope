// === Raiku SlotScope Fixed Simulation ===

const slotsContainer = document.getElementById("slots");
const startBtn = document.getElementById("startBtn");
const resetBtn = document.getElementById("resetBtn");
const compareBtn = document.getElementById("compareBtn");
const txCountInput = document.getElementById("txCount");
const scenarioSelect = document.getElementById("scenario");

let txChart, gasChart;
let totalExec = 0, totalPend = 0, totalFail = 0;
let totalGasAOT = 0, totalGasJIT = 0;
let cumulative = {
  JIT: { exec: 0, pend: 0, fail: 0, gas: 0 },
  AOT: { exec: 0, pend: 0, fail: 0, gas: 0 }
};
let running = false;

// === Create 10 Gates ===
for (let i = 1; i <= 10; i++) {
  const slot = document.createElement("div");
  slot.className = "slot";
  slot.id = `slot-${i}`;
  slot.innerHTML = `
    <b>Gate ${i}</b>
    <div class="dots"><div class="dot green"></div><div class="dot yellow"></div><div class="dot red"></div></div>
    <div><span class="exec">0</span> / <span class="pend">0</span> / <span class="fail">0</span></div>`;
  slotsContainer.appendChild(slot);
}

// === Chart Initialization ===
function initCharts() {
  const txCtx = document.getElementById("txChart").getContext("2d");
  txChart = new Chart(txCtx, {
    type: "line",
    data: {
      labels: Array.from({length:10}, (_,i)=>`Gate ${i+1}`),
      datasets: [
        { label:"Executed", borderColor:"#22c55e", data:Array(10).fill(0), tension:0.3, fill:true },
        { label:"Pending", borderColor:"#facc15", data:Array(10).fill(0), tension:0.3 },
        { label:"Failed", borderColor:"#ef4444", data:Array(10).fill(0), tension:0.3 }
      ]
    },
    options:{responsive:true,maintainAspectRatio:false}
  });

  const gasCtx = document.getElementById("gasChart").getContext("2d");
  gasChart = new Chart(gasCtx, {
    type: "bar",
    data: {
      labels: Array.from({length:10}, (_,i)=>`Gate ${i+1}`),
      datasets: [
        { label:"AOT Gas", backgroundColor:"#00c853", data:Array(10).fill(0) },
        { label:"JIT Gas", backgroundColor:"#2979ff", data:Array(10).fill(0) }
      ]
    },
    options:{responsive:true,maintainAspectRatio:false}
  });
}
initCharts();

// === Helpers ===
const rand = (min,max)=>Math.random()*(max-min)+min;
function distributeTX(total,gates=10){
  const base=Math.floor(total/gates);
  let rem=total%gates;
  const arr=Array(gates).fill(base);
  while(rem>0){arr[Math.floor(Math.random()*gates)]++;rem--;}
  return arr;
}
function getRates(scenario,mode){
  const base={
    Normal:{exec:0.93,pend:0.05,fail:0.02},
    HighFee:{exec:0.88,pend:0.09,fail:0.03},
    Congested:{exec:0.82,pend:0.12,fail:0.06}
  }[scenario];
  return mode==="AOT"
    ?{exec:Math.min(base.exec+0.03,0.99),pend:Math.max(base.pend-0.02,0.01),fail:Math.max(base.fail-0.01,0.005)}
    :base;
}
function gas(mode){return +(mode==="AOT"?rand(0.00004,0.00007):rand(0.00002,0.00004)).toFixed(6);}

// === Reset ===
resetBtn.onclick=()=>{
  if(running)return;
  totalExec=totalPend=totalFail=totalGasAOT=totalGasJIT=0;
  cumulative={JIT:{exec:0,pend:0,fail:0,gas:0},AOT:{exec:0,pend:0,fail:0,gas:0}};
  document.querySelectorAll(".exec,.pend,.fail").forEach(el=>el.textContent="0");
  txChart.data.datasets.forEach(d=>d.data.fill(0));
  gasChart.data.datasets.forEach(d=>d.data.fill(0));
  updateStats();txChart.update();gasChart.update();
};

// === Start Simulation ===
startBtn.onclick=async()=>{
  if(running)return;running=true;startBtn.disabled=true;
  const mode=document.querySelector('input[name="mode"]:checked').value;
  const scenario=scenarioSelect.value;
  const totalTX=parseInt(txCountInput.value)||100;
  const gates=distributeTX(totalTX,10);
  const rates=getRates(scenario,mode);

  totalPend+=totalTX; cumulative[mode].pend+=totalTX;
  for(let g=0;g<10;g++){
    const slot=document.getElementById(`slot-${g+1}`);
    slot.querySelector(".pend").textContent=gates[g];
    txChart.data.datasets[1].data[g]=gates[g];
  }
  updateStats();txChart.update();

  let processed=0;
  for(let g=0;g<10;g++){
    for(let i=0;i<gates[g];i++){
      setTimeout(()=>{
        const chance=Math.random();
        totalPend--; txChart.data.datasets[1].data[g]--;
        const slot=document.getElementById(`slot-${g+1}`);
        if(chance<rates.exec){
          totalExec++; cumulative[mode].exec++;
          txChart.data.datasets[0].data[g]++;
          slot.querySelector(".exec").textContent=+slot.querySelector(".exec").textContent+1;
          const gval=gas(mode);
          if(mode==="AOT"){totalGasAOT+=gval; cumulative[mode].gas+=gval; gasChart.data.datasets[0].data[g]+=gval;}
          else{totalGasJIT+=gval; cumulative[mode].gas+=gval; gasChart.data.datasets[1].data[g]+=gval;}
        }else if(chance<rates.exec+rates.fail){
          totalFail++; cumulative[mode].fail++;
          txChart.data.datasets[2].data[g]++;
          slot.querySelector(".fail").textContent=+slot.querySelector(".fail").textContent+1;
        }else{
          totalPend++; // re-pending nhỏ
        }
        processed++;
        if(processed===totalTX){updateStats();txChart.update();gasChart.update();running=false;startBtn.disabled=false;}
        updateStats();
      },rand(200,800)*(i/5));
    }
  }
};

// === Update Stats ===
function updateStats(){
  document.getElementById("executedVal").textContent=totalExec;
  document.getElementById("failedVal").textContent=totalFail;
  document.getElementById("pendingVal").textContent=totalPend;
  document.getElementById("totalRunVal").textContent=totalExec+totalFail+totalPend;
  document.getElementById("jitGasVal").textContent=totalGasJIT.toFixed(6);
  document.getElementById("aotGasVal").textContent=totalGasAOT.toFixed(6);
  document.getElementById("totalGasVal").textContent=(totalGasAOT+totalGasJIT).toFixed(6);
}

// === Compare Popup ===
compareBtn.onclick=()=>{
  const popup=document.createElement("div");
  popup.className="popup-compare";
  popup.innerHTML=`
    <div class="popup-inner">
      <strong>📊 JIT vs AOT Comparison</strong>
      <canvas id="compareChart"></canvas>
      <p>AOT ổn định hơn trong môi trường tắc nghẽn, gas cao hơn nhẹ.</p>
      <button class="closePopup">OK</button>
    </div>`;
  document.body.appendChild(popup);
  const ctx=document.getElementById("compareChart").getContext("2d");
  new Chart(ctx,{
    type:"bar",
    data:{
      labels:["Executed","Pending","Failed","Gas (SOL)"],
      datasets:[
        {label:"JIT",backgroundColor:"#2979ff",data:[cumulative.JIT.exec,cumulative.JIT.pend,cumulative.JIT.fail,cumulative.JIT.gas]},
        {label:"AOT",backgroundColor:"#00c853",data:[cumulative.AOT.exec,cumulative.AOT.pend,cumulative.AOT.fail,cumulative.AOT.gas]}
      ]
    },
    options:{responsive:true,maintainAspectRatio:false}
  });
  popup.querySelector(".closePopup").onclick=()=>popup.remove();
};
