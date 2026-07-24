/** IST date helpers — matches backend booking logic */
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

export const getISTNow = () => new Date(Date.now() + IST_OFFSET_MS);

export const getISTDateString = (date = getISTNow()) => {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

export const getNext7Days = () =>
  Array.from({ length: 7 }, (_, i) => {
    const d = getISTNow();
    d.setUTCDate(d.getUTCDate() + i);
    return new Date(d.getTime());
  });

export const formatDisplayDate = (dateStr) => {
  try {
    return new Date(dateStr + "T12:00:00").toLocaleDateString("en-IN", {
      weekday: "short", day: "numeric", month: "short",
    });
  } catch {
    return dateStr;
  }
};

/**
 * IST-safe calendar field getters.
 * Use these instead of d.getDay()/getDate()/getMonth() on dates returned
 * by getNext7Days() — those dates are constructed by shifting the epoch
 * forward by the IST offset, so reading them with LOCAL getters
 * (which apply the browser's own timezone on top) double-shifts the
 * result. Always decode with the UTC getters instead — that matches
 * how getISTDateString() reads the same dates for the API calls.
 */
export const getISTDay = (date) => date.getUTCDay();
export const getISTDateNum = (date) => date.getUTCDate();
export const getISTMonthIdx = (date) => date.getUTCMonth();