let slots = [];
let txChart;
const log = document.getElementById("log");
const txCountInput = document.getElementById("txCount");
const modeAot = document.getElementById("modeAot");
const aotInfo = document.getElementById("aotInfo");
const scenario = document.getElementById("scenario");

function addLog(msg) {
  log.innerHTML = `[${new Date().toLocaleTimeString()}] ${msg}<br>` + log.innerHTML;
}

function initSlots() {
  const timeline = document.getElementById("timeline");
  timeline.innerHTML = "";
  slots = [];
  for (let i = 1; i <= 10; i++) {
    const el = document.createElement("div");
    el.className = "slot";
    el.innerHTML = `
      <div>Slot ${i}</div>
      <div class="stats">
        <span class="badge exec" id="slot-${i}-exec">0</span>
        <span class="badge pending" id="slot-${i}-pend">0</span>
        <span class="badge fail" id="slot-${i}-fail">0</span>
      </div>`;
    timeline.appendChild(el);
    slots.push({ id: i, el, exec: 0, pend: 0, fail: 0 });
  }
}

function initChart() {
  const ctx = document.getElementById("txChart").getContext("2d");
  txChart = new Chart(ctx, {
    type: "line",
    data: {
      labels: Array.from({ length: 10 }, (_, i) => "Slot " + (i + 1)),
      datasets: [
        { label: "Total TX", borderColor: "#333", data: [], tension: 0.3 },
        { label: "Pending TX", borderColor: "#ffb600", data: [], tension: 0.3 },
        { label: "Executed TX", borderColor: "#22bb55", data: [], tension: 0.3 },
        { label: "Failed TX", borderColor: "#ff4444", data: [], tension: 0.3 },
      ],
    },
    options: {
      responsive: true,
      plugins: { legend: { position: "bottom" } },
      scales: {
        x: { title: { display: true, text: "Slot (1–10)" } },
        y: { beginAtZero: true, title: { display: true, text: "Transactions" } },
      },
    },
  });
}

async function simulate() {
  const txCount = Number(txCountInput.value);
  const perSlot = Math.ceil(txCount / 10);
  const isAOT = modeAot.checked;
  const mode = scenario.value;

  let totalExec = 0, totalFail = 0, totalGas = 0, aotGas = 0;

  aotInfo.innerHTML = isAOT
    ? "💡 AOT mode active — Reserved slots ensure deterministic execution and higher stability."
    : "⚙️ JIT mode — Real-time execution, adaptive but may fail under congestion.";

  addLog(`🚀 Simulation started in ${isAOT ? "AOT" : "JIT"} mode with ${txCount} TX`);

  txChart.data.datasets.forEach(d => (d.data = []));

  for (let slot of slots) {
    slot.el.classList.add("active");

    // Congestion simulation
    let congestionDelay = 0;
    let waiting = false;
    if (mode === "congestion" && Math.random() < 0.3) {
      congestionDelay = 600 + Math.random() * 1000;
      waiting = true;
      slot.el.classList.add("waiting");
      slot.el.innerHTML += `<div class="waiting-label">⏳ Waiting...</div>`;
    }

    const chance = isAOT ? 0.9 : mode === "congestion" ? 0.6 : 0.75;
    const gasBase = isAOT ? 0.00025 : 0.00018;
    let exec = 0, fail = 0, pend = 0;

    for (let i = 0; i < perSlot; i++) {
      const roll = Math.random();
      if (roll < chance) exec++;
      else if (roll < chance + 0.1) pend++;
      else fail++;
    }

    document.getElementById(`slot-${slot.id}-exec`).textContent = exec;
    document.getElementById(`slot-${slot.id}-pend`).textContent = pend;
    document.getElementById(`slot-${slot.id}-fail`).textContent = fail;

    txChart.data.datasets[0].data.push(perSlot);
    txChart.data.datasets[1].data.push(pend);
    txChart.data.datasets[2].data.push(exec);
    txChart.data.datasets[3].data.push(fail);
    txChart.options.scales.y.max = Math.ceil(perSlot * 1.2);
    txChart.update();

    totalExec += exec;
    totalFail += fail;

    const gasThisSlot = gasBase * (exec + fail + pend);
    totalGas += gasThisSlot;
    if (isAOT) aotGas += gasThisSlot * 1.2;

    await new Promise(r => setTimeout(r, 200 + congestionDelay));

    if (waiting) slot.el.classList.remove("waiting");
    slot.el.classList.remove("active");
  }

  document.getElementById("m-exec").textContent = totalExec;
  document.getElementById("m-fail").textContent = totalFail;
  document.getElementById("m-total").textContent = txCount;
  document.getElementById("m-gas").textContent = totalGas.toFixed(5);
  document.getElementById("m-aotgas").textContent = aotGas.toFixed(5);

  addLog(`✅ Completed ${totalExec}/${txCount} executed | Total gas ${totalGas.toFixed(5)} SOL`);
}

document.getElementById("startBtn").onclick = simulate;
document.getElementById("resetBtn").onclick = () => {
  initSlots(); txChart.destroy(); initChart();
  aotInfo.innerHTML = "";
  document.querySelectorAll(".value").forEach(v => v.textContent = "0");
  addLog("🔄 Reset complete.");
};

window.onload = () => { initSlots(); initChart(); };
