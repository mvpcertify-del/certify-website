// Affiliate training for Certify.wiki(TM) (client task, 28 Nov 2026).
//
// Lives in the database (training_modules, see supabase/phase55_affiliate_training.sql), NOT in the Certify.wiki(TM)
// JavaScript bundle, so only a signed-in affiliate can read it. This file is the source: edit it and re-run
//   node scripts/seed-affiliate-training.mjs
//
// Client rule: always write Certify.cx(TM) and Certify.wiki(TM) with the TM mark. Use the constants below.
//
// Block types: p (paragraph) | steps (numbered) | list (bullets) | tip | warn
// Facts here match the product as built: letters are written and sent centrally by Certify.cx(TM) (an affiliate
// cannot edit the wording), the discount code is inside every letter, a commission is credited when the client has paid,
// and the commission rate is shown on the Credit Earned screen. No percentages, prices or guarantees are invented.

const CX = 'Certify.cx™';
const WIKI = 'Certify.wiki™';

const p = (text) => ({ t: 'p', text });
const steps = (...items) => ({ t: 'steps', items });
const list = (...items) => ({ t: 'list', items });
const tip = (text) => ({ t: 'tip', text });
const warn = (text) => ({ t: 'warn', text });
const q = (question, options, answer, why) => ({ q: question, options, answer, why });

export const MODULES = [
  {
    slug: 'getting-started',
    position: 1,
    title: `Welcome to the ${CX} affiliate programme`,
    summary: `What you do as an affiliate, how your account works across ${CX} and ${WIKI}, and where to begin.`,
    minutes: 8,
    lessons: [
      {
        title: 'What an affiliate does',
        blocks: [
          p(`As an affiliate you introduce organisations that need ISO certification to ${CX}. ${CX} guides each client from gap analysis to an audit by an independent, accredited certification body. You earn a commission when a client you introduced has paid.`),
          p(`You do not issue certificates, run audits or promise a result. Your job is to find the right organisations, start the conversation and register them properly so the introduction is credited to you.`),
          list('Find organisations that need or are asked for ISO certification', 'Register them as clients in your dashboard', 'Send the ready letters and book meetings', 'Follow up until they buy or decline'),
        ],
      },
      {
        title: `One account for ${CX} and ${WIKI}`,
        blocks: [
          p(`You register once on ${CX}. The same email and password sign you in to the Academy on ${WIKI}. There is no second registration.`),
          steps(`Register as an affiliate on ${CX} and sign the affiliate agreement.`, `Open ${WIKI} and choose Academy, then sign in with the same details.`, `Take the modules in order. Your progress is saved to your account.`),
          tip(`${WIKI} is the knowledge hub. Anything that involves clients, letters or money happens in your ${CX} dashboard.`),
        ],
      },
      {
        title: 'Your Affiliate Program Dashboard',
        blocks: [
          p(`Open the Affiliate Program Dashboard from the sidebar of ${CX}. It is your home screen. Each box opens one area:`),
          list('Clients: add the companies you introduce and track each one', 'Marketing Tools: send letters that already carry your discount code', 'Ready Email Templates: see what each letter says before you send it', 'Coupons to share: your discount code and referral link', 'Credit Earned and Sales Generated: what you have earned and what your clients have paid', 'Training: short walkthroughs inside the dashboard'),
          warn('If your account is still awaiting approval you can prepare everything, but letters cannot be sent until an administrator approves you.'),
        ],
      },
    ],
    quiz: [
      q('When is an affiliate commission credited?', ['When the client is invited', 'When the client has paid for certification', 'When the client replies to an email'], 1, 'A commission is credited once the client has paid, not when they are invited.'),
      q(`How many registrations do you need for ${CX} and ${WIKI}?`, ['One, the same login works on both', 'Two, one for each site'], 0, `You register once on ${CX}; the same details sign you in to the ${WIKI} Academy.`),
    ],
  },

  {
    slug: 'registering-leads',
    position: 2,
    title: `Registering leads and clients in your ${CX} dashboard`,
    summary: 'Add a client, send the invitation, and share your discount code so the sale is credited to you.',
    minutes: 12,
    lessons: [
      {
        title: 'Before you register a lead',
        blocks: [
          p('Register a lead only after you have identified a real organisation and a named person to contact. Registering is what ties the introduction to you.'),
          list('Contact person: first and last name', 'The email address you will write to', 'Company name, so letters address the organisation and not only the person', 'WhatsApp number and website: optional, add them if you have them'),
          warn('You cannot register your own email address, and an email you already registered cannot be added twice.'),
        ],
      },
      {
        title: 'Adding a client',
        blocks: [
          steps('Open the Clients screen and press Add Client.', 'Enter the contact person’s first and last name and the email address.', 'Add the company name.', 'Add the WhatsApp number and website if you have them.', 'Save. The client appears in your table, linked to your account.'),
          tip('Check the spelling of the email before you save. Every letter goes to that address.'),
        ],
      },
      {
        title: 'Sending the invitation email',
        blocks: [
          p(`Invitations are sent from the client’s row in your Clients table. The letter goes out from ${CX} with your discount code already inside, so you write and attach nothing.`),
          steps('Find the client in your Clients table.', 'Press Send Invite on that row.', 'The row updates to show the invite was sent, so you can see who is still waiting to hear from you.'),
          p('Send an invitation to someone you have already spoken to. For an organisation you are approaching cold, use the standard proposal letter instead (next module).'),
        ],
      },
      {
        title: 'Your discount code and referral link',
        blocks: [
          p('Open Coupons to share to see the code and referral link issued to you. The code gives the client a discount on their certification fee, which is a reason for them to use it.'),
          steps('Share it by sending the invitation email, or copy the link into your own message.', 'When a client buys using your code or link, the sale is credited to you and your commission is calculated from it.'),
          warn('Never tell a client the discount is bigger than what the code gives. The code and the amount are shown on your Coupons screen.'),
        ],
      },
      {
        title: 'Reading your client table',
        blocks: [
          p('Each client shows a status: pending (invited or added), signed up (created an account) or converted (paid). Converted clients no longer need invitations or proposals, so those buttons are hidden for them.'),
          p('From the same row you can also open the Meetings log. The module on meetings and results covers it.'),
        ],
      },
    ],
    quiz: [
      q('Where do you send an invitation email from?', ['The Marketing Tools screen only', 'The client’s row in the Clients table', 'Your own email app'], 1, 'Invitations are sent from the Send Invite button on the client’s row.'),
      q('Does the invitation email already contain your discount code?', ['Yes, automatically', 'No, you must paste it', 'Only if the client asks'], 0, 'The letter is written and sent by the platform with your code inside.'),
      q('When does a client count as converted?', ['After a meeting', 'After they sign up', 'After they have paid'], 2, 'Converted means the client has paid.'),
    ],
  },

  {
    slug: 'email-templates',
    position: 3,
    title: `Using the ready email templates for clients in different countries`,
    summary: 'Which letter to send, when, and how to adapt your approach to each country and type of client.',
    minutes: 12,
    lessons: [
      {
        title: 'The two ready letters',
        blocks: [
          p(`${CX} gives you two ready letters. They are written and sent centrally under the ${CX} name, so you do not type or edit the wording. This keeps the message accurate and consistent for every client.`),
          list('Client invitation: a short introduction with your discount code and a link straight to checkout. Send it to a client you have already spoken to.', 'Standard proposal letter: a formal proposal for one named standard, with a briefing document attached. Send it to an organisation you are approaching cold.'),
          p('Open Ready Email Templates in your dashboard to read the subject and description of each before you use it.'),
        ],
      },
      {
        title: 'Sending a standard proposal',
        blocks: [
          steps('Open Marketing Tools and choose the client you are writing to.', 'Choose the ISO standard the proposal is about.', 'Tick whether to attach the company profile, the standard’s brochure, or both.', 'Say whether the company already holds a certification. The letter is worded differently if it does.', 'Press Send now. The letter leaves under the Certify.cx™ name with your discount code inside.'),
          warn('If a brochure is not yet uploaded for a standard, the letter is sent without it and you are told. Do not promise an attachment the system could not include.'),
        ],
      },
      {
        title: 'Targeting clients in different countries',
        blocks: [
          p('The wording of the letters is fixed, so you adapt WHO you write to, WHICH standard you choose and WHEN, and what you say on the phone or in your own messages. Use these as starting points and always check the client’s own situation.'),
          list(
            'Gulf and Middle East: organisations often meet certification requirements through tenders and supplier registration. Lead with ISO 9001 and ISO 45001, and ask which tenders or customers require it.',
            'South Asia: many exporters and manufacturers are asked for ISO 9001 or ISO 14001 by overseas buyers. Ask which buyer is asking and by when.',
            'Africa: growing companies, contractors and service firms want credibility with larger clients and funders. Keep the message practical and about the next step.',
            'Europe and other regulated markets: ISO 27001 and ISO 14001 questions often come from customers’ security and sustainability reviews. Ask who is asking.',
          ),
          tip('Ask a real question in your own first message: "Which customer or tender is asking you for ISO?" A specific reason to certify is the best sign a lead will convert.'),
          warn('These are general patterns, not promises about any country or regulator. Never state that a particular certificate is legally required unless the client has shown you the requirement.'),
        ],
      },
      {
        title: 'Choosing the right standard',
        blocks: [
          list('ISO 9001: quality management, the most common starting point', 'ISO 14001: environmental management', 'ISO 45001: occupational health and safety', 'ISO/IEC 27001: information security'),
          p(`If you are unsure, send the client to the free gap analysis on ${CX}. It helps them see which standard fits and what is missing.`),
        ],
      },
      {
        title: 'Timing and follow-up',
        blocks: [
          steps('Send the letter, then note the date in the meeting log on that client.', 'If there is no reply, follow up once by phone or WhatsApp after a few days, using your own words.', 'Offer a short meeting. The next module shows how to book it.'),
          tip('One polite follow-up is professional. Repeated messages damage the introduction and the brand.'),
        ],
      },
    ],
    quiz: [
      q('Can an affiliate edit the wording of the ready letters?', ['Yes, in Marketing Tools', 'No, they are written and sent centrally'], 1, 'Letters are centrally controlled so every client gets accurate, consistent wording.'),
      q('Which letter suits an organisation you are approaching cold?', ['Client invitation', 'Standard proposal letter'], 1, 'The proposal letter is for cold approaches; the invitation is for someone you have already spoken to.'),
      q('How do you adapt your approach to a country?', ['Edit the letter text', 'Choose the right client, standard and timing, and ask what is driving the need', 'Promise a faster certificate'], 1, 'You adapt who, which standard, when, and your own conversation. Never promise outcomes.'),
    ],
  },

  {
    slug: 'meetings-and-crm',
    position: 4,
    title: `Booking meetings with Calendly and recording results`,
    summary: `Book client meetings with the ${CX} booking link and keep the result of every meeting on the client’s record.`,
    minutes: 10,
    lessons: [
      {
        title: 'Why you log every meeting',
        blocks: [
          p(`Your Clients screen is your CRM: one row per client, with a meeting log behind it. Recording each step lets you see who needs a follow-up and lets ${CX} support your clients properly.`),
          p('Administrators can see the log, so write notes you would be comfortable having read: facts and next steps, not opinions about people.'),
        ],
      },
      {
        title: 'Booking a meeting with Calendly',
        blocks: [
          steps('Agree a short call with the client by phone, WhatsApp or email.', 'On the Clients screen press Book a meeting. This opens the booking link set by Certify.cx™.', 'Send the link to the client, or open it with them, and let them choose a time that suits them.', 'Calendly confirms the booking to both sides.', 'Log it straight away: open the client’s Meetings and add the stage Meeting booked with the date and time.'),
          warn('If you do not see a Book a meeting button, the link has not been set yet. Ask your administrator. Do not use a personal calendar link for Certify.cx™ clients.'),
        ],
      },
      {
        title: 'Recording the result',
        blocks: [
          p('After each step, add an entry to the client’s meeting log. Use the stage that matches what happened:'),
          list('Contacted: you reached out', 'Meeting booked: a time is fixed', 'Meeting held: the meeting took place', 'No show: the client did not attend, so you can rebook', 'Proposal sent: a proposal letter has gone out', 'Won: the client has decided to go ahead', 'Lost: the client declined, with the reason in the notes'),
          steps('Open Meetings on the client’s row.', 'Choose the stage and the date, and write one or two lines of notes.', 'Save. The newest entry shows on the row, so you can see where every client stands.'),
        ],
      },
      {
        title: 'What good notes look like',
        blocks: [
          list('What the client needs: which standard and why now', 'Who decides and by when', 'Their concern, such as price or timing', 'The next step and the date you will do it'),
          tip('Write the next step before you close the entry. "Send proposal for ISO 9001 on Thursday" is a note. "Went well" is not.'),
        ],
      },
    ],
    quiz: [
      q('Where do you record the result of a client meeting?', ['In your own notebook', 'In the meeting log on the client’s row in your Clients screen', 'In an email to yourself'], 1, 'The meeting log is the record; the newest entry shows on the row.'),
      q('A client did not attend. Which stage do you log?', ['Lost', 'No show', 'Won'], 1, 'No show lets you rebook; Lost is only for a client who has declined.'),
    ],
  },

  {
    slug: 'know-the-services',
    position: 5,
    title: `Know the ${CX} services and ISO standards`,
    summary: 'Explain ISO certification clearly and accurately in two minutes.',
    minutes: 12,
    lessons: [
      {
        title: 'ISO certification in plain words',
        blocks: [
          p('ISO standards are internationally recognised frameworks for how an organisation manages quality, environment, safety or information security. Certification means an independent, accredited certification body has audited the organisation and confirmed it meets the standard.'),
          p(`${CX} helps the organisation get ready and apply. The audit and the certification decision are made by the certification body, not by ${CX} and not by you.`),
        ],
      },
      {
        title: 'The four main standards',
        blocks: [
          list('ISO 9001: quality management. Consistent products and services, customer satisfaction.', 'ISO 14001: environmental management. Control environmental impact and meet legal requirements.', 'ISO 45001: occupational health and safety. Prevent work-related injury and ill health.', 'ISO/IEC 27001: information security. Protect data through risk management.'),
          p(`Each has a guide in the Standards library on ${WIKI}. Read the one that matches the client before you speak to them.`),
        ],
      },
      {
        title: 'The client journey',
        blocks: [
          steps('Inquiry: the client tells us about the organisation and the standard they need.', 'Gap analysis: a comparison of current practice with the standard.', 'Documentation: policies, procedures and records are put in place.', 'Implementation: the team runs the system and keeps evidence.', 'Audit and certification: an accredited certification body audits and issues the certificate.'),
          p('A certificate is typically valid for three years with surveillance audits in between. Always say the certification body confirms the exact details.'),
        ],
      },
      {
        title: 'What you can and cannot say',
        blocks: [
          list('You can say: we guide the client through to an independent audit', 'You can say: the certificate is issued by an independent accredited certification body', 'You can say: the free gap analysis shows what is missing'),
          warn('Never promise a certificate, a pass, a date or a price that is not in writing from Certify.cx™. Never say a certificate is guaranteed.'),
        ],
      },
    ],
    quiz: [
      q('Who issues the ISO certificate?', ['Certify.cx™', 'An independent accredited certification body', 'The affiliate'], 1, 'Audits and the certification decision belong to the independent certification body.'),
      q('Which statement is safe to make to a client?', ['You will definitely pass first time', 'We guide you through to an independent audit', 'The certificate takes exactly 30 days'], 1, 'Never promise a result, date or price you cannot show in writing.'),
    ],
  },

  {
    slug: 'first-conversation',
    position: 6,
    title: 'The first conversation: finding and qualifying clients',
    summary: 'Who to approach, what to ask and how to open the conversation professionally.',
    minutes: 10,
    lessons: [
      {
        title: 'Who to approach',
        blocks: [
          list('Organisations asked for ISO by a customer, tender or regulator', 'Growing businesses that want to win larger contracts', 'Suppliers and exporters', 'Companies handling customer data that need to show security assurance'),
          tip('Start with people you already know or have worked with. A warm introduction converts far better than a cold message.'),
        ],
      },
      {
        title: 'Opening the conversation',
        blocks: [
          steps('Say who you are and that you work with Certify.cx™ on ISO certification.', 'Ask one question about their situation: which customer, tender or goal is behind it?', 'Listen, then explain in one sentence how Certify.cx™ helps.', 'Offer a next step: the free gap analysis, or a short meeting.'),
          p('Keep your first message under five lines. Make it easy to answer.'),
        ],
      },
      {
        title: 'Qualifying questions',
        blocks: [
          list('Which standard do they need, and why now?', 'Do they hold any certification today?', 'How many people and sites do they have?', 'Who decides, and by when?'),
          p('Record the answers in the meeting log so the next conversation starts where this one stopped.'),
        ],
      },
    ],
    quiz: [
      q('What should the first message do?', ['Explain every service in detail', 'Ask one clear question and offer a next step', 'Quote a price'], 1, 'Short, specific, and easy to answer.'),
    ],
  },

  {
    slug: 'objections',
    position: 7,
    title: 'Handling common objections',
    summary: 'Calm, honest answers to the questions clients ask most.',
    minutes: 10,
    lessons: [
      {
        title: 'A simple way to respond',
        blocks: [
          steps('Listen to the whole concern.', 'Acknowledge it: "That is a fair question."', 'Answer honestly with facts you can support.', 'Offer a next step, such as the free gap analysis.'),
          warn('If you do not know the answer, say so and check. Never invent a fact to close a lead.'),
        ],
      },
      {
        title: 'Common objections',
        blocks: [
          list(
            '"It is too expensive": agree it is an investment, ask what certification would unlock (tenders, customers), and point to the discount code on the invitation. Do not promise a price you cannot show.',
            '"We are too small": ISO standards scale to the size of the organisation. The effort matches the organisation.',
            '"We already have a certificate": ask who issued it, when it expires and whether they need another standard or a transition.',
            '"We do not have time": the free gap analysis is a quick first step and shows what is really needed.',
            '"How do I know it is real?": the audit is done by an independent accredited certification body, not by us.',
          ),
        ],
      },
      {
        title: 'When to walk away',
        blocks: [
          p('If a client clearly says no, thank them, log it as Lost with the reason, and move on. A respectful exit leaves the door open for later.'),
        ],
      },
    ],
    quiz: [
      q('A client says "it is too expensive". What do you do?', ['Promise a lower price', 'Acknowledge, ask what certification would unlock, and offer the gap analysis', 'End the conversation'], 1, 'Stay honest and specific; never promise a price you cannot show in writing.'),
    ],
  },

  {
    slug: 'marketing-certify',
    position: 8,
    title: `Marketing ${CX} on LinkedIn, WhatsApp and email`,
    summary: 'Share the brand correctly and build trust without spamming.',
    minutes: 12,
    lessons: [
      {
        title: 'Brand rules',
        blocks: [
          list(`Always write ${CX} and ${WIKI} with the ™ mark`, `Use the logo and documents from the Marketing library in your dashboard, not copies you made`, 'Do not create your own proposals in Word or PDF. Proposals are generated centrally.', `Do not change the look or wording of ${CX} material`),
        ],
      },
      {
        title: 'LinkedIn',
        blocks: [
          steps('Say what you do in your profile: you help organisations get ISO certified with Certify.cx™.', `Share useful guides from ${WIKI} (for example a standard guide or the glossary) rather than only adverts.`, 'Connect with people who have a reason to need ISO, then message them individually with a real question.'),
          tip(`A post that explains one ISO term clearly and links to ${WIKI} builds more trust than a sales post.`),
        ],
      },
      {
        title: 'WhatsApp and email',
        blocks: [
          list('Message people who know you or who have asked', 'Keep messages short and personal', 'Never send bulk or unsolicited mass messages. It harms the brand and may break the rules in some countries.', 'Use the ready letters from your dashboard for email'),
          warn('Do not add people to groups or lists without their permission.'),
        ],
      },
      {
        title: 'Content ideas that work',
        blocks: [
          list('Explain one ISO term a week from the glossary', 'Share a standard guide and ask who in your network needs it', 'Post a short checklist: "5 records auditors ask for"', 'Invite people to the free gap analysis'),
        ],
      },
    ],
    quiz: [
      q('May you create your own proposal documents?', ['Yes, in Word', 'No, proposals are generated centrally'], 1, 'Proposals are centrally controlled and sent from Marketing Tools.'),
      q('Which is better for trust?', ['Mass messages to every contact', 'Useful guides and individual, relevant messages'], 1, 'Useful content and relevant messages build trust and protect the brand.'),
    ],
  },

  {
    slug: 'commissions-and-compliance',
    position: 9,
    title: 'Commissions, payouts and professional conduct',
    summary: 'How you earn, how you are paid, and the rules every affiliate follows.',
    minutes: 8,
    lessons: [
      {
        title: 'How you earn',
        blocks: [
          steps('Open Credit Earned to see every referred client and what each one has earned you.', 'A commission is credited once the client has paid for their certification, not when they are invited.', 'Your rate rises as you bring in more paid clients. Your current tier and the next one are shown on the same screen.', 'Commission that has been paid out and commission still owed are listed separately.'),
          p('Your own rate and tier are always shown on the Credit Earned screen. Use that screen as the source, not figures from conversations.'),
        ],
      },
      {
        title: 'Conduct and compliance',
        blocks: [
          list('Be honest: no guarantees, no invented figures', 'Respect privacy: use a client’s details only to introduce them to Certify.cx™', 'Follow the affiliate agreement you signed', 'Report problems to your administrator promptly'),
          warn('Misleading a client or sending spam can end your affiliate account.'),
        ],
      },
      {
        title: 'Finishing the Academy',
        blocks: [
          p(`When you complete all modules and pass each short quiz, your progress shows as complete in the ${WIKI} Academy. Revisit any module whenever you need a refresher.`),
        ],
      },
    ],
    quiz: [
      q('Where do you check your commission rate and tier?', ['Ask the client', 'The Credit Earned screen in your dashboard', 'Social media'], 1, 'Your own rate and tier are shown on Credit Earned.'),
      q('Which action can end an affiliate account?', ['Sending a follow-up message', 'Misleading a client or sending spam', 'Asking a question'], 1, 'Honest, respectful conduct is required.'),
    ],
  },
];
