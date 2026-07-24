/** India Standard Time helpers — keep booking "today" consistent across the app */
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

const getISTNow = () => new Date(Date.now() + IST_OFFSET_MS);

const getISTDateString = (date = getISTNow()) => {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

const addDaysIST = (days) => {
  const d = getISTNow();
  d.setUTCDate(d.getUTCDate() + days);
  return getISTDateString(d);
};

module.exports = { getISTNow, getISTDateString, addDaysIST };
