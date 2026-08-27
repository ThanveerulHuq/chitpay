export type Scene = {
  id: string;
  fileEN: string;
  fileTA: string;
  titleEN: string;
  titleTA: string;
  descEN: string;
  descTA: string;
};

export const SCENES: Scene[] = [
  {
    id: "login",
    fileEN: "01-login-en.png",
    fileTA: "01-login-ta.png",
    titleEN: "One tap login",
    titleTA: "ஒரே தொடுதலில் பாதுகாப்பு",
    descEN: "WhatsApp login — no passwords to forget",
    descTA: "WhatsApp உள்நுழைவு — கடவுச்சொல் தேவையில்லை",
  },
  {
    id: "groups",
    fileEN: "02-admin-groups-en.png",
    fileTA: "02-admin-groups-ta.png",
    titleEN: "All your chits, one place",
    titleTA: "அனைத்து சீட்டுகளும் ஒரே இடத்தில்",
    descEN: "",
    descTA: "குழுக்கள், பங்குகள், தொகை — தெளிவாக",
  },
  {
    id: "create",
    fileEN: "03-create-group-en.png",
    fileTA: "03-create-group-ta.png",
    titleEN: "Launch in seconds",
    titleTA: "விநாடிகளில் தொடங்குங்கள்",
    descEN: "Flexible cycles",
    descTA: "உங்கள் விருப்பப்படி சந்தா & சுற்றுகள்",
  },
  {
    id: "members",
    fileEN: "04-group-members-en.png",
    fileTA: "04-group-members-ta.png",
    titleEN: "Know your circle",
    titleTA: "உங்கள் வட்டத்தை அறியுங்கள்",
    descEN: "Shares & payments",
    descTA: "பங்குகள், பணம் — அனைத்தும் வெளிப்படை",
  },
  {
    id: "cycles",
    fileEN: "05-group-cycles-en.png",
    fileTA: "05-group-cycles-ta.png",
    titleEN: "Always on track",
    titleTA: "எப்போதும் சரியான பாதையில்",
    descEN: "Every cycle, clearly organized",
    descTA: "ஒவ்வொரு சுற்றும் ஒழுங்காக",
  },
  {
    id: "cycle-detail",
    fileEN: "06-cycle-detail-en.png",
    fileTA: "06-cycle-detail-ta.png",
    titleEN: "Accounts in Figertips",
    titleTA: "ஒவ்வொரு ரூபாயும் கணக்கில்",
    descEN: "Collected, paid, balance",
    descTA: "வசூல், செலுத்தியது, மீதம் — வெளிப்படை",
  },
  {
    id: "reports",
    fileEN: "07-group-reports-en.png",
    fileTA: "07-group-reports-ta.png",
    titleEN: "Transparency you can trust",
    titleTA: "நீங்கள் நம்பும் வெளிப்படைத்தன்மை",
    descEN: "Full history, ready to audit",
    descTA: "முழு வரலாறும் தயார்",
  },
  {
    id: "settings",
    fileEN: "08-settings-en.png",
    fileTA: "08-settings-ta.png",
    titleEN: "Feels like home",
    titleTA: "உங்கள் மொழியில்",
    descEN: "English or தமிழ் — switch instantly",
    descTA: "English அல்லது தமிழ் — நொடியில்",
  },
  {
    id: "managed",
    fileEN: "10-managed-members-en.png",
    fileTA: "10-managed-members-ta.png",
    titleEN: "Your people, organized",
    titleTA: "உங்கள் மக்கள் ஒழுங்காக",
    descEN: "Everyone across groups, searchable",
    descTA: "அனைத்து குழு உறுப்பினர்களும் ஒரே இடத்தில்",
  },
  {
    id: "member-view",
    fileEN: "11-member-groups-en.png",
    fileTA: "11-member-groups-ta.png",
    titleEN: "Clarity for everyone",
    titleTA: "அனைவருக்கும் தெளிவு",
    descEN: "Simple for members, zero confusion",
    descTA: "எளிய பார்வை, குழப்பமில்லை",
  },
];
