// The letters a referral partner can send, described for the Ready Email
// Templates screen (client, 6 Sep).
//
// This is a CATALOGUE, not the copy itself. The letters are composed
// server-side in api/_emailTemplates.js and api/_outreachCopy.js, and they stay
// there for a reason the client asked for directly:
//
//   "Proposals should be centrally generated and controlled. The Referral
//    Partner should not create proposals manually in Word or PDF."
//
// So this screen shows a partner WHAT each letter is, what it carries and where
// to send it from — it does not hand them an editable body. Keeping the text
// server-side is also what lets the letter change for every partner at once
// without a partner having to be told to update their copy.
//
// `sendPath` is where the partner actually presses send, so the preview card
// can take them there instead of describing a screen they then have to find.
export const READY_TEMPLATES = [
  {
    key: 'invite',
    // Sent per added client from the Clients table's "Send Invite" button.
    sendPath: '/referrals',
    carriesAttachment: false,
    carriesDiscountCode: true,
  },
  {
    key: 'proposal',
    // The standard-specific proposal letter. Attaches that standard's briefing
    // document when one has been uploaded — the ISO 21001 note for a school or
    // university being the client's own worked example.
    sendPath: '/referrals',
    carriesAttachment: true,
    carriesDiscountCode: false,
  },
];
