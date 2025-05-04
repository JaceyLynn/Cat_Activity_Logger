// const WEB_APP_URL =
//   "https://script.google.com/macros/s/AKfycbxn9-kXI1Vsmi_SvtI5M52terMvXbNspXr8HHrFdVRfxBTofhsmB6uXpT_wClNc9sNW-g/exec";

let currentSessionLog = [];
let isUserSwitchingDate = false;
let hasInitialLoadCompleted = false;

async function populateDateFilter() {
  try {
    const res = await fetch("/catdata?mode=listSheets");
    const dateTabs = await res.json();

    console.log("Fetched dateTabs:", dateTabs); // <-- THEN you can safely log
    const select = document.getElementById("date-filter");

    // Clear existing options
    select.innerHTML = '<option value="">Select Date</option>';

    dateTabs.sort().reverse(); // latest first
    dateTabs.forEach((date) => {
      const option = document.createElement("option");
      option.value = date;
      option.textContent = date;
      select.appendChild(option);
    });
  } catch (err) {
    console.error("Error populating date filter:", err);
  }
}

let loadingTimeout;

function showInitialLoading() {
  document.getElementById("loading-overlay").style.display = "flex";
}
function hideInitialLoading() {
  document.getElementById("loading-overlay").style.display = "none";
}

function showSwitchingLoading() {
  document.getElementById("switching-overlay").style.display = "flex";
}
function hideSwitchingLoading() {
  document.getElementById("switching-overlay").style.display = "none";
}

let isInitialLoad = true;

async function fetchCatData() {
  try {
    if (isUserSwitchingDate) return;

    if (isInitialLoad) showInitialLoading();

    const res = await fetch("/catdata");
    const data = await res.json();

    if (!data || !Array.isArray(data)) return;

    const latest = data[data.length - 1];

    // Duration counters
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
    let sessionLog = [];

    let lastBedStatus = null;
    let lastWindowStatus = null;
    let lastFoodStatus = null;

    let bedSessionStart = null;
    let windowSessionStart = null;
    let foodSessionStart = null;

    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const currentTime = row.local_timestamp;

      // === BED (event2) ===
      if (row.event2) {
        if (
          lastBedStatus === "nothing_detected" &&
          row.event2 === "cat_detected"
        ) {
          bedSessionStart = currentTime;
        } else if (
          lastBedStatus === "cat_detected" &&
          row.event2 === "nothing_detected" &&
          bedSessionStart
        ) {
          let merge = false;
          let skipCount = 0;
          for (let j = i + 1; j < data.length && skipCount < 30; j++) {
            const next = data[j];
            if (!next.event2) continue;
            skipCount++;
            if (next.event2 === "cat_detected") {
              merge = true;
              break;
            }
            if (next.event2 === "nothing_detected") break;
          }

          if (!merge) {
            const durationSec = Math.round(
              (new Date(currentTime) - new Date(bedSessionStart)) / 1000
            );
            sessionLog.push({
              startTime: bedSessionStart,
              durationSeconds: durationSec,
              location: "Bed",
            });
            bedSessionStart = null;
          }
        }
        lastBedStatus = row.event2;
      }

      // === WINDOW (event1) ===
      if (row.event1) {
        if (
          lastWindowStatus === "nothing_detected" &&
          row.event1 === "cat_detected"
        ) {
          windowSessionStart = currentTime;
        } else if (
          lastWindowStatus === "cat_detected" &&
          row.event1 === "nothing_detected" &&
          windowSessionStart
        ) {
          let merge = false;
          let skipCount = 0;
          for (let j = i + 1; j < data.length && skipCount < 100; j++) {
            const next = data[j];
            if (!next.event1) continue;
            skipCount++;
            if (next.event1 === "cat_detected") {
              merge = true;
              break;
            }
            if (next.event1 === "nothing_detected") break;
          }

          if (!merge) {
            console.log(`[win] Merged session skipped at index ${i}`);
            const durationSec = Math.round(
              (new Date(currentTime) - new Date(windowSessionStart)) / 1000
            );
            sessionLog.push({
              startTime: windowSessionStart,
              durationSeconds: durationSec,
              location: "Window",
            });
            windowSessionStart = null;
          } else {
            console.log(
              `[win] Added session from ${bedSessionStart} to ${currentTime}`
            );
          }
        }
        lastWindowStatus = row.event1;
      }

      // === FOOD (event3) ===
      if (row.event3) {
        if (
          lastFoodStatus === "nothing_detected" &&
          row.event3 === "cat_detected"
        ) {
          foodSessionStart = currentTime;
        } else if (
          lastFoodStatus === "cat_detected" &&
          row.event3 === "nothing_detected" &&
          foodSessionStart
        ) {
          let merge = false;
          let skipCount = 0;
          for (let j = i + 1; j < data.length && skipCount < 30; j++) {
            const next = data[j];
            if (!next.event3) continue;
            skipCount++;
            if (next.event3 === "cat_detected") {
              merge = true;
              break;
            }
            if (next.event3 === "nothing_detected") break;
          }

          if (!merge) {
            const durationSec = Math.round(
              (new Date(currentTime) - new Date(foodSessionStart)) / 1000
            );
            sessionLog.push({
              startTime: foodSessionStart,
              durationSeconds: durationSec,
              location: "Food",
            });
            foodSessionStart = null;
          }
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
      sessionLog,
      data
    );

    if (isInitialLoad) {
      hideInitialLoading();
      isInitialLoad = false;
    }
  } catch (err) {
    console.error("Error fetching cat data:", err);
    if (isInitialLoad) hideInitialLoading();
  }
}

async function fetchChartDataOnly(selectedDate) {
  try {
    showSwitchingLoading(); // 🔹 Show "Switching Data Set" overlay

    const response = await fetch(
      `/catdata?sheet=${encodeURIComponent(selectedDate)}`
    );
    const data = await response.json();

    if (!data || !Array.isArray(data) || data.length === 0) {
      console.warn("No data found for the selected day.");
      hideSwitchingLoading();
      return;
    }

    console.log("Fetched data for:", selectedDate, data);

    currentSessionLog = [];

    let lastBedStatus = null;
    let lastWindowStatus = null;
    let lastFoodStatus = null;

    let bedSessionStart = null;
    let windowSessionStart = null;
    let foodSessionStart = null;

    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const currentTime = row.local_timestamp;

      // === BED SESSION (event2) ===
      if (row.event2) {
        if (
          lastBedStatus === "nothing_detected" &&
          row.event2 === "cat_detected"
        ) {
          bedSessionStart = currentTime;
        } else if (
          lastBedStatus === "cat_detected" &&
          row.event2 === "nothing_detected" &&
          bedSessionStart
        ) {
          // Peek forward
          let merge = false;
          let skipCount = 0;
          for (let j = i + 1; j < data.length && skipCount < 30; j++) {
            const next = data[j];
            if (!next.event2) continue; // skip nulls
            skipCount++;
            if (next.event2 === "cat_detected") {
              merge = true;
              break;
            }
            if (next.event2 === "nothing_detected") break;
          }

          if (!merge) {
            const start = new Date(bedSessionStart);
            const end = new Date(currentTime);
            const durationSec = Math.round((end - start) / 1000);
            currentSessionLog.push({
              startTime: bedSessionStart,
              durationSeconds: durationSec,
              location: "Bed",
            });
            bedSessionStart = null;
          }
        }
        lastBedStatus = row.event2;
      }

      // === WINDOW SESSION (event1) ===
      if (row.event1) {
        if (
          lastWindowStatus === "nothing_detected" &&
          row.event1 === "cat_detected"
        ) {
          windowSessionStart = currentTime;
        } else if (
          lastWindowStatus === "cat_detected" &&
          row.event1 === "nothing_detected" &&
          windowSessionStart
        ) {
          let merge = false;
          let skipCount = 0;
          for (let j = i + 1; j < data.length && skipCount < 300; j++) {
            const next = data[j];
            if (!next.event1) continue;
            skipCount++;
            if (next.event1 === "cat_detected") {
              merge = true;
              break;
            }
            if (next.event1 === "nothing_detected") break;
          }

          if (!merge) {
            const start = new Date(windowSessionStart);
            const end = new Date(currentTime);
            const durationSec = Math.round((end - start) / 1000);
            currentSessionLog.push({
              startTime: windowSessionStart,
              durationSeconds: durationSec,
              location: "Window",
            });
            windowSessionStart = null;
          }
        }
        lastWindowStatus = row.event1;
      }

      // === FOOD SESSION (event3) ===
      if (row.event3) {
        if (
          lastFoodStatus === "nothing_detected" &&
          row.event3 === "cat_detected"
        ) {
          foodSessionStart = currentTime;
        } else if (
          lastFoodStatus === "cat_detected" &&
          row.event3 === "nothing_detected" &&
          foodSessionStart
        ) {
          let merge = false;
          let skipCount = 0;
          for (let j = i + 1; j < data.length && skipCount < 30; j++) {
            const next = data[j];
            if (!next.event3) continue;
            skipCount++;
            if (next.event3 === "cat_detected") {
              merge = true;
              break;
            }
            if (next.event3 === "nothing_detected") break;
          }

          if (!merge) {
            const start = new Date(foodSessionStart);
            const end = new Date(currentTime);
            const durationSec = Math.round((end - start) / 1000);
            currentSessionLog.push({
              startTime: foodSessionStart,
              durationSeconds: durationSec,
              location: "Food",
            });
            foodSessionStart = null;
          }
        }
        lastFoodStatus = row.event3;
      }
    }

    console.log("Processed sessionLog for:", selectedDate, currentSessionLog);

    await updateCharts(currentSessionLog);
    hideSwitchingLoading(); // ✅ Hide when charts are ready
  } catch (err) {
    console.error("Error fetching data for selected day:", err);
    hideSwitchingLoading();
  }
}

async function updateCharts(currentSessionLog) {
  // Wait for each chart to finish drawing before continuing
  await drawSessionChart(currentSessionLog);

  const hourlyData = prepareHourlySummary(currentSessionLog);
  await drawHourlyChart(hourlyData);

  await drawPatternChart(currentSessionLog);
}

function prepareHourlySummary(sessionLog) {
  // Initialize hourly summary
  const hours = Array.from({ length: 24 }, (_, i) => ({
    hour: `${String(i).padStart(2, "0")}:00`,
    Bed: 0,
    Food: 0,
    Window: 0,
  }));

  const parseTime = d3.timeParse("%Y-%m-%d %H:%M:%S");

  sessionLog.forEach((session) => {
    const start = parseTime(session.startTime);
    const hour = start.getHours();
    if (session.location === "Bed") {
      hours[hour].Bed += session.durationSeconds;
    } else if (session.location === "Food") {
      hours[hour].Food += session.durationSeconds;
    } else if (session.location === "Window") {
      hours[hour].Window += session.durationSeconds;
    }
  });

  return hours;
}

function findLastDetected(data, eventKey) {
  for (let i = data.length - 1; i >= 0; i--) {
    if (data[i][eventKey] === "cat_detected") {
      const rawTime = data[i].local_timestamp;
      const formattedTime = formatReadableTime(rawTime);
      return formattedTime;
    }
  }
  return "-"; // if no detection found
}

function formatReadableTime(timestampStr) {
  const date = new Date(timestampStr);
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const seconds = String(date.getSeconds()).padStart(2, "0");
  return `${hours}:${minutes}:${seconds}`;
}

function updateUI(
  latest,
  bedDurationSeconds,
  windowDurationSeconds,
  foodDurationSeconds,
  bedFrequency,
  windowFrequency,
  foodFrequency,
  sessionLog,
  fullData
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
    findLastDetected(fullData, "event2")
  );
  updateBoxText(
    windowSpot,
    windowDetected,
    windowDurationSeconds,
    findLastDetected(fullData, "event1")
  );
  updateBoxText(
    foodBowl,
    foodDetected,
    foodDurationSeconds,
    findLastDetected(fullData, "event3")
  );

  // Draw the charts
  drawSessionChart(sessionLog);
  const hourlyData = prepareHourlySummary(sessionLog);
  drawHourlyChart(hourlyData);
  drawPatternChart(sessionLog);
}

function updateBoxText(box, isActive, durationSeconds, lastDetectedTime) {
  const p = box.querySelector("p");
  const pawLine = isActive ? "🐾<br>" : "";
  const durationMinutes = (durationSeconds / 60).toFixed(1); // rounded to 1 decimal

  p.innerHTML = `
    <span class="label">current status:</span> ${
      isActive ? "cat detected" : "nothing detected"
    }<br>
    <span class="label">last detected:</span> ${lastDetectedTime}<br>
    <span class="label">total duration:</span> ${durationMinutes} min (${durationSeconds} sec)
  `;
}

function drawSessionChart(sessionLog) {
  return new Promise((resolve) => {
    d3.select("#session-chart").html(""); // Clear previous chart

    const container = document.getElementById("session-chart");
    const width = container.clientWidth || 1000;
    const height = 700;
    const margin = { top: 20, right: 30, bottom: 30, left: 60 };

    const parseTime = d3.timeParse("%Y-%m-%d %H:%M:%S");

    const data = sessionLog.map((d) => ({
      startTime: parseTime(d.startTime),
      durationSeconds: d.durationSeconds,
      location: d.location,
    }));

    const cleanedData = data.filter(
      (d) => d.startTime && d.durationSeconds > 0 && d.location
    );

    // X: start time scale
    const x = d3
      .scaleTime()
      .domain(d3.extent(cleanedData, (d) => d.startTime))
      .range([margin.left, width - margin.right]);

    // Y: session duration using log scale
    const y = d3
      .scaleLog()
      .domain([1, d3.max(cleanedData, (d) => d.durationSeconds)]) // avoid 0
      .range([height - margin.bottom, margin.top])
      .clamp(true);

    const shape = d3
      .scaleOrdinal()
      .domain(["Bed", "Food", "Window"])
      .range([d3.symbolCircle, d3.symbolTriangle, d3.symbolSquare]);

    const color = d3
      .scaleOrdinal()
      .domain(["Bed", "Food", "Window"])
      .range(["#D390CE", "#F5AB54", "#60D1DB"]);

    const svg = d3
      .select("#session-chart")
      .append("svg")
      .attr("width", "100%")
      .attr("viewBox", `0 0 ${width} ${height}`)
      .attr("height", height);

    // Draw points
    svg
      .append("g")
      .selectAll("path")
      .data(cleanedData)
      .join("path")
      .attr(
        "transform",
        (d) => `translate(${x(d.startTime)},${y(d.durationSeconds)})`
      )
      .attr(
        "d",
        d3
          .symbol()
          .type((d) => shape(d.location))
          .size(100)
      )
      .attr("fill", (d) => color(d.location));

    // X axis (time)
    svg
      .append("g")
      .attr("transform", `translate(0,${height - margin.bottom})`)
      .call(
        d3
          .axisBottom(x)
          .ticks(d3.timeHour.every(2)) // every 2 hours (adjust as needed)
          .tickFormat(d3.timeFormat("%H:%M")) // 24-hour format
          .tickSizeOuter(0)
      );

    // Y axis (log scale, formatted)
    svg
      .append("g")
      .attr("transform", `translate(${margin.left},0)`)
      .call(
        d3
          .axisLeft(y)
          .tickValues(y.ticks().filter((t) => Number.isFinite(t))) // avoid Infinity
          .tickFormat(d3.format("~d")) // plain numbers, no "1k" or scientific notation
      );
    // Y Axis label
    svg
      .append("text")
      .attr("text-anchor", "middle")
      .attr("transform", `rotate(-90)`)
      .attr("x", -height / 2)
      .attr("y", 15) // distance from the axis; adjust as needed
      .text("Duration (seconds)")
      .style("fill", "#333")
      .style("font-size", "14px");

    resolve();
  });
}

function drawHourlyChart(hourlyData) {
  return new Promise((resolve) => {
    d3.select("#hourly-chart").html(""); // Clear previous chart

    const container = document.getElementById("session-chart");
    const width = container.clientWidth || 1000;
    const height = 600;
    const margin = { top: 20, right: 30, bottom: 30, left: 50 };

    const keys = ["Bed", "Food", "Window"];

    // Stack the data
    const stack = d3.stack().keys(keys).offset(d3.stackOffsetExpand); // Normalize to 100%

    const series = stack(hourlyData);

    const y = d3
      .scaleBand()
      .domain(hourlyData.map((d) => d.hour))
      .rangeRound([margin.top, height - margin.bottom])
      .padding(0.1);

    const x = d3.scaleLinear().rangeRound([margin.left, width - margin.right]);

    const color = d3
      .scaleOrdinal()
      .domain(keys)
      .range(["#D390CE", "#F5AB54", "#60D1DB"]);

    const svg = d3
      .select("#hourly-chart")
      .append("svg")
      .attr("width", "100%")
      .attr("viewBox", `0 0 ${width} ${height}`)
      .attr("height", height);

    svg
      .append("g")
      .selectAll("g")
      .data(series)
      .join("g")
      .attr("fill", (d) => color(d.key))
      .selectAll("rect")
      .data((d) => d)
      .join("rect")
      .attr("y", (d) => y(d.data.hour))
      .attr("x", (d) => x(d[0]))
      .attr("width", (d) => x(d[1]) - x(d[0]))
      .attr("height", y.bandwidth());

    svg
      .append("g")
      .attr("transform", `translate(0,${margin.top})`)
      .call(d3.axisTop(x).ticks(5, "%"));

    svg
      .append("g")
      .attr("transform", `translate(${margin.left},0)`)
      .call(d3.axisLeft(y));
    resolve();
  });
}

function drawPatternChart(sessionLog) {
  return new Promise((resolve) => {
    d3.select("#pattern-chart").html(""); // Clear previous chart

    const container = document.getElementById("session-chart");
    const width = container.clientWidth || 1000;
    const height = 300;
    const margin = { top: 20, right: 30, bottom: 30, left: 80 };

    // Parse times
    const parseTime = d3.timeParse("%Y-%m-%d %H:%M:%S");

    const data = sessionLog.map((d) => {
      const timeObj = parseTime(d.startTime);
      return {
        timeOfDay: new Date(
          1970,
          0,
          1,
          timeObj.getHours(),
          timeObj.getMinutes(),
          timeObj.getSeconds()
        ),
        location: d.location,
      };
    });
    const cleanedData = data.filter((d) => d.timeOfDay && d.location);

    // Sort sessions by time (important for connecting)
    data.sort((a, b) => a.timeOfDay - b.timeOfDay);

    // X: Time scale (24h)
    const x = d3
      .scaleTime()
      .domain([new Date(1970, 0, 1, 0, 0, 0), new Date(1970, 0, 1, 23, 59, 59)])
      .range([margin.left, width - margin.right]);

    // Y: Custom location scale
    const y = d3
      .scalePoint()
      .domain(["Bed", "Food", "Window"])
      .range([margin.top, height - margin.bottom])
      .padding(0.5);

    const color = d3
      .scaleOrdinal()
      .domain(["Bed", "Food", "Window"])
      .range(["#D390CE", "#F5AB54", "#60D1DB"]);

    const svg = d3
      .select("#pattern-chart")
      .append("svg")
      .attr("width", "100%")
      .attr("viewBox", `0 0 ${width} ${height}`)
      .attr("height", height);

    // Line generator (connect points)
    const line = d3
      .line()
      .x((d) => x(d.timeOfDay))
      .y((d) => y(d.location))
      .curve(d3.curveMonotoneX); // Smooth curve, or .curve(d3.curveLinear) for straight lines

    // Draw the connecting line with animation
    const path = svg
      .append("path")
      .datum(data)
      .attr("fill", "none")
      .attr("stroke", "#666") // Line color
      .attr("stroke-width", 1)
      .attr("d", line);

    // Animate the path drawing
    const totalLength = path.node().getTotalLength();

    path
      .attr("stroke-dasharray", `${totalLength} ${totalLength}`)
      .attr("stroke-dashoffset", totalLength)
      .transition()
      .duration(3000) // 3 seconds (adjust as you like)
      .ease(d3.easeLinear)
      .attr("stroke-dashoffset", 0);

    // Draw the dots
    svg
      .append("g")
      .selectAll("circle")
      .data(data)
      .join("circle")
      .attr("cx", (d) => x(d.timeOfDay))
      .attr("cy", (d) => y(d.location))
      .attr("r", 3)
      .attr("fill", (d) => color(d.location));

    // X Axis
    svg
      .append("g")
      .attr("transform", `translate(0,${height - margin.bottom})`)
      .call(
        d3
          .axisBottom(x)
          .ticks(d3.timeHour.every(2))
          .tickFormat(d3.timeFormat("%H:%M"))
      );

    // Y Axis
    svg
      .append("g")
      .attr("transform", `translate(${margin.left},0)`)
      .call(d3.axisLeft(y));
    resolve();
  });
}

setInterval(fetchCatData, 3000);
fetchCatData();
populateDateFilter();

document.getElementById("date-filter").addEventListener("change", (e) => {
  const selectedDate = e.target.value;
  if (selectedDate) {
    isUserSwitchingDate = true;
    showSwitchingLoading(); // ✅ Show switch loading
    fetchChartDataOnly(selectedDate);
  }
});
