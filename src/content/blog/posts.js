// Blog articles for /blog.
//
// Articles live here as plain data so the blog works without a database or CMS. To publish a new one,
// add an entry to POSTS (newest first is not required: the page sorts by date).
//
// Client rule (18 Nov): never put the founder's name, or any individual's name, in an article. Every
// article is published by the "Certify.cx Editorial Team" (AUTHOR below).
//
// Entry shape
//   slug       URL part:  /blog/<slug>
//   title      headline
//   excerpt    one or two sentences for cards and search results
//   category   one of CATEGORIES (the key)
//   date       ISO date (YYYY-MM-DD)
//   minutes    reading time
//   featured   true → appears in the auto-sliding banner at the top of /blog
//   body       array of blocks:
//                { t: 'p', x: 'text' }          paragraph
//                { t: 'h2', x: 'text' }         section heading (feeds the table of contents)
//                { t: 'ul', items: [...] }      bullet list
//                { t: 'ol', items: [...] }      numbered list
//                { t: 'note', x: 'text' }       highlighted tip

export const AUTHOR = 'Certify.cx Editorial Team';

// key → label, accent colour and the lucide icon name used on the cover art.
export const CATEGORIES = {
  'iso-standards': { label: 'ISO Standards', color: '#3ECF8E', icon: 'Award' },
  education: { label: 'Education', color: '#60A5FA', icon: 'GraduationCap' },
  auditing: { label: 'Auditing', color: '#FBBF24', icon: 'ClipboardCheck' },
  'certification-bodies': { label: 'Certification Bodies', color: '#A78BFA', icon: 'ShieldCheck' },
  compliance: { label: 'Compliance', color: '#F472B6', icon: 'FileCheck2' },
  'business-guides': { label: 'Business Guides', color: '#2DD4BF', icon: 'Compass' },
};

export const POSTS = [
  {
    slug: 'roadmap-to-iso-certification',
    title: 'A realistic roadmap to ISO certification for small and mid-sized organisations',
    excerpt: 'Eight steps from the first gap analysis to the certificate on the wall, and where organisations usually lose time.',
    category: 'business-guides',
    date: '2026-11-16',
    minutes: 6,
    featured: true,
    body: [
      { t: 'p', x: 'Getting certified to an ISO management system standard is a project, not a form to fill in. The work itself is not mysterious, but the order matters. Organisations that follow a clear sequence usually reach certification faster and with fewer surprises at audit.' },
      { t: 'h2', x: '1. Start with a gap analysis' },
      { t: 'p', x: 'Before writing a single procedure, compare what you already do with what the standard requires. Most organisations discover they already meet a large part of it. The gap analysis tells you what is missing, so you only build what you need.' },
      { t: 'h2', x: '2. Decide the scope' },
      { t: 'p', x: 'Scope is the part of the organisation the certificate covers: sites, products, services and processes. A scope that is too narrow can mislead customers, and one that is too wide makes the project heavier than it needs to be. Write it down early and keep it honest.' },
      { t: 'h2', x: '3. Secure leadership commitment' },
      { t: 'p', x: 'Every ISO management system standard puts responsibility on top management. Someone senior needs to own the policy, approve objectives and attend the management review. Without that, the system tends to become paperwork that nobody uses.' },
      { t: 'h2', x: '4. Build and document what is needed' },
      { t: 'ul', items: ['Policy and measurable objectives', 'Processes that describe how work is really done', 'Records that prove the processes were followed', 'Roles, responsibilities and competence'] },
      { t: 'note', x: 'Keep documentation proportionate. Auditors look for a system that works, not the thickest manual.' },
      { t: 'h2', x: '5. Run the system and collect evidence' },
      { t: 'p', x: 'The system needs to operate for a period before the certification audit, so there are real records to look at: completed audits, corrective actions, training records and results against objectives.' },
      { t: 'h2', x: '6. Internal audit and management review' },
      { t: 'p', x: 'These two activities are required by the standards and are also your best rehearsal. They find problems while they are still cheap to fix.' },
      { t: 'h2', x: '7. Choose an accredited certification body' },
      { t: 'p', x: 'The certification body audits you and issues the certificate. Choose one accredited for your standard and sector, and compare proposals on scope, audit days and total cost over the three-year cycle.' },
      { t: 'h2', x: '8. Pass the audits and keep improving' },
      { t: 'p', x: 'The certification audit is held in two stages. After certification, surveillance audits follow each year, and a recertification audit before the three-year cycle ends. Certification is the start of a habit, not the end of a project.' },
    ],
  },
  {
    slug: 'iso-21001-for-schools-and-universities',
    title: 'ISO 21001 for schools and universities: what it is and why it matters',
    excerpt: 'The management system standard written for educational organisations, and how it sits alongside national accreditation.',
    category: 'education',
    date: '2026-11-14',
    minutes: 5,
    featured: true,
    body: [
      { t: 'p', x: 'ISO 21001 is the international management system standard for educational organisations. It applies to schools, colleges, universities, training providers and other bodies whose main purpose is to provide education and learning.' },
      { t: 'h2', x: 'What makes it different' },
      { t: 'p', x: 'Where ISO 9001 speaks about customers in general, ISO 21001 puts learners and other beneficiaries at the centre. That includes students, parents, employers and the wider community. It asks an institution to understand their needs and to show how its processes meet them.' },
      { t: 'h2', x: 'What it covers' },
      { t: 'ul', items: ['Leadership, policy and clear responsibilities', 'Planning that takes risks and opportunities into account', 'Support for learners, including those with special needs', 'Competence of teaching and non-teaching staff', 'Design and delivery of educational programmes', 'Monitoring, measurement and continual improvement'] },
      { t: 'h2', x: 'How it relates to national accreditation' },
      { t: 'p', x: 'National accreditation and quality assurance schemes judge an institution against standards set for its country or discipline. ISO 21001 does not replace them. It provides a management system framework that helps an institution run the processes those schemes look at, and to keep evidence in an organised way.' },
      { t: 'note', x: 'Think of ISO 21001 as the way the institution manages itself, and national accreditation as an external view of the outcome.' },
      { t: 'h2', x: 'Why institutions choose it' },
      { t: 'ul', items: ['Shows accountability to boards, owners and ministries', 'Gives staff a shared way of working', 'Builds confidence among students and parents', 'Provides recognition that is understood across borders when issued by an accredited certification body'] },
      { t: 'h2', x: 'Where to start' },
      { t: 'p', x: 'A gap analysis against the standard is the usual first step. It shows which requirements are already met through existing quality processes and which need work, before any commitment to certification is made.' },
    ],
  },
  {
    slug: 'choosing-an-iaf-accredited-certification-body',
    title: 'How to choose an IAF-accredited certification body',
    excerpt: 'Six checks that separate a certificate people trust from one they question.',
    category: 'certification-bodies',
    date: '2026-11-12',
    minutes: 5,
    featured: true,
    body: [
      { t: 'p', x: 'A certificate is only as credible as the body that issued it. Two organisations can both be "ISO certified" and yet hold certificates that customers, regulators and tenders treat very differently. The difference is usually accreditation.' },
      { t: 'h2', x: '1. Check the accreditation' },
      { t: 'p', x: 'Look for a certification body accredited by an accreditation body that is a signatory of the International Accreditation Forum (IAF) Multilateral Recognition Arrangement. That arrangement is what allows certificates to be recognised across borders.' },
      { t: 'h2', x: '2. Confirm the scope of accreditation' },
      { t: 'p', x: 'Accreditation is granted for specific standards and industry sectors. A body may be accredited for ISO 9001 in some sectors and not in yours. Ask for the accreditation scope and check it on the accreditation body\'s own register.' },
      { t: 'h2', x: '3. Ask about auditor competence' },
      { t: 'p', x: 'The best audits are carried out by people who understand your sector. Ask how auditors are selected for your assignment and what experience they have.' },
      { t: 'h2', x: '4. Look at impartiality' },
      { t: 'p', x: 'A certification body must not provide consultancy to the clients it certifies. If one offers to "help you pass", that is a warning sign.' },
      { t: 'h2', x: '5. Compare the full cost' },
      { t: 'ul', items: ['Initial certification audit', 'Annual surveillance audits', 'Recertification at the end of the three-year cycle', 'Travel and any extra audit days'] },
      { t: 'note', x: 'A low first-year price can hide higher costs in the later years. Compare proposals across the whole cycle.' },
      { t: 'h2', x: '6. Check how certificates are issued and verified' },
      { t: 'p', x: 'A reputable body lets third parties confirm that a certificate is valid, and is clear about what happens if an audit finds problems.' },
    ],
  },
  {
    slug: 'your-first-certification-audit',
    title: 'Your first certification audit: Stage 1, Stage 2 and what auditors look for',
    excerpt: 'What happens in each stage, what evidence to have ready and how the three-year cycle works afterwards.',
    category: 'auditing',
    date: '2026-11-10',
    minutes: 5,
    featured: true,
    body: [
      { t: 'p', x: 'Most organisations feel nervous before a first certification audit. It helps to know that the process is structured and that auditors are looking for evidence that a system works, not for people to blame.' },
      { t: 'h2', x: 'Stage 1: readiness' },
      { t: 'p', x: 'Stage 1 checks that you are ready for the full audit. The auditor reviews your documented information, confirms the scope, looks at how you have planned your internal audits and management review, and agrees the plan for Stage 2. Any serious gaps are raised here, so you can fix them in time.' },
      { t: 'h2', x: 'Stage 2: implementation' },
      { t: 'p', x: 'Stage 2 is the main audit. The auditor visits (in person or remotely), talks to staff and looks at records to check that the system is implemented and effective across the scope.' },
      { t: 'h2', x: 'What auditors look for' },
      { t: 'ul', items: ['Top management who can explain the policy and objectives', 'Processes that match what people actually do', 'Records showing that processes were followed', 'Evidence that internal audits and management review took place', 'Corrective actions that were closed, and that worked', 'Staff who understand their role in the system'] },
      { t: 'h2', x: 'Findings' },
      { t: 'p', x: 'Findings are normally graded. A minor nonconformity needs a corrective action plan. A major nonconformity must be resolved before a certificate can be issued. Observations are suggestions and do not block certification.' },
      { t: 'h2', x: 'After certification' },
      { t: 'ul', items: ['Surveillance audits each year to confirm the system is still working', 'A recertification audit before the end of the three-year cycle'] },
      { t: 'note', x: 'Be honest and answer the question you are asked. Auditors respect an organisation that knows its weaknesses and is already dealing with them.' },
    ],
  },
  {
    slug: 'certification-vs-accreditation',
    title: 'Certification vs accreditation: who checks the people who check you?',
    excerpt: 'Two words that are often mixed up, and why the difference matters when you buy a certificate.',
    category: 'certification-bodies',
    date: '2026-11-08',
    minutes: 4,
    body: [
      { t: 'p', x: 'People often use "certification" and "accreditation" as if they meant the same thing. They do not, and the difference is the reason some certificates are trusted worldwide and others are not.' },
      { t: 'h2', x: 'Certification' },
      { t: 'p', x: 'Certification is an independent confirmation that an organisation, product or person meets a standard. For management systems, a certification body audits the organisation against a standard such as ISO 9001 and, if the requirements are met, issues a certificate.' },
      { t: 'h2', x: 'Accreditation' },
      { t: 'p', x: 'Accreditation is the formal recognition that a certification body is competent to do that work. An accreditation body assesses the certification body against an international standard for such bodies, looking at its auditors, procedures and impartiality.' },
      { t: 'h2', x: 'Why the chain matters' },
      { t: 'ul', items: ['The organisation is audited by the certification body', 'The certification body is assessed by the accreditation body', 'Accreditation bodies recognise each other through international arrangements'] },
      { t: 'p', x: 'This chain is what lets a buyer in one country rely on a certificate issued in another.' },
      { t: 'note', x: 'When you compare certification bodies, ask which accreditation body they are accredited by, and confirm it on that body\'s public register.' },
      { t: 'h2', x: 'A simple rule of thumb' },
      { t: 'p', x: 'Certification answers "does this organisation meet the standard?" Accreditation answers "can we trust the body that said so?" You need both for a certificate that is accepted without argument.' },
    ],
  },
  {
    slug: 'internal-audit-readiness-checklist',
    title: 'Internal audit readiness: a practical checklist before the certification audit',
    excerpt: 'Twelve questions to ask yourself, and your team, a few weeks before the auditor arrives.',
    category: 'auditing',
    date: '2026-11-06',
    minutes: 4,
    body: [
      { t: 'p', x: 'An internal audit is a rehearsal that the standard itself requires. Done well, it finds the same issues an external auditor would, while there is still time to fix them. Use this checklist to test how ready you are.' },
      { t: 'h2', x: 'Leadership and planning' },
      { t: 'ol', items: ['Is the policy approved, current and known to staff?', 'Are there measurable objectives, and do you track them?', 'Has top management held a management review with recorded decisions?', 'Are risks and opportunities identified and reviewed?'] },
      { t: 'h2', x: 'Operations and control' },
      { t: 'ol', items: ['Does each documented process match what people really do?', 'Are records complete, dated and easy to retrieve?', 'Are suppliers evaluated and monitored?', 'Are changes to processes controlled?'] },
      { t: 'h2', x: 'People and improvement' },
      { t: 'ol', items: ['Can staff explain how their work affects the system?', 'Is competence and training evidence on file?', 'Were previous audit findings closed with root causes addressed?', 'Is there a way to capture complaints and feedback, and does anyone act on it?'] },
      { t: 'note', x: 'Pick auditors who do not audit their own work. Impartiality is a requirement, and it also gives you a more honest result.' },
      { t: 'h2', x: 'What to do with the results' },
      { t: 'p', x: 'Record every finding, agree an owner and a date for each, and verify the fix later. The auditor will want to see that the internal audit led to action, not only a report.' },
    ],
  },
  {
    slug: 'iso-27001-protecting-information',
    title: 'ISO 27001 in practice: protecting information the way auditors expect',
    excerpt: 'The building blocks of an information security management system, without the jargon.',
    category: 'iso-standards',
    date: '2026-11-04',
    minutes: 5,
    body: [
      { t: 'p', x: 'ISO 27001 is the international standard for information security management systems (ISMS). It does not prescribe a list of tools. It asks an organisation to understand its information risks and to manage them in an organised, repeatable way.' },
      { t: 'h2', x: 'Start with risk' },
      { t: 'p', x: 'The core of the standard is a risk assessment. You identify the information you hold, what could go wrong, how likely and how serious it would be, and what you will do about it. Everything else follows from this.' },
      { t: 'h2', x: 'The Statement of Applicability' },
      { t: 'p', x: 'The standard includes a catalogue of security controls. For each one, you record whether it applies to you and why, and whether it is implemented. That record is called the Statement of Applicability, and auditors will read it closely.' },
      { t: 'h2', x: 'The areas auditors usually probe' },
      { t: 'ul', items: ['Access control: who can see and change what', 'Supplier and cloud service security', 'Incident handling and reporting', 'Backups and continuity', 'Staff awareness and onboarding or leaving processes', 'Physical security of offices and equipment'] },
      { t: 'h2', x: 'People matter as much as technology' },
      { t: 'p', x: 'Many incidents begin with a person, not a machine. Training, clear rules and a culture where staff report mistakes early are as valuable as any technical control.' },
      { t: 'note', x: 'Define the scope carefully. A certificate for "the whole company" is a much bigger task than one for a specific service or site.' },
      { t: 'h2', x: 'Certification' },
      { t: 'p', x: 'As with other management system standards, an accredited certification body audits in two stages and then returns for surveillance audits during the three-year cycle.' },
    ],
  },
  {
    slug: 'nonconformities-and-corrective-action',
    title: 'Nonconformities and corrective action: turning findings into improvement',
    excerpt: 'How to respond to an audit finding so the same problem does not come back.',
    category: 'compliance',
    date: '2026-11-02',
    minutes: 4,
    body: [
      { t: 'p', x: 'Every management system produces findings. What separates a strong system from a weak one is what happens next. A good corrective action fixes the cause, not just the symptom.' },
      { t: 'h2', x: 'Correction and corrective action are different' },
      { t: 'ul', items: ['Correction: the immediate fix, for example re-doing a record or recalling a faulty batch.', 'Corrective action: the change that stops the problem happening again, based on its root cause.'] },
      { t: 'h2', x: 'Find the root cause' },
      { t: 'p', x: 'Ask "why" until you reach something you can change. A simple method is the five whys: keep asking why the problem occurred, and stop when the answer points to a process, a rule or a missing resource.' },
      { t: 'h2', x: 'A simple response structure' },
      { t: 'ol', items: ['State the finding in your own words.', 'Describe the correction and when it was done.', 'Describe the root cause and how you found it.', 'Describe the corrective action, the owner and the due date.', 'Say how you will check that it worked.'] },
      { t: 'h2', x: 'Major and minor findings' },
      { t: 'p', x: 'A minor nonconformity usually requires an agreed plan and is checked at the next audit. A major nonconformity usually needs to be closed, with evidence, before certification can be granted or continued.' },
      { t: 'note', x: 'Keep the evidence: photos, revised procedures, training records and review notes. "We fixed it" is not enough without proof.' },
      { t: 'h2', x: 'Check effectiveness' },
      { t: 'p', x: 'After the change has run for a while, look at the data. If the problem has stopped, close the action. If it has not, the root cause was probably something else.' },
    ],
  },
  {
    slug: 'iso-9001-plain-language-guide',
    title: 'ISO 9001 explained: a plain-language guide to quality management',
    excerpt: 'What the standard asks for, who it suits and the mistakes that make it feel harder than it is.',
    category: 'iso-standards',
    date: '2026-10-30',
    minutes: 6,
    body: [
      { t: 'p', x: 'ISO 9001 is the most widely used quality management standard in the world. It is not tied to an industry or a size. It describes how an organisation can consistently deliver products or services that meet customer and regulatory requirements, and keep improving.' },
      { t: 'h2', x: 'The ideas behind it' },
      { t: 'ul', items: ['Customer focus', 'Leadership', 'Engagement of people', 'A process approach', 'Improvement', 'Evidence-based decisions', 'Relationship management with suppliers and other interested parties'] },
      { t: 'h2', x: 'What the standard actually requires' },
      { t: 'p', x: 'ISO 9001 is organised around a cycle of planning, doing, checking and acting. In practice, it asks you to understand your context and customers, set a quality policy and objectives, plan and control your processes, check results through monitoring and internal audit, and improve.' },
      { t: 'h2', x: 'Risk-based thinking' },
      { t: 'p', x: 'The standard expects you to think about what could prevent you from reaching your objectives, and what opportunities you could take. It does not require a heavy formal risk method, but it does expect that you have considered the question.' },
      { t: 'h2', x: 'Common mistakes' },
      { t: 'ul', items: ['Copying another company\'s manual instead of describing your own processes', 'Writing procedures nobody follows', 'Treating internal audit as a formality', 'Leaving the project to one person, instead of involving leadership', 'Focusing on passing the audit instead of improving the business'] },
      { t: 'note', x: 'A system people actually use is much easier to audit than a polished system nobody follows.' },
      { t: 'h2', x: 'Is it right for you?' },
      { t: 'p', x: 'If customers, tenders or regulators ask for evidence of quality management, or you want a structured way to reduce errors and rework, ISO 9001 is usually a good fit. A gap analysis is a low-risk first step to find out how far you are.' },
    ],
  },
  {
    slug: 'iso-22000-food-safety-management',
    title: 'ISO 22000: building a food safety management system',
    excerpt: 'How the standard combines hazard control with management-system discipline across the food chain.',
    category: 'iso-standards',
    date: '2026-10-27',
    minutes: 5,
    body: [
      { t: 'p', x: 'ISO 22000 sets requirements for a food safety management system for any organisation in the food chain: growers, manufacturers, transporters, storage providers, caterers and packaging suppliers.' },
      { t: 'h2', x: 'The main elements' },
      { t: 'ul', items: ['Interactive communication along the food chain', 'A management system with leadership, planning and improvement', 'Prerequisite programmes such as hygiene, pest control and cleaning', 'Hazard analysis and control based on HACCP principles'] },
      { t: 'h2', x: 'Why communication is central' },
      { t: 'p', x: 'A food safety problem rarely starts and ends inside one company. The standard asks organisations to share information with suppliers, customers and authorities, so hazards are understood and controlled across the whole chain.' },
      { t: 'h2', x: 'Hazard analysis' },
      { t: 'p', x: 'You identify the biological, chemical and physical hazards that could affect your product, decide which need control, set limits and monitoring, and keep records to show control is working.' },
      { t: 'h2', x: 'Preparing for audit' },
      { t: 'ul', items: ['Keep flow diagrams current and verified on site', 'Keep monitoring and cleaning records complete', 'Test your traceability and recall procedure', 'Train staff in the hazards that affect their tasks'] },
      { t: 'note', x: 'Test your recall process before the audit. Being able to trace a batch quickly is one of the strongest signs of a working system.' },
      { t: 'h2', x: 'How it relates to other schemes' },
      { t: 'p', x: 'Some customers and retailers require specific food safety schemes. ISO 22000 provides the management-system foundation that many of those schemes build on, so the work is rarely wasted.' },
    ],
  },
  {
    slug: 'quality-management-and-national-accreditation',
    title: 'Quality management and national accreditation: how they work together in universities',
    excerpt: 'Why an international management system standard and a national quality scheme are partners, not rivals.',
    category: 'education',
    date: '2026-10-24',
    minutes: 5,
    body: [
      { t: 'p', x: 'Universities usually face several quality expectations at once: a national accreditation or quality assurance agency, regional networks, professional bodies and sometimes international rankings. An ISO management system standard can sit underneath all of them as a common way of organising the work.' },
      { t: 'h2', x: 'Two different jobs' },
      { t: 'p', x: 'National and regional schemes assess an institution or programme against criteria set for higher education. A management system standard such as ISO 21001 or ISO 9001 assesses how the organisation manages itself: its policy, processes, records, internal audit and improvement cycle.' },
      { t: 'h2', x: 'Where they overlap' },
      { t: 'ul', items: ['Governance and clear responsibilities', 'Programme design, approval and review', 'Student support and feedback', 'Staff competence and development', 'Use of data to improve results'] },
      { t: 'h2', x: 'Benefits of linking them' },
      { t: 'ul', items: ['Evidence is collected once and used many times', 'Preparation for a review becomes routine instead of a rush', 'Departments follow the same simple rules', 'Leadership gets one clear picture of performance'] },
      { t: 'note', x: 'Map your existing accreditation criteria to the clauses of the ISO standard. The overlap is usually larger than institutions expect.' },
      { t: 'h2', x: 'A practical way to start' },
      { t: 'p', x: 'Begin with a gap analysis against the standard, using the evidence you already hold for national accreditation. The result shows what a management system adds, and what you already have.' },
    ],
  },
];

/** Posts sorted newest first. */
export const sortedPosts = () => [...POSTS].sort((a, b) => b.date.localeCompare(a.date));

export const getPost = (slug) => POSTS.find((p) => p.slug === slug) || null;

export const formatDate = (iso) => new Date(`${iso}T00:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
