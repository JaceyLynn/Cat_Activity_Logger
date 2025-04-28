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

    // Duration calculation
    const bedDurationSeconds = data.filter(
      (row) => row.event2 === "cat_detected"
    ).length;
    const windowDurationSeconds = data.filter(
      (row) => row.event1 === "cat_detected"
    ).length;
    const foodDurationSeconds = data.filter(
      (row) => row.event3 === "cat_detected"
    ).length;

    // Frequency calculation
    let bedFrequency = 0;
    let windowFrequency = 0;
    let foodFrequency = 0;

    for (let i = 1; i < data.length; i++) {
      if (
        data[i - 1].event2 === "nothing_detected" &&
        data[i].event2 === "cat_detected"
      ) {
        bedFrequency++;
      }
      if (
        data[i - 1].event1 === "nothing_detected" &&
        data[i].event1 === "cat_detected"
      ) {
        windowFrequency++;
      }
      if (
        data[i - 1].event3 === "nothing_detected" &&
        data[i].event3 === "cat_detected"
      ) {
        foodFrequency++;
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
