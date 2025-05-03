// const WEB_APP_URL =
//   "https://script.google.com/macros/s/AKfycbxn9-kXI1Vsmi_SvtI5M52terMvXbNspXr8HHrFdVRfxBTofhsmB6uXpT_wClNc9sNW-g/exec";

let currentSessionLog = [];
let isUserSwitchingDate = false;

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

function showLoading() {
  document.getElementById("loading-overlay").style.display = "flex";
}

function hideLoading() {
  document.getElementById("loading-overlay").style.display = "none";
}

async function fetchCatData() {
  try {
    if (isUserSwitchingDate) return;

    showLoading(); // 🔹 START

    const res = await fetch("/catdata");
    const data = await res.json();

    try {
      if (isUserSwitchingDate) {
        console.log(
          "[fetchCatDataDefault] Cancelled because user switched date"
        );
        return; //Stop fetching today's data if user switched
      }
      console.log(
        "[fetchCatDataDefault] I am fetching default sheet (no specific date)"
      );

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
      // data for charts making, sessions info
      let sessionLog = [];
      // Initialize previous meaningful state separately for each event
      let lastBedStatus = null;
      let lastWindowStatus = null;
      let lastFoodStatus = null;
      // start time for each session at each loc
      let bedSessionStart = null;
      let windowSessionStart = null;
      let foodSessionStart = null;

      for (let i = 0; i < data.length; i++) {
        const row = data[i];

        const currentTime = row.local_timestamp; // assumed formatted correctly

        // --- Bed ---
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
            const start = new Date(bedSessionStart);
            const end = new Date(currentTime);
            const durationSec = Math.round((end - start) / 1000);
            sessionLog.push({
              startTime: bedSessionStart,
              durationSeconds: durationSec,
              location: "Bed",
            });
            bedSessionStart = null;
          }
          lastBedStatus = row.event2;
        }

        // --- Window ---
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
            const start = new Date(windowSessionStart);
            const end = new Date(currentTime);
            const durationSec = Math.round((end - start) / 1000);
            sessionLog.push({
              startTime: windowSessionStart,
              durationSeconds: durationSec,
              location: "Window",
            });
            windowSessionStart = null;
          }
          lastWindowStatus = row.event1;
        }

        // --- Food Bowl ---
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
            const start = new Date(foodSessionStart);
            const end = new Date(currentTime);
            const durationSec = Math.round((end - start) / 1000);
            sessionLog.push({
              startTime: foodSessionStart,
              durationSeconds: durationSec,
              location: "Food",
            });
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
        sessionLog,
        data
      );
    } catch (err) {
      console.error("Error fetching cat data:", err);
    }
    hideLoading(); // 🔹 END
  } catch (err) {
    console.error("Error fetching cat data:", err);
    hideLoading(); // always hide on error too
  }
}

document.getElementById("date-filter").addEventListener("change", (e) => {
  const selectedDate = e.target.value;
  if (selectedDate) {
    isUserSwitchingDate = true; // Block further default fetching
    fetchChartDataOnly(selectedDate);
  }
});

async function fetchChartDataOnly(selectedDate) {
  try {
    showLoading(); // 🔹 START

    const response = await fetch(
      `/catdata?sheet=${encodeURIComponent(selectedDate)}`
    );
    const data = await response.json();
    try {
      const response = await fetch(
        `/catdata?sheet=${encodeURIComponent(selectedDate)}`
      );
      const data = await response.json();

      if (!data || !Array.isArray(data) || data.length === 0) {
        console.warn("No data found for the selected day.");
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
        const currentTime = row.local_timestamp; // assumed to be readable string

        // --- Bed ---
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
          lastBedStatus = row.event2;
        }

        // --- Window ---
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
          lastWindowStatus = row.event1;
        }

        // --- Food Bowl ---
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
          lastFoodStatus = row.event3;
        }
      }

      console.log("Processed sessionLog for:", selectedDate, currentSessionLog);

      // Redraw charts
      updateCharts(currentSessionLog);
    } catch (err) {
      console.error("Error fetching cat data:", err);
    }
    hideLoading(); // 🔹 END
  } catch (err) {
    console.error("Error fetching data for selected day:", err);
    hideLoading();
  }
}

function updateCharts(currentSessionLog) {
  drawSessionChart(currentSessionLog);
  const hourlyData = prepareHourlySummary(currentSessionLog);
  drawHourlyChart(hourlyData);
  drawPatternChart(currentSessionLog);
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
  d3.select("#session-chart").html(""); // Clear previous chart if needed

  const width = 1000;
  const height = 1000;
  const margin = { top: 20, right: 30, bottom: 30, left: 50 };

  const parseTime = d3.timeParse("%Y-%m-%d %H:%M:%S");

  const data = sessionLog.map((d) => ({
    startTime: parseTime(d.startTime),
    durationSeconds: d.durationSeconds,
    location: d.location,
  }));
  const cleanedData = data.filter(
    (d) => d.startTime && d.durationSeconds !== undefined && d.location
  );

  // X: start time scale
  const x = d3
    .scaleTime()
    .domain(d3.extent(data, (d) => d.startTime))
    .range([margin.left, width - margin.right]);

  // Y: session duration
  const y = d3
    .scaleLinear()
    .domain([0, d3.max(data, (d) => d.durationSeconds)])
    .nice()
    .range([height - margin.bottom, margin.top]);

  const shape = d3
    .scaleOrdinal()
    .domain(["Bed", "Food", "Window"])
    .range([d3.symbolCircle, d3.symbolTriangle, d3.symbolSquare]);

  const color = d3
    .scaleOrdinal()
    .domain(["Bed", "Food", "Window"])
    .range(["#8a7b9f", "#b28f7e", "#6d948a"]);

  const svg = d3
    .select("#session-chart")
    .append("svg")
    .attr("width", width)
    .attr("height", height);

  // Draw points
  svg
    .append("g")
    .selectAll("path")
    .data(data)
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
    .attr("fill", (d) => color(d.location)); // ✨ color based on location

  // X axis (time)
  svg
    .append("g")
    .attr("transform", `translate(0,${height - margin.bottom})`)
    .call(
      d3
        .axisBottom(x)
        .ticks(width / 80)
        .tickSizeOuter(0)
    );

  // Y axis (duration)
  svg
    .append("g")
    .attr("transform", `translate(${margin.left},0)`)
    .call(d3.axisLeft(y).ticks(5));
}

function drawHourlyChart(hourlyData) {
  d3.select("#hourly-chart").html(""); // Clear previous chart

  const width = 1000;
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
    .range(["#8a7b9f", "#b28f7e", "#6d948a"]);

  const svg = d3
    .select("#hourly-chart")
    .append("svg")
    .attr("width", width)
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
}

function drawPatternChart(sessionLog) {
  d3.select("#pattern-chart").html(""); // Clear previous chart

  const width = 1000;
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
    .range(["#8a7b9f", "#b28f7e", "#6d948a"]);

  const svg = d3
    .select("#pattern-chart")
    .append("svg")
    .attr("width", width)
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
    .attr("stroke-width", 2)
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
}

setInterval(fetchCatData, 3000);
fetchCatData();
populateDateFilter();
