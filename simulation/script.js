const slots = document.getElementById("slots");
const txChartCtx = document.getElementById("txChart").getContext("2d");
const gasChartCtx = document.getElementById("gasChart").getContext("2d");

let executed = 0, failed = 0, pending = 0;
let jitGas = 0, aotGas = 0;

// tạo 10 slot với 3 giá trị (Executed, Pending, Failed)
for (let i = 1; i <= 10; i++) {
  slots.innerHTML += `
    <div class="slot" id="slot-${i}">
      <b>Slot ${i}</b>
      <div class="dots">
        <div class="dot green"></div>
        <div class="dot yellow"></div>
        <div class="dot red"></div>
      </div>
      <div class="slot-values">
        <span class="exec">0</span>
        <span class="pend">0</span>
        <span class="fail">0</span>
      </div>
    </div>`;
}

// biểu đồ TX
const txChart = new Chart(txChartCtx, {
  type: "line",
  data: {
    labels: Array.from({ length: 10 }, (_, i) => `Slot ${i + 1}`),
    datasets: [
      { label: "Executed", borderColor: "#00c853", backgroundColor: "#00c853", data: [], fill: false },
      { label: "Pending", borderColor: "#ffb300", backgroundColor: "#ffb300", data: [], fill: false },
      { label: "Failed", borderColor: "#ff5252", backgroundColor: "#ff5252", data: [], fill: false },
    ]
  },
  options: {
    responsive: true,
    maintainAspectRatio: false,
    scales: { y: { beginAtZero: true } }
  }
});

// biểu đồ GAS
const gasChart = new Chart(gasChartCtx, {
  type: "bar",
  data: {
    labels: Array.from({ length: 10 }, (_, i) => `Slot ${i + 1}`),
    datasets: [
      { label: "AOT Gas", backgroundColor: "#00c853", data: [] },
      { label: "JIT Gas", backgroundColor: "#2979ff", data: [] },
    ]
  },
  options: {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      y: { beginAtZero: true, ticks: { callback: v => v.toFixed(5) } }
    }
  }
});

document.getElementById("startBtn").addEventListener("click", () => {
  executed = failed = pending = jitGas = aotGas = 0;
  const txCount = parseInt(document.getElementById("txCount").value);
  const execData = [], pendData = [], failData = [];
  const gasAOT = [], gasJIT = [];

  for (let i = 1; i <= 10; i++) {
    const slot = document.getElementById(`slot-${i}`);
    const exec = Math.floor(Math.random() * (txCount / 10)) + 5;
    const pend = Math.floor(Math.random() * 3);
    const fail = Math.floor(Math.random() * 2);

    executed += exec;
    pending += pend;
    failed += fail;

    slot.querySelector(".exec").textContent = exec;
    slot.querySelector(".pend").textContent = pend;
    slot.querySelector(".fail").textContent = fail;

    execData.push(exec);
    pendData.push(pend);
    failData.push(fail);

    const gasA = 0.00003 + Math.random() * 0.00006;
    const gasJ = 0.00003 + Math.random() * 0.00006;
    gasAOT.push(gasA);
    gasJIT.push(gasJ);

    aotGas += gasA;
    jitGas += gasJ;
  }

  txChart.data.datasets[0].data = execData;
  txChart.data.datasets[1].data = pendData;
  txChart.data.datasets[2].data = failData;
  txChart.update();

  gasChart.data.datasets[0].data = gasAOT;
  gasChart.data.datasets[1].data = gasJIT;
  gasChart.update();

  document.querySelector("#executedTx span").textContent = executed;
  document.querySelector("#failedTx span").textContent = failed;
  document.querySelector("#pendingTx span").textContent = pending;
  document.querySelector("#jitGas span").textContent = jitGas.toFixed(5);
  document.querySelector("#aotGas span").textContent = aotGas.toFixed(5);
  document.querySelector("#totalGas span").textContent = (jitGas + aotGas).toFixed(5);
});
