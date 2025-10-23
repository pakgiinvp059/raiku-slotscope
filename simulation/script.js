let slots = [];
let txChart;

const log = document.getElementById("log");
const txCountInput = document.getElementById("txCount");
const modeAot = document.getElementById("modeAot");

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
    slots.push({ id: i, el, exec: 0, fail: 0 });
  }
}

function initChart() {
  const ctx = document.getElementById("txChart").getContext("2d");
  txChart = new Chart(ctx, {
    type: "line",
    data: {
      labels: [],
      datasets: [
        { label: "Total TX", borderColor: "#333", data: [], tension: 0.4 },
        { label: "Executed", borderColor: "#22bb55", data: [], tension: 0.4 },
        { label: "Failed", borderColor: "#ff4444", data: [], tension: 0.4 },
      ],
    },
    options: {
      responsive: true,
      plugins: { legend: { position: "bottom" } },
      scales: {
        x: { title: { display: true, text: "Slot (1–10)" } },
        y: { title: { display: true, text: "Transaction Count" }, beginAtZero: true },
      },
    },
  });
}

function updateChart(slot, total, exec, fail) {
  txChart.data.labels.push("Slot " + slot);
  txChart.data.datasets[0].data.push(total);
  txChart.data.datasets[1].data.push(exec);
  txChart.data.datasets[2].data.push(fail);
  txChart.update();
}

async function simulate() {
  const txCount = Number(txCountInput.value);
  const perSlot = Math.ceil(txCount / 10);
  const isAOT = modeAot.checked;

  let totalExec = 0, totalFail = 0;

  addLog(`🚀 Simulation started in ${isAOT ? "AOT" : "JIT"} mode with ${txCount} TX`);

  for (let slot of slots) {
    let exec = 0, fail = 0;
    const chance = isAOT ? 0.9 : 0.7;

    for (let i = 0; i < perSlot; i++) {
      Math.random() < chance ? exec++ : fail++;
    }

    slot.exec = exec;
    slot.fail = fail;
    totalExec += exec;
    totalFail += fail;

    document.getElementById(`slot-${slot.id}-exec`).textContent = exec;
    document.getElementById(`slot-${slot.id}-fail`).textContent = fail;

    updateChart(slot.id, perSlot, exec, fail);
    await new Promise((r) => setTimeout(r, 200));
  }

  const gas = (isAOT ? 0.0002 : 0.0003) * txCount;
  document.getElementById("m-exec").textContent = totalExec;
  document.getElementById("m-fail").textContent = totalFail;
  document.getElementById("m-total").textContent = txCount;
  document.getElementById("m-gas").textContent = gas.toFixed(5);

  addLog(`✅ Completed: ${totalExec} executed, ${totalFail} failed | Est. gas ${gas.toFixed(5)} SOL`);
}

document.getElementById("startBtn").onclick = simulate;
document.getElementById("resetBtn").onclick = () => {
  initSlots();
  txChart.destroy();
  initChart();
  document.getElementById("m-exec").textContent = 0;
  document.getElementById("m-fail").textContent = 0;
  document.getElementById("m-total").textContent = 0;
  document.getElementById("m-gas").textContent = "0.0000";
  addLog("🔄 Reset complete.");
};

window.onload = () => {
  initSlots();
  initChart();
};
