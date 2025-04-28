const WEB_APP_URL =
  "https://script.google.com/macros/s/AKfycbzfe0g5mZ2kn57Pw4mW_yb1-DNwAh4FHuUVbXMMISh-alx98LbghIj7mB-pXz36_l-yZg/exec";

async function fetchCatData() {
  try {
    const res = await fetch("/catdata");
    const data = await res.json();

    if (!data || !Array.isArray(data) || data.length === 0) {
      console.warn("No data found in sheet.");
      return;
    }

    const latest = data[data.length - 1];

    // Duration counts
    const bedDurationSeconds = data.filter(
      (row) => row.event2 === "cat_detected"
    ).length;
    const windowDurationSeconds = data.filter(
      (row) => row.event1 === "cat_detected"
    ).length;
    const foodDurationSeconds = data.filter(
      (row) => row.event3 === "cat_detected"
    ).length;

    let bedFrequency = 0;
    let windowFrequency = 0;
    let foodFrequency = 0;
    // Initialize "previous meaningful state" separately for each event
let sessionLog = [];

let lastBedStatus = null;
let lastWindowStatus = null;
let lastFoodStatus = null;

let bedSessionStart = null;
let windowSessionStart = null;
let foodSessionStart = null;

for (let i = 0; i < data.length; i++) {
  const row = data[i];

  const currentTime = row.local_timestamp; // assumed formatted correctly

  // --- Bed ---
  if (row.event2) {
    if (lastBedStatus === "nothing_detected" && row.event2 === "cat_detected") {
      bedSessionStart = currentTime;
    } else if (lastBedStatus === "cat_detected" && row.event2 === "nothing_detected" && bedSessionStart) {
      const start = new Date(bedSessionStart);
      const end = new Date(currentTime);
      const durationSec = Math.round((end - start) / 1000);
      sessionLog.push({ startTime: bedSessionStart, durationSeconds: durationSec, location: "Bed" });
      bedSessionStart = null;
    }
    lastBedStatus = row.event2;
  }

  // --- Window ---
  if (row.event1) {
    if (lastWindowStatus === "nothing_detected" && row.event1 === "cat_detected") {
      windowSessionStart = currentTime;
    } else if (lastWindowStatus === "cat_detected" && row.event1 === "nothing_detected" && windowSessionStart) {
      const start = new Date(windowSessionStart);
      const end = new Date(currentTime);
      const durationSec = Math.round((end - start) / 1000);
      sessionLog.push({ startTime: windowSessionStart, durationSeconds: durationSec, location: "Window" });
      windowSessionStart = null;
    }
    lastWindowStatus = row.event1;
  }

  // --- Food Bowl ---
  if (row.event3) {
    if (lastFoodStatus === "nothing_detected" && row.event3 === "cat_detected") {
      foodSessionStart = currentTime;
    } else if (lastFoodStatus === "cat_detected" && row.event3 === "nothing_detected" && foodSessionStart) {
      const start = new Date(foodSessionStart);
      const end = new Date(currentTime);
      const durationSec = Math.round((end - start) / 1000);
      sessionLog.push({ startTime: foodSessionStart, durationSeconds: durationSec, location: "Food" });
      foodSessionStart = null;
    }
    lastFoodStatus = row.event3;
  }
}


    updateUI(
      latest,
      bedDurationSeconds,
      windowDurationSeconds,
      foodDurationSeconds,
      bedFrequency,
      windowFrequency,
      foodFrequency,
      sessionLog
    );
  } catch (err) {
    console.error("Error fetching cat data:", err);
  }
}

function updateUI(
  latest,
  bedDurationSeconds,
  windowDurationSeconds,
  foodDurationSeconds,
  bedFrequency,
  windowFrequency,
  foodFrequency,
   sessionLog
) {
  const catBed = document.getElementById("cat-bed");
  const windowSpot = document.getElementById("window");
  const foodBowl = document.getElementById("food-bowl");

  [catBed, windowSpot, foodBowl].forEach((el) => el.classList.remove("active"));

  const bedDetected = latest.event2 === "cat_detected";
  const windowDetected = latest.event1 === "cat_detected";
  const foodDetected = latest.event3 === "cat_detected";

  if (bedDetected) catBed.classList.add("active");
  if (windowDetected) windowSpot.classList.add("active");
  if (foodDetected) foodBowl.classList.add("active");

  updateBoxText(
    catBed,
    bedDetected,
    bedDurationSeconds,
    bedFrequency,
    "Cat Bed"
  );
  updateBoxText(
    windowSpot,
    windowDetected,
    windowDurationSeconds,
    windowFrequency,
    "Window"
  );
  updateBoxText(
    foodBowl,
    foodDetected,
    foodDurationSeconds,
    foodFrequency,
    "Food Bowl"
  );
}

function updateBoxText(box, isActive, durationSeconds, frequency, label) {
  const p = box.querySelector("p");
  const pawLine = isActive ? "🐾<br>" : "";
  const durationMinutes = (durationSeconds / 60).toFixed(1); // rounded to 1 decimal

  p.innerHTML = `
    ${pawLine}
    <span class="label">Current status:</span><br>
    ${isActive ? "Cat Detected" : "Nothing Detected"}<br>
    <span class="label">Total duration:</span><br>
    ${durationMinutes} min (${durationSeconds} sec)<br>
    <span class="label">Number of sessions:</span><br>
    ${frequency}
  `;
}


function drawSessionChart(sessionLog) {
  d3.select("#session-chart").html(""); // Clear previous chart if needed

  const width = 600;
  const height = 300;
  const margin = { top: 20, right: 30, bottom: 30, left: 50 };

  const parseTime = d3.timeParse("%Y-%m-%d %H:%M:%S");

  const data = sessionLog.map(d => ({
    startTime: parseTime(d.startTime),
    durationSeconds: d.durationSeconds,
    location: d.location
  }));

  // X: start time scale
  const x = d3.scaleTime()
    .domain(d3.extent(data, d => d.startTime))
    .range([margin.left, width - margin.right]);

  // Y: session duration
  const y = d3.scaleLinear()
    .domain([0, d3.max(data, d => d.durationSeconds)]).nice()
    .range([height - margin.bottom, margin.top]);

  const shape = d3.scaleOrdinal()
    .domain(["Bed", "Window", "Food"])
    .range([d3.symbolCircle, d3.symbolSquare, d3.symbolTriangle]);

  const svg = d3.select("#session-chart")
    .append("svg")
    .attr("width", width)
    .attr("height", height);

  svg.append("g")
    .selectAll("path")
    .data(data)
    .join("path")
    .attr("transform", d => `translate(${x(d.startTime)},${y(d.durationSeconds)})`)
    .attr("d", d3.symbol().type(d => shape(d.location)).size(100))
    .attr("fill", "black");

  // X axis (time)
  svg.append("g")
    .attr("transform", `translate(0,${height - margin.bottom})`)
    .call(d3.axisBottom(x).ticks(width / 80).tickSizeOuter(0));

  // Y axis (duration)
  svg.append("g")
    .attr("transform", `translate(${margin.left},0)`)
    .call(d3.axisLeft(y).ticks(5));
}


setInterval(fetchCatData, 3000);
fetchCatData();
