// Absent in the guest demo, where writes are synchronous and session-only.
export type ContributionFormFeedback = { pending:boolean; saving:boolean; error:boolean; saved:boolean; retry:()=>void };
