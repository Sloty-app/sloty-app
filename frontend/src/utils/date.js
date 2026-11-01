/** IST date helpers — matches backend booking logic */
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

export const getISTNow = () => new Date(Date.now() + IST_OFFSET_MS);

export const getISTDateString = (date = new Date()) => {
  try {
    return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(date);
  } catch {
    const d = new Date((date instanceof Date ? date.getTime() : Date.now()) + IST_OFFSET_MS);
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, "0");
    const day = String(d.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }
};

// Real instants (now + i days), NOT shifted by the IST offset —
// getISTDateString() already converts to IST itself, so feeding it a
// pre-shifted date double-shifted it: from 6:30 PM IST the "Today" chip
// sent tomorrow's date and customers booked the wrong day.
export const getNext7Days = () =>
  Array.from({ length: 7 }, (_, i) => new Date(Date.now() + i * 24 * 60 * 60 * 1000));

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
 * IST calendar field getters for real instants (e.g. from getNext7Days()).
 * Use these instead of d.getDay()/getDate()/getMonth(), which read the
 * browser's own timezone — wrong for anyone not on IST. Shifting by the
 * IST offset and reading UTC fields gives the date as it is in India,
 * the same day getISTDateString() sends to the API.
 */
const toISTFields = (date) => new Date(date.getTime() + IST_OFFSET_MS);
export const getISTDay = (date) => toISTFields(date).getUTCDay();
export const getISTDateNum = (date) => toISTFields(date).getUTCDate();
export const getISTMonthIdx = (date) => toISTFields(date).getUTCMonth();