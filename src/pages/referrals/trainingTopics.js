// The walkthroughs a referral partner can read on the Training screen (client,
// 8 Sep: "add a box in the referral dashboard with title Training. They can
// access this box & view tutorials").
//
// This is a CATALOGUE, not the tutorial text. There is no training-content
// store in this platform — no table, no bucket, no upload screen — so the
// walkthroughs are WRITTEN INTO the product rather than uploaded as files or
// videos: the step text lives in the locale files under `refTraining`, and this
// list only says which topics exist, in what order, and how many steps each
// one runs to. That keeps the training translated into all nine languages for
// free, and it means a walkthrough is corrected by editing copy rather than by
// re-recording something.
//
// `steps` is therefore a COUNT, not content: the page reads
// refTraining.<key>Step1 … Step<steps>. Changing it here without adding the
// matching locale key would surface a raw key on screen, so the two move
// together.
//
// `color` is the box's accent on the Training grid. The grid reuses the
// dashboard's card, and that card takes its accent from the entry — so the
// colour lives with the topic rather than being computed from its index,
// which would reshuffle every box the moment one is inserted.
//
// `path` is the screen the walkthrough is actually about, so a partner who has
// just read it can be taken straight there instead of hunting for it in the
// sidebar.
// `video` and `pdf` are the client's 13 Sep request: two ways to take the same
// walkthrough, each labelled with how long it takes, hosted on certify.wiki
// rather than in this app. They are DATA, not copy — the URL is identical in
// every language — so they live here and only the button wording is translated.
//
// The wiki base is overridable so a staging deployment can point at a staging
// wiki without a code change.
//
// NOTE: the pages behind these slugs have to be published on certify.wiki
// before the buttons lead anywhere. Until the client supplies the recordings
// and the PDFs, the Training screen keeps working exactly as before — the
// buttons simply do not render for a topic with no `video`/`pdf` entry.
import {
  LayoutDashboard,
  UserPlus,
  Mail,
  FileText,
  Ticket,
  Wallet,
} from 'lucide-react';

export const WIKI_BASE = (
  import.meta.env.VITE_WIKI_BASE_URL || 'https://certify.wiki'
).replace(/\/+$/, '');

export function wikiUrl(slug) {
  return `${WIKI_BASE}/${String(slug).replace(/^\/+/, '')}`;
}

export const TRAINING_TOPICS = [
  {
    key: 'gettingStarted',
    video: { slug: 'referral/getting-started', minutes: 4 },
    pdf: { slug: 'referral/getting-started-pdf', minutes: 3 },
    color: '#8b5cf6',
    icon: LayoutDashboard,
    steps: 4,
    path: '/referral-dashboard',
  },
  {
    key: 'addClient',
    video: { slug: 'referral/adding-a-client', minutes: 5 },
    pdf: { slug: 'referral/adding-a-client-pdf', minutes: 4 },
    color: '#3ECF8E',
    icon: UserPlus,
    steps: 5,
    path: '/referrals',
  },
  {
    key: 'sendInvite',
    video: { slug: 'referral/sending-the-invitation', minutes: 3 },
    pdf: { slug: 'referral/sending-the-invitation-pdf', minutes: 3 },
    color: '#0ea5e9',
    icon: Mail,
    steps: 4,
    // Invites are sent from the Clients table row, not from a screen of their
    // own — the walkthrough has to say so or the partner looks for a menu item.
    path: '/referrals',
  },
  {
    key: 'sendProposal',
    video: { slug: 'referral/sending-a-proposal', minutes: 6 },
    pdf: { slug: 'referral/sending-a-proposal-pdf', minutes: 5 },
    color: '#f97316',
    icon: FileText,
    steps: 5,
    // Marketing Tools, not the Clients table: a proposal is composed there now
    // — pick the standard, tick the company profile and the brochure, send.
    // The walkthrough's steps name that screen, so the button has to open it.
    path: '/referrals/marketing',
  },
  {
    key: 'discountCode',
    video: { slug: 'referral/discount-code-and-link', minutes: 4 },
    pdf: { slug: 'referral/discount-code-and-link-pdf', minutes: 3 },
    color: '#ec4899',
    icon: Ticket,
    steps: 4,
    path: '/referrals/coupons',
  },
  {
    key: 'commissions',
    video: { slug: 'referral/commissions-and-payouts', minutes: 5 },
    pdf: { slug: 'referral/commissions-and-payouts-pdf', minutes: 4 },
    color: '#10b981',
    icon: Wallet,
    steps: 4,
    path: '/referrals/commissions',
  },
];
