// ============================================
// Certify.cx — Shareable Links: Stakeholder Types
// ============================================

export const STAKEHOLDER_TYPES = {
  'certification-body': {
    id: 'certification-body',
    title: 'Certification Bodies',
    singularTitle: 'Certification Body',
    role: 'certification_body',
    icon: 'Award',
    color: '#8B5CF6',
    description: 'Partner with CertifyCX as an accredited certification body to provide ISO certification services to our growing client base.',
    benefits: [
      'Access to a growing pool of clients seeking ISO certification',
      'Streamlined audit management and scheduling tools',
      'Digital certificate issuance and tracking',
      'Integrated compliance reporting dashboard',
      'Expanded market reach across multiple regions',
    ],
    rules: [
      'Must be an accredited certification body recognized by relevant accreditation bodies',
      'Comply with ISO/IEC 17021 requirements for management system certification',
      'Maintain strict impartiality and confidentiality standards',
      'Follow CertifyCX platform guidelines and service level agreements',
      'Provide timely audit reports and certification decisions',
    ],
  },
  'consultancy': {
    id: 'consultancy',
    title: 'Consultancies',
    singularTitle: 'Consultancy',
    // A consultancy brings clients to the platform and earns on them — the same
    // shape as a referral partner, not a company seeking its own certificate.
    // On the `client` role it got the certification menu (New Application, My
    // Certificates, the Gap Analysis prompt) and NO way to add or track the
    // clients it introduced. Client instruction, 19 Jul: "Consultancy can have
    // the same process features as Referral/Affiliate."
    role: 'referral',
    icon: 'Briefcase',
    color: '#F59E0B',
    description: 'Join CertifyCX as a consultancy partner and help organizations achieve ISO certification with expert guidance.',
    benefits: [
      'Connect with businesses seeking ISO certification guidance',
      'Access platform tools for managing client engagements',
      'Build your reputation through verified client outcomes',
      'Receive referrals from our growing network',
      'Collaborate with certification bodies directly on the platform',
    ],
    rules: [
      'Must have relevant industry experience in ISO management systems',
      'Maintain professional conduct and ethical standards',
      'Provide accurate and honest guidance to clients',
      'Comply with CertifyCX platform terms and conditions',
      'Keep all client information strictly confidential',
    ],
  },
  'referral': {
    id: 'referral',
    title: 'Referral',
    singularTitle: 'Referral',
    role: 'referral',
    icon: 'Gift',
    color: '#EC4899',
    description: 'Earn 10% commission by referring clients to CertifyCX. Referred clients get 10% off their first purchase!',
    benefits: [
      'Earn 10% commission on every successful referral',
      'Your referrals get 10% discount on their purchase',
      'No limit on the number of referrals you can make',
      'Track your referrals and earnings in real-time on your dashboard',
      'Commission paid directly to your bank account',
    ],
    rules: [
      'Referral commission is 10% of the sale amount after discount',
      'Commission is paid after successful payment by the referred client',
      'Payouts are processed manually — send your bank details when notified via email',
      'Self-referrals are not permitted',
      'Each referred client can only be linked to one referrer',
    ],
  },
  'client': {
    id: 'client',
    title: 'Clients',
    singularTitle: 'Client',
    role: 'client',
    icon: 'Building2',
    color: '#10B981',
    description: 'Apply for ISO certification through CertifyCX and streamline your certification journey from application to approval.',
    benefits: [
      'Simple online application process for ISO certifications',
      'Track your certification status in real-time',
      'Access gap analysis tools to prepare for audits',
      'Choose from multiple ISO standards (9001, 14001, 45001, 22000)',
      'Flexible payment options — monthly or one-time',
    ],
    rules: [
      'Provide accurate company and contact information during registration',
      'Cooperate with assigned auditors during the certification process',
      'Maintain compliance with your certified management systems',
      'Notify CertifyCX of any significant changes to your management system',
      'Timely payment of certification fees as per your chosen plan',
    ],
  },
  'auditor': {
    id: 'auditor',
    title: 'Auditors',
    singularTitle: 'Auditor',
    role: 'auditor',
    icon: 'UserCheck',
    color: '#3B82F6',
    description: 'Join CertifyCX as a certified auditor and conduct ISO audits for organizations worldwide.',
    benefits: [
      'Get assigned to audit engagements across multiple regions',
      'Manage audit schedules and reports through the platform',
      'Build your professional profile and track record',
      'Collaborate with certification bodies seamlessly',
      'Flexible engagement — work on audits that match your expertise',
    ],
    rules: [
      'Must hold relevant auditor qualifications (e.g., ISO 19011 trained)',
      'Maintain independence and objectivity during all audits',
      'Submit audit reports within the agreed timelines',
      'Follow CertifyCX audit protocols and reporting standards',
      'Keep all audit findings and client information confidential',
    ],
  },
  'investor': {
    id: 'investor',
    title: 'Investors',
    singularTitle: 'Investor',
    role: 'client',
    icon: 'TrendingUp',
    color: '#6366F1',
    description: 'Explore investment opportunities with CertifyCX — the future of digital ISO certification management.',
    benefits: [
      'Growing market — ISO certification demand is increasing globally',
      'Scalable SaaS platform with recurring revenue model',
      'Multi-region presence with expansion potential',
      'Strong unit economics with low customer acquisition cost',
      'Access to detailed business metrics and growth reports',
    ],
    rules: [
      'Investment inquiries are subject to due diligence processes',
      'All financial information shared is strictly confidential',
      'Investment terms are subject to negotiation and mutual agreement',
      'Comply with applicable securities and investment regulations',
      'Contact the CertifyCX team at mvpcertify@gmail.com for detailed proposals',
    ],
  },
};

/** Get a stakeholder type config by its slug */
export function getStakeholderType(slug) {
  return STAKEHOLDER_TYPES[slug] || null;
}

/** Get all stakeholder type slugs */
export function getStakeholderSlugs() {
  return Object.keys(STAKEHOLDER_TYPES);
}
