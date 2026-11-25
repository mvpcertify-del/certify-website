// SEO landing pages for the four flagship standards (client brief, 26 Nov 2026):
//   ISO 9001:2026, ISO 14001:2026, ISO 45001, ISO/IEC 27001, to rank in organic search and in AI answers.
// One template (pages/iso/IsoStandardLanding.jsx) renders every entry, so a new standard is one more entry here.
//
// The "display" code is the marketing edition the client asked for (9001:2026, 14001:2026). It is NOT the same as
// utils/isoCatalog.js `fullCode`, which is what checkout, invoices and certificates cite and which still names the
// edition in force. Change the catalog only when the client confirms the 2026 editions are what is audited against.
//
// No invented numbers: no client counts, no prices, no guaranteed timelines. Pricing lives on checkout.

export const PROCESS = [
  ['Inquiry', 'Tell us about your organisation and the standard you need.'],
  ['Gap analysis', 'We compare your current practice with the standard and list what is missing.'],
  ['Documentation', 'You put the required policies, procedures and records in place.'],
  ['Implementation', 'Your team runs the system in daily work and keeps the evidence.'],
  ['Audit & certification', 'An independent, accredited certification body audits you and issues the certificate.'],
];

export const GLANCE = [
  ['Certificate validity', 'Three years, with surveillance audits in between'],
  ['Audited by', 'An accredited certification body, independent of Certify.cx'],
  ['Prepared with', 'A free gap analysis and expert guidance'],
];

export const WHY_US = [
  ['Experienced auditors', 'Work with qualified lead auditors from our network.'],
  ['Tailored to your size', 'From micro companies to large enterprises, the effort matches the organisation.'],
  ['One platform', 'Apply, follow your audit and keep your certificates in one dashboard.'],
  ['Independent certification', 'Audits and the certification decision are made by accredited certification bodies.'],
];

export const ISO_LANDINGS = {
  'iso-9001': {
    slug: 'iso-9001',
    path: '/iso-9001-certification',
    display: 'ISO 9001:2026',
    short: 'ISO 9001',
    name: 'Quality Management System Certification',
    tag: 'Build trust. Improve systems. Grow your business.',
    accent: '#60a5fa',
    accentLight: '#1d4ed8',
    motif: 'hex',
    chips: [['Consistent quality', 'BadgeCheck'], ['Customer satisfaction', 'Smile'], ['Process efficiency', 'Gauge']],
    seal: ['ISO', '9001:2026'],
    title: 'ISO 9001:2026 Certification | Quality Management System | Certify.cx',
    description: 'Get ISO 9001:2026 quality management system certification with Certify.cx. Free gap analysis, expert guidance and an independent accredited audit. See the benefits, process and FAQs.',
    lead: 'Enhance customer satisfaction, streamline processes and drive continual improvement with ISO 9001 quality management system certification.',
    intro: 'ISO 9001 is the world\'s most widely used quality management system standard. It sets out how an organisation of any size or sector can consistently deliver products and services that meet customer and legal requirements, and keep improving while it does so.',
    edition: 'This page covers the 2026 edition of ISO 9001. Organisations certified to the earlier edition move across during the transition period set by ISO and the accreditation community; your certification body confirms the exact dates.',
    benefitsTitle: 'Why ISO 9001 certification?',
    benefits: [
      ['Improve quality', 'Deliver consistent quality in products and services.', 'BadgeCheck'],
      ['Increase customer satisfaction', 'Meet customer requirements and exceed expectations.', 'Smile'],
      ['Enhance efficiency', 'Streamline processes and reduce operational waste.', 'Gauge'],
      ['Gain competitive advantage', 'Win tenders that ask for a certified quality system.', 'Trophy'],
      ['Ensure continual improvement', 'Build a culture of measuring and improving results.', 'TrendingUp'],
    ],
    requirementsTitle: 'What ISO 9001 asks of your organisation',
    requirements: [
      ['Context of the organisation', 'Understand your interested parties, scope and processes.'],
      ['Leadership', 'Top management commits to quality and sets the policy and objectives.'],
      ['Planning', 'Address risks and opportunities and plan how to reach quality objectives.'],
      ['Support', 'Provide competent people, infrastructure and controlled documented information.'],
      ['Operation', 'Plan and control design, purchasing, production and service delivery.'],
      ['Performance evaluation', 'Monitor customer satisfaction, run internal audits and hold management reviews.'],
      ['Improvement', 'Correct nonconformities and improve the system continually.'],
    ],
    forWho: 'Manufacturers, service providers, contractors, schools, healthcare and technology companies: any organisation that wants consistent quality and customer confidence.',
    faqs: [
      ['What is ISO 9001 certification?', 'It is independent confirmation, by an accredited certification body, that your quality management system meets the requirements of ISO 9001.'],
      ['How long does it take to get ISO 9001 certified?', 'It depends on your size, complexity and how mature your current system is. A gap analysis gives you a realistic plan before you commit to a timeline.'],
      ['How long is an ISO 9001 certificate valid?', 'A management system certificate is normally valid for three years, with surveillance audits in between and a recertification audit at the end of the cycle.'],
      ['Is ISO 9001 only for large companies?', 'No. The standard scales to the size of the organisation, and Certify.cx has a dedicated offer for micro companies with 1 to 9 employees.'],
      ['Does Certify.cx issue the certificate?', 'Certify.cx guides you and connects you with accredited certification bodies. The audit and the certification decision are made independently by the certification body.'],
    ],
  },

  'iso-14001': {
    slug: 'iso-14001',
    path: '/iso-14001-certification',
    display: 'ISO 14001:2026',
    short: 'ISO 14001',
    name: 'Environmental Management System Certification',
    tag: 'Protect the environment. Ensure compliance. Build sustainability.',
    accent: '#3ecf8e',
    accentLight: '#15803d',
    motif: 'leaf',
    chips: [['Lower impact', 'Leaf'], ['Legal compliance', 'Scale'], ['Resource efficiency', 'Recycle']],
    seal: ['ISO', '14001:2026'],
    title: 'ISO 14001:2026 Certification | Environmental Management System | Certify.cx',
    description: 'Get ISO 14001:2026 environmental management system certification with Certify.cx. Cut environmental impact, stay legally compliant and build stakeholder trust. Process, benefits and FAQs.',
    lead: 'Demonstrate your commitment to the environment and achieve your sustainability goals with ISO 14001 certification.',
    intro: 'ISO 14001 is the international standard for environmental management systems. It helps an organisation identify how its activities affect the environment, meet its legal obligations and reduce its impact in a structured, measurable way.',
    edition: 'This page covers the 2026 edition of ISO 14001. Organisations certified to the earlier edition move across during the transition period set by ISO and the accreditation community; your certification body confirms the exact dates.',
    benefitsTitle: 'Why ISO 14001 certification?',
    benefits: [
      ['Reduce environmental impact', 'Find and control the activities that harm the environment.', 'Leaf'],
      ['Ensure legal compliance', 'Know your environmental obligations and show you meet them.', 'Scale'],
      ['Improve resource efficiency', 'Use less energy, water and material, and cut waste costs.', 'Recycle'],
      ['Enhance stakeholder trust', 'Give customers, investors and regulators evidence, not promises.', 'Handshake'],
      ['Support sustainable growth', 'Meet supplier and tender requirements that ask for ISO 14001.', 'Sprout'],
    ],
    requirementsTitle: 'What ISO 14001 asks of your organisation',
    requirements: [
      ['Context of the organisation', 'Understand external issues, interested parties and the scope of the system.'],
      ['Leadership', 'Top management owns the environmental policy and assigns responsibilities.'],
      ['Planning', 'Identify environmental aspects, compliance obligations, risks and opportunities.'],
      ['Support', 'Provide competence, awareness, communication and controlled documented information.'],
      ['Operation', 'Control operations with a life-cycle view and prepare for emergencies.'],
      ['Performance evaluation', 'Monitor and measure, evaluate compliance, audit internally and review.'],
      ['Improvement', 'Act on nonconformities and improve environmental performance.'],
    ],
    forWho: 'Manufacturing, construction, logistics, energy, hospitality and any organisation whose work affects air, water, land or resources.',
    faqs: [
      ['What is ISO 14001 certification?', 'It is independent confirmation that your environmental management system meets ISO 14001, issued after an audit by an accredited certification body.'],
      ['Does ISO 14001 guarantee a certain environmental result?', 'No. It requires you to set your own objectives, control your impacts, comply with the law and keep improving. It does not set fixed performance limits.'],
      ['How long does ISO 14001 certification take?', 'It depends on size, sites and the maturity of your current practice. A gap analysis gives you a realistic plan first.'],
      ['Can ISO 14001 be combined with ISO 9001?', 'Yes. Both follow the same high-level structure, so many organisations run one integrated system and audit both together.'],
      ['Who audits and certifies?', 'An accredited certification body, independently of Certify.cx. We guide the preparation and connect you with the right body.'],
    ],
  },

  'iso-45001': {
    slug: 'iso-45001',
    path: '/iso-45001-certification',
    display: 'ISO 45001:2018',
    short: 'ISO 45001',
    name: 'Occupational Health & Safety Management Certification',
    tag: 'Safer workplace. Healthier people. Stronger business.',
    accent: '#fb923c',
    accentLight: '#ea580c',
    motif: 'shield',
    chips: [['Safer workplace', 'HardHat'], ['Fewer incidents', 'ShieldAlert'], ['Healthier people', 'HeartPulse']],
    seal: ['ISO', '45001:2018'],
    title: 'ISO 45001 Certification | Occupational Health & Safety | Certify.cx',
    description: 'Get ISO 45001 occupational health and safety certification with Certify.cx. Reduce workplace risk, meet legal requirements and protect your people. Process, benefits and FAQs.',
    lead: 'Demonstrate your healthy workplace commitment by identifying and reducing hazards with ISO 45001 certification.',
    intro: 'ISO 45001 is the international standard for occupational health and safety management systems. It helps an organisation prevent work-related injury and ill health by finding hazards, controlling risks and involving workers.',
    edition: '',
    benefitsTitle: 'Why ISO 45001 certification?',
    benefits: [
      ['Improve workplace safety', 'Find hazards early and control them before someone is hurt.', 'HardHat'],
      ['Reduce risks and incidents', 'Fewer accidents mean fewer stoppages and claims.', 'ShieldAlert'],
      ['Ensure legal compliance', 'Know your health and safety duties and show you meet them.', 'Scale'],
      ['Boost employee well-being', 'Involve workers and build a visible safety culture.', 'HeartPulse'],
      ['Improve business performance', 'Qualify for contracts that require certified safety management.', 'TrendingUp'],
    ],
    requirementsTitle: 'What ISO 45001 asks of your organisation',
    requirements: [
      ['Context of the organisation', 'Understand workers, other interested parties and the scope of the system.'],
      ['Leadership and worker participation', 'Management leads, and workers are consulted and take part.'],
      ['Planning', 'Identify hazards, assess risks and opportunities, and set OH&S objectives.'],
      ['Support', 'Provide competence, awareness, communication and documented information.'],
      ['Operation', 'Eliminate hazards and reduce risks, manage change, and prepare for emergencies.'],
      ['Performance evaluation', 'Monitor incidents and compliance, audit internally and review.'],
      ['Improvement', 'Investigate incidents, correct causes and improve continually.'],
    ],
    forWho: 'Construction, manufacturing, oil and gas, logistics, facilities and any organisation with people working on sites, plant or in hazardous conditions.',
    faqs: [
      ['What is ISO 45001 certification?', 'It is independent confirmation that your occupational health and safety management system meets ISO 45001, issued after an audit by an accredited certification body.'],
      ['Does ISO 45001 replace OHSAS 18001?', 'Yes. ISO 45001 replaced OHSAS 18001, and organisations moved to it during the transition that ended in 2021.'],
      ['Does certification mean we have no accidents?', 'No. It shows you have a working system to identify hazards, control risks, learn from incidents and keep improving.'],
      ['How long does ISO 45001 certification take?', 'It depends on size, sites and the maturity of your current safety practice. A gap analysis gives you a realistic plan first.'],
      ['Who audits and certifies?', 'An accredited certification body, independently of Certify.cx. We guide the preparation and connect you with the right body.'],
    ],
  },

  'iso-iec-27001': {
    slug: 'iso-iec-27001',
    path: '/iso-27001-certification',
    display: 'ISO/IEC 27001:2022',
    short: 'ISO/IEC 27001',
    name: 'Information Security Management System Certification',
    tag: 'Secure information. Build trust. Stay compliant.',
    accent: '#a78bfa',
    accentLight: '#6d28d9',
    motif: 'circuit',
    chips: [['Protected data', 'Lock'], ['Managed risk', 'ShieldCheck'], ['Customer trust', 'Handshake']],
    seal: ['ISO/IEC', '27001:2022'],
    title: 'ISO 27001 Certification | Information Security Management | Certify.cx',
    description: 'Get ISO/IEC 27001 information security certification with Certify.cx. Protect information assets, reduce security risk and win customer trust. Process, benefits and FAQs.',
    lead: 'Protect your information assets and reduce security risk with ISO/IEC 27001 certification.',
    intro: 'ISO/IEC 27001 is the international standard for information security management systems. It helps an organisation protect the confidentiality, integrity and availability of its information by managing security risk with a defined set of controls.',
    edition: '',
    benefitsTitle: 'Why ISO/IEC 27001 certification?',
    benefits: [
      ['Protect information assets', 'Keep customer, employee and company data safe.', 'Lock'],
      ['Reduce security risks', 'Find and treat threats in a structured, repeatable way.', 'ShieldCheck'],
      ['Ensure regulatory compliance', 'Support obligations such as GDPR with a recognised framework.', 'Scale'],
      ['Build customer trust', 'Answer security questionnaires and tenders with independent proof.', 'Handshake'],
      ['Business continuity', 'Plan for incidents so operations recover quickly.', 'RefreshCw'],
    ],
    requirementsTitle: 'What ISO/IEC 27001 asks of your organisation',
    requirements: [
      ['Context and scope', 'Define the scope of the system and the needs of interested parties.'],
      ['Leadership', 'Management sets the information security policy and roles.'],
      ['Risk assessment and treatment', 'Assess information security risks, choose controls and record a Statement of Applicability.'],
      ['Support', 'Provide competence, awareness, communication and controlled documented information.'],
      ['Operation', 'Run the risk treatment plan and the controls you selected.'],
      ['Performance evaluation', 'Monitor, run internal audits and hold management reviews.'],
      ['Annex A controls', 'Select from 93 controls in four themes: organisational, people, physical and technological.'],
    ],
    forWho: 'Software and SaaS companies, IT and managed service providers, finance, healthcare, outsourcing and any organisation that handles sensitive or customer data.',
    faqs: [
      ['What is ISO/IEC 27001 certification?', 'It is independent confirmation that your information security management system meets ISO/IEC 27001, issued after an audit by an accredited certification body.'],
      ['What is the difference between ISO 27001 and SOC 2?', 'ISO/IEC 27001 certifies a management system against an international standard. SOC 2 is an attestation report against trust services criteria. Many companies hold both, and Certify.cx supports SOC audits as well.'],
      ['What is the Statement of Applicability?', 'It is the document that lists which Annex A controls you apply, which you exclude, and why. Auditors review it closely.'],
      ['How long does ISO 27001 certification take?', 'It depends on size, scope and how mature your security practice is. A gap analysis gives you a realistic plan first.'],
      ['Who audits and certifies?', 'An accredited certification body, independently of Certify.cx. We guide the preparation and connect you with the right body.'],
    ],
  },
};

// The URL of each landing page, in menu order.
export const ISO_LANDING_ORDER = ['iso-9001', 'iso-14001', 'iso-45001', 'iso-iec-27001'];
export const ISO_LANDING_LIST = ISO_LANDING_ORDER.map((k) => ISO_LANDINGS[k]);
export const ISO_HUB_PATH = '/iso-certification';
