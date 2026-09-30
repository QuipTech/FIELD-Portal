import type { CasePerson } from "./supportCase";

export interface CaseMessage {
  id: string;
  body: string;
  createdAt: string;
  // null once the author's account is deleted.
  author: CasePerson | null;
  // The case reporter's messages are "reporter"; everyone else is support.
  authorRole: "reporter" | "support";
}
