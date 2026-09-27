export interface Invoice {
  id: string;
  dateLabel: string;
  description: string;
}

export const invoices: Invoice[] = [
  { id: "1", dateLabel: "1 Mar 2027", description: "Standard plan · monthly" },
  { id: "2", dateLabel: "1 Feb 2027", description: "Standard plan · monthly" },
  { id: "3", dateLabel: "1 Jan 2027", description: "Standard plan · monthly" },
];
