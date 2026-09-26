// Shapes shared by the API routes and the browser.

export type Member = {
  id: string;
  name: string;
  pathway: string;
  notes: string;
  status: 'Active' | 'Inactive';
  is_leader: boolean;
  sort: number;
  revision: number;
};

export type Me = {
  memberId: string;
  name: string;
  isLeader: boolean;
};

export type SessionKind = 'study' | 'qa' | 'workshop' | 'case' | 'mock' | 'other';
export type SessionStatus = 'Planned' | 'Completed' | 'Cancelled';

export type Session = {
  id: string;
  title: string;
  kind: SessionKind;
  session_date: string;
  starts_at: string | null;
  ends_at: string | null;
  hours: number | null;
  notes: string;
  reminder_minutes: number;
  status: SessionStatus;
  revision: number;
  updated_by: string | null;
};

export type AttendanceStatus = 'present' | 'late' | 'excused' | 'absent';

export type Attendance = {
  session_id: string;
  member_id: string;
  status: AttendanceStatus;
  marked_by: string | null;
  marked_at: string;
};

export type FileRef = {
  id: string;
  name: string;
  content_type: string;
  size: number;
};

// SOE rows in the bulk state carry word counts only; the editor loads the full text.
export type SoeSummary = {
  id: string;
  member_id: string;
  competency: string;
  competency_type: 'Mandatory' | 'Optional' | 'Technical';
  words: [number, number, number];
  files: [FileRef | null, FileRef | null, FileRef | null];
  questioner_id: string | null;
  status: string;
  notes: string;
  submitted_at: string | null;
  submitted_by: string | null;
  revision: number;
};

export type SoeFull = SoeSummary & {
  level1: string;
  level2: string;
  level3: string;
};

export type Qa = {
  id: string;
  soe_id: string;
  number: number;
  question: string;
  context: string;
  action: string;
  basis: string;
  outcome: string;
  feedback: string;
  status: string;
  revision: number;
  updated_by: string | null;
  updated_at: string;
};

export type PresentationStatus = 'Not started' | 'In progress' | 'Ready' | 'Presented';

export type CaseStudy = {
  id: string;
  member_id: string;
  title: string;
  summary: string;
  questions: string;
  status: string;
  notes: string;
  presentation_status: PresentationStatus;
  slides: FileRef | null;
  revision: number;
  updated_by: string | null;
  updated_at: string;
};

export type Announcement = {
  id: string;
  member_id: string;
  title: string;
  body: string;
  created_at: string;
  seen_by: string[];
};

export type Post = {
  id: string;
  parent_id: string | null;
  member_id: string;
  title: string;
  body: string;
  attachments: FileRef[];
  created_at: string;
  replies?: number;
};

export type Notice = {
  id: string;
  kind: string;
  ref: string;
  title: string;
  body: string;
  actor: string | null;
  created_at: string;
};

export type AppState = {
  me: Me | null;
  members: Member[];
  sessions: Session[];
  attendance: Attendance[];
  soe: SoeSummary[];
  qa: Qa[];
  cases: CaseStudy[];
  announcements: Announcement[];
  unread: number;
  serverTime: string;
};

export const REVIEW_STATUSES = [
  'Not Started',
  'Draft',
  'Ready to Practise',
  'Practised',
  'Completed',
  'Needs Revision',
] as const;

export const PRESENTATION_STATUSES: PresentationStatus[] = ['Not started', 'In progress', 'Ready', 'Presented'];

export const ATTENDANCE_STATUSES: AttendanceStatus[] = ['present', 'late', 'excused', 'absent'];

// From the workbook's hidden 99_Lists sheet.
export const COMPETENCIES = [
  'Contract Practice',
  'Procurement & Tendering',
  'Project Financial Control & Reporting',
  'Quantification & Costing',
  'Commercial Management of Construction',
  'Construction Technology & Environmental Services',
  'Design Economics & Cost Planning',
  'Contract Administration',
  'Risk Management',
  'Ethics, Rules of Conduct & Professionalism',
  'Client Care',
  'Communication & Negotiation',
  'Health & Safety',
  'Accounting Principles & Procedures',
  'Business Planning',
  'Conflict Avoidance, Management & Dispute Resolution Procedures',
  'Data Management',
  'Inclusive Environments',
  'Sustainability',
];

export const PATHWAYS = [
  'Quantity Surveying & Construction',
  'Project Management',
  'Building Surveying',
  'Commercial Property',
  'Infrastructure',
  'Facilities Management',
  'Other',
];

// Upload rules shared by the browser and the server.
export const UPLOAD_TYPES: Record<string, string> = {
  pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  txt: 'text/plain',
  csv: 'text/csv',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  gif: 'image/gif',
  zip: 'application/zip',
};

export const UPLOAD_CONTEXTS = {
  soe: { maxBytes: 10 * 1024 * 1024, types: ['pdf', 'docx', 'txt', 'png', 'jpg', 'jpeg', 'webp'] },
  slides: { maxBytes: 25 * 1024 * 1024, types: ['pdf', 'pptx'] },
  post: { maxBytes: 10 * 1024 * 1024, types: Object.keys(UPLOAD_TYPES) },
} as const;

export type UploadContext = keyof typeof UPLOAD_CONTEXTS;

export function fileExtension(name: string) {
  const dot = name.lastIndexOf('.');
  return dot === -1 ? '' : name.slice(dot + 1).toLowerCase();
}
