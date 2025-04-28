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
    let lastBedStatus = null;
    let lastWindowStatus = null;
    let lastFoodStatus = null;

    // Flags to monitor if we're waiting for a second "cat_detected"
    let bedAwaitingSecondCat = false;
    let windowAwaitingSecondCat = false;
    let foodAwaitingSecondCat = false;

    for (let i = 0; i < data.length; i++) {
      const row = data[i];

      // --- Bed ---
      if (row.event2) {
        if (
          lastBedStatus === "nothing_detected" &&
          row.event2 === "cat_detected"
        ) {
          bedAwaitingSecondCat = true; // waiting for a second "cat_detected"
        } else if (bedAwaitingSecondCat && row.event2 === "cat_detected") {
          bedFrequency++; // now confirm the session
          bedAwaitingSecondCat = false; // reset
        } else if (bedAwaitingSecondCat && row.event2 === "nothing_detected") {
          bedAwaitingSecondCat = false; // cat left immediately — no session
        }
        lastBedStatus = row.event2;
      }

      // --- Window ---
      if (row.event1) {
        if (
          lastWindowStatus === "nothing_detected" &&
          row.event1 === "cat_detected"
        ) {
          windowAwaitingSecondCat = true;
        } else if (windowAwaitingSecondCat && row.event1 === "cat_detected") {
          windowFrequency++;
          windowAwaitingSecondCat = false;
        } else if (
          windowAwaitingSecondCat &&
          row.event1 === "nothing_detected"
        ) {
          windowAwaitingSecondCat = false;
        }
        lastWindowStatus = row.event1;
      }

      // --- Food Bowl ---
      if (row.event3) {
        if (
          lastFoodStatus === "nothing_detected" &&
          row.event3 === "cat_detected"
        ) {
          foodAwaitingSecondCat = true;
        } else if (foodAwaitingSecondCat && row.event3 === "cat_detected") {
          foodFrequency++;
          foodAwaitingSecondCat = false;
        } else if (foodAwaitingSecondCat && row.event3 === "nothing_detected") {
          foodAwaitingSecondCat = false;
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
      foodFrequency
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
  foodFrequency
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

setInterval(fetchCatData, 3000);
fetchCatData();
