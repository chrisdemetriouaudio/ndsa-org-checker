/** The few register fields we keep for each of our charities. */
export interface RegisterEntry {
  number: string;
  name: string;
  status: string; // "Registered" | "Removed"
  removedOn: string | null;
  reporting: string | null; // e.g. "Submission Received", "Submission Overdue"
  lastAccounts: string | null; // end of the latest financial year filed
  insolvent: boolean;
  inAdministration: boolean;
  dissolved: boolean;
  web: string | null; // website the charity gave the register
}

export interface Register {
  extractDate: string | null;
  entries: Record<string, RegisterEntry>;
}
