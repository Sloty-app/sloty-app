/** Escapes user text so it matches literally inside a RegExp — raw input
 *  like "(" crashed searches with a 500, and crafted patterns could make
 *  the database (or Node) spend a long time backtracking. */
const escapeRegex = (s) => String(s).slice(0, 100).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

module.exports = { escapeRegex };
