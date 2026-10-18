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
  removalReason?: string | null; // live register only: why it was removed
  interimManager?: string | null; // live register only: date the Commission appointed an interim manager ('' if not given)
}

export interface Register {
  extractDate: string | null;
  live?: boolean; // read from the live register just now, not the daily download
  entries: Record<string, RegisterEntry>;
}
