// Reads CSV text (as Excel and Google Sheets save it) into rows of cells:
// commas separate cells, double quotes wrap cells that hold commas, quotes
// or line breaks, and "" inside quotes is one quote. Blank lines are
// dropped.
export const parseCsvText = (text: string): string[][] => {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let isQuoted = false;
  const source = text.replace(/^﻿/, "");

  const endRow = () => {
    row.push(cell);
    if (row.some((value) => value.trim() !== "")) rows.push(row);
    row = [];
    cell = "";
  };

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    if (isQuoted) {
      if (char === '"' && source[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else if (char === '"') {
        isQuoted = false;
      } else {
        cell += char;
      }
    } else if (char === '"') {
      isQuoted = true;
    } else if (char === ",") {
      row.push(cell);
      cell = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && source[index + 1] === "\n") index += 1;
      endRow();
    } else {
      cell += char;
    }
  }
  endRow();
  return rows;
};
