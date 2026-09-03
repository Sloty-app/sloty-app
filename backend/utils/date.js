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

// A plain "YYYY-MM-DD" from an <input type="date"> has no timezone of
// its own — new Date("2026-09-03") parses it as UTC midnight, which is
// 5:30am IST, not midnight IST. Left uncorrected, an offer's end date
// of "today" expires at 5:30am IST instead of the end of that day,
// silently killing the offer for the rest of the day it was meant to
// still be valid — exactly the kind of gap that makes "I made this
// offer just now and it's not applying" happen. These convert an IST
// calendar date to the actual UTC instant its start/end represents.
const istDateStringToUtcStart = (dateStr) =>
  new Date(new Date(`${dateStr}T00:00:00.000Z`).getTime() - IST_OFFSET_MS);

const istDateStringToUtcEnd = (dateStr) =>
  new Date(new Date(`${dateStr}T23:59:59.999Z`).getTime() - IST_OFFSET_MS);

module.exports = { getISTNow, getISTDateString, addDaysIST, istDateStringToUtcStart, istDateStringToUtcEnd };
