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
import {
  LayoutDashboard,
  UserPlus,
  Mail,
  FileText,
  Ticket,
  Wallet,
} from 'lucide-react';

export const TRAINING_TOPICS = [
  {
    key: 'gettingStarted',
    color: '#8b5cf6',
    icon: LayoutDashboard,
    steps: 4,
    path: '/referral-dashboard',
  },
  {
    key: 'addClient',
    color: '#3ECF8E',
    icon: UserPlus,
    steps: 5,
    path: '/referrals',
  },
  {
    key: 'sendInvite',
    color: '#0ea5e9',
    icon: Mail,
    steps: 4,
    // Invites are sent from the Clients table row, not from a screen of their
    // own — the walkthrough has to say so or the partner looks for a menu item.
    path: '/referrals',
  },
  {
    key: 'sendProposal',
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
    color: '#ec4899',
    icon: Ticket,
    steps: 4,
    path: '/referrals/coupons',
  },
  {
    key: 'commissions',
    color: '#10b981',
    icon: Wallet,
    steps: 4,
    path: '/referrals/commissions',
  },
];
