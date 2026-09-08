export type LegalSection = {
  heading: string;
  paragraphs: string[];
};

export const TERMS_SECTIONS: LegalSection[] = [
  {
    heading: "Agreement",
    paragraphs: [
      "These Terms of Use (\"Terms\") govern access to and use of DockX, including the desktop application, related web surfaces, and this website (together, the \"Service\").",
      "By downloading, installing, creating an account, or otherwise using DockX, you agree to these Terms. If you use DockX on behalf of an organization, you confirm that you have authority to bind that organization.",
    ],
  },
  {
    heading: "The product",
    paragraphs: [
      "DockX is a work operating system for teams. It provides a desktop agent for check-in and attendance, live project boards, chat, and organization dashboards.",
      "Features may change as we ship updates. Some capabilities are available only to signed-in members of an organization.",
    ],
  },
  {
    heading: "Accounts and organizations",
    paragraphs: [
      "You must provide accurate account information and keep credentials secure. You are responsible for activity under your account.",
      "Organization administrators control membership, roles, and workspace settings. They are responsible for how attendance, activity, and communications features are used inside their organization, including any notice they owe to their people under local employment or privacy law.",
    ],
  },
  {
    heading: "Acceptable use",
    paragraphs: [
      "You may not misuse the Service. That includes attempting to break or overload our systems, accessing another organization's data without permission, reverse engineering except where the law allows it, or using DockX to harass, defraud, or violate applicable law.",
      "We may suspend or terminate access if we reasonably believe these Terms have been breached, or if we must do so to protect the Service or other users.",
    ],
  },
  {
    heading: "Software license",
    paragraphs: [
      "We grant you a limited, non-exclusive, non-transferable license to install and use the DockX desktop application for your organization's internal work, in line with these Terms.",
      "You do not acquire ownership of the software, trademarks, or other DockX intellectual property. You may not redistribute installers except as we expressly allow (for example, sharing the official GitHub Release with your team).",
    ],
  },
  {
    heading: "Your content",
    paragraphs: [
      "You and your organization retain rights in tasks, messages, files, and other content you submit (\"Customer Content\").",
      "You grant us a limited license to host, process, and display Customer Content solely to operate the Service for you. We do not claim ownership of Customer Content.",
    ],
  },
  {
    heading: "Updates",
    paragraphs: [
      "Desktop builds may check for and offer updates. Installing an update may be required to keep receiving support or security fixes. You can postpone a reminder, but remaining on an unsupported build is at your risk.",
    ],
  },
  {
    heading: "Disclaimer",
    paragraphs: [
      "The Service is provided \"as is\" and \"as available.\" We do not warrant that DockX will be uninterrupted, error-free, or fit for a particular purpose, except where a warranty cannot be excluded by law.",
    ],
  },
  {
    heading: "Limitation of liability",
    paragraphs: [
      "To the maximum extent permitted by law, DockX and its operator are not liable for indirect, incidental, special, consequential, or lost-profit damages, or for loss of data, arising from use of the Service.",
      "Our total liability for any claim relating to the Service is limited to the greater of the fees you paid us for DockX in the three months before the claim, or one hundred US dollars, except where liability cannot be limited.",
    ],
  },
  {
    heading: "Changes",
    paragraphs: [
      "We may update these Terms. The effective date at the top of this page will change when we do. Continued use after an update means you accept the revised Terms. If a change is material, we will take reasonable steps to notify account holders.",
    ],
  },
  {
    heading: "Contact",
    paragraphs: [
      "Questions about these Terms: sundansharma600@gmail.com.",
    ],
  },
];

export const PRIVACY_SECTIONS: LegalSection[] = [
  {
    heading: "Who we are",
    paragraphs: [
      "This Privacy Policy explains how DockX collects, uses, and shares personal data when you visit dockx.vercel.app, download the desktop app, create an account, or send an inquiry.",
      "For privacy questions, email sundansharma600@gmail.com.",
    ],
  },
  {
    heading: "Data we collect",
    paragraphs: [
      "Account data: name, email, organization, role, and profile details you provide.",
      "Workplace data inside DockX: attendance (check-in, break, checkout), activity summaries your organization enables, tasks and board content, chat messages, and related files.",
      "Website data: pages you visit on this marketing site, cookie preferences, and inquiry form submissions (name, email, organization, message).",
      "Technical data: device and app version, approximate network information needed to keep the service secure and working.",
    ],
  },
  {
    heading: "How we use data",
    paragraphs: [
      "To provide the Service: authentication, boards, chat, attendance, dashboards, and in-app updates for the desktop app.",
      "To respond to inquiries sent from this website.",
      "To keep the Service secure, debug issues, and meet legal obligations.",
      "We do not sell personal data. We do not use Customer Content to train public AI models.",
    ],
  },
  {
    heading: "Workplace monitoring",
    paragraphs: [
      "Attendance and activity features exist so organizations can understand presence and work time. Administrators configure who can see this data.",
      "If you are an employee or contractor, your organization is typically the controller of workplace data. Ask your administrator how DockX is used in your workplace. We process that data to provide the product they have set up.",
    ],
  },
  {
    heading: "Sharing",
    paragraphs: [
      "We share data with infrastructure providers that host the Service (for example cloud compute and storage), only as needed to run DockX.",
      "Inquiry emails are delivered to sundansharma600@gmail.com so we can reply.",
      "We may disclose information if required by law, or to protect the rights, safety, or security of DockX and its users.",
    ],
  },
  {
    heading: "Retention",
    paragraphs: [
      "We keep account and workspace data for as long as the organization uses DockX, and a reasonable period afterward for backups, disputes, or legal requirements.",
      "Inquiry messages are kept long enough to handle your request. You can ask us to delete an inquiry email where the law allows.",
    ],
  },
  {
    heading: "Your choices",
    paragraphs: [
      "You can update profile information in the product, and request access, correction, or deletion of personal data we hold, subject to organizational and legal limits.",
      "On this website you can accept or limit cookies as described in the Cookie Policy.",
    ],
  },
  {
    heading: "International processing",
    paragraphs: [
      "DockX may process data on servers in India and other regions used by our hosting providers. By using the Service, you understand that data may be transferred to those locations with appropriate safeguards.",
    ],
  },
  {
    heading: "Children",
    paragraphs: [
      "DockX is built for workplace use. It is not directed at children under 16, and we do not knowingly collect their data.",
    ],
  },
  {
    heading: "Changes",
    paragraphs: [
      "We may update this policy. The effective date at the top will change when we do. Continued use of the Service after an update means you accept the revised policy.",
    ],
  },
];

export const COOKIE_SECTIONS: LegalSection[] = [
  {
    heading: "What this policy covers",
    paragraphs: [
      "This Cookie Policy describes cookies and similar storage used on dockx.vercel.app. The DockX desktop application is a native app and does not rely on this website's cookie banner.",
    ],
  },
  {
    heading: "Necessary",
    paragraphs: [
      "These are required for the site to work as you expect. They include remembering light or dark theme, and storing whether you accepted or limited cookies so we do not ask on every visit.",
      "You can block them in your browser, but theme and consent choices may not persist.",
    ],
  },
  {
    heading: "Preferences",
    paragraphs: [
      "If you choose Accept cookies, we store your consent so the banner stays dismissed. We do not currently set advertising cookies or sell browsing data.",
      "If we add optional analytics later, we will only enable them after you accept, and we will update this page.",
    ],
  },
  {
    heading: "Your controls",
    paragraphs: [
      "Use Accept cookies or Necessary only on the banner. You can reopen that choice from Cookie settings in the footer.",
      "Your browser can also delete stored data for this site at any time.",
    ],
  },
  {
    heading: "Contact",
    paragraphs: [
      "Cookie questions: sundansharma600@gmail.com.",
    ],
  },
];
