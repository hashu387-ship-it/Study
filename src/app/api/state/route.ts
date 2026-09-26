import { db, maybe, must } from '@/lib/server/db';
import { handle, json } from '@/lib/server/http';
import { currentMember, deviceId } from '@/lib/server/identity';
import { fileRefs } from '@/lib/server/files';
import type { AppState, CaseStudy, Qa, SoeSummary } from '@/lib/types';

export const dynamic = 'force-dynamic';

const words = (text: string) => (text.trim() ? text.trim().split(/\s+/).length : 0);

export const GET = handle(async () => {
  const client = db();
  const [me, device] = await Promise.all([currentMember(), deviceId()]);
  const [members, sessions, attendance, soeRows, qa, caseRows, announcements, reads, lastRead] = await Promise.all([
    client.from('members').select('id,name,pathway,notes,status,is_leader,sort,revision').order('sort'),
    client
      .from('sessions')
      .select('id,title,kind,session_date,starts_at,ends_at,hours,notes,reminder_minutes,status,revision,updated_by')
      .order('session_date')
      .order('starts_at', { nullsFirst: true }),
    client.from('attendance').select('session_id,member_id,status,marked_by,marked_at'),
    client
      .from('soe')
      .select('id,member_id,competency,competency_type,level1,level2,level3,level1_file,level2_file,level3_file,questioner_id,status,notes,submitted_at,submitted_by,revision')
      .order('competency')
      .order('member_id'),
    client
      .from('qa')
      .select('id,soe_id,number,question,context,action,basis,outcome,feedback,status,revision,updated_by,updated_at')
      .order('number'),
    client
      .from('case_studies')
      .select('id,member_id,title,summary,questions,status,notes,presentation_status,slides_file,revision,updated_by,updated_at')
      .order('member_id'),
    client.from('announcements').select('id,member_id,title,body,created_at').order('created_at', { ascending: false }).limit(50),
    client.from('announcement_reads').select('announcement_id,member_id'),
    device ? client.from('notice_reads').select('read_at').eq('device_id', device).maybeSingle() : Promise.resolve({ data: null, error: null }),
  ]);

  const soeData = must(soeRows) as Record<string, any>[];
  const caseData = must(caseRows) as Record<string, any>[];
  const files = await fileRefs([
    ...soeData.flatMap((s) => [s.level1_file, s.level2_file, s.level3_file]),
    ...caseData.map((c) => c.slides_file),
  ]);

  const soe: SoeSummary[] = soeData.map((s) => ({
    id: s.id,
    member_id: s.member_id,
    competency: s.competency,
    competency_type: s.competency_type,
    words: [words(s.level1), words(s.level2), words(s.level3)],
    files: [files.get(s.level1_file) ?? null, files.get(s.level2_file) ?? null, files.get(s.level3_file) ?? null],
    questioner_id: s.questioner_id,
    status: s.status,
    notes: s.notes,
    submitted_at: s.submitted_at,
    submitted_by: s.submitted_by,
    revision: s.revision,
  }));

  const cases: CaseStudy[] = caseData.map(({ slides_file, ...c }) => ({
    ...(c as Omit<CaseStudy, 'slides'>),
    slides: files.get(slides_file) ?? null,
  }));

  const readRows = must(reads) as { announcement_id: string; member_id: string }[];
  const readAt = (maybe(lastRead) as { read_at: string } | null)?.read_at ?? '1970-01-01T00:00:00Z';
  let unreadQuery = client.from('notices').select('id', { count: 'exact', head: true }).gt('created_at', readAt);
  if (me) unreadQuery = unreadQuery.or(`actor.is.null,actor.neq.${me.memberId}`);
  const unread = await unreadQuery;

  const state: AppState = {
    me,
    members: must(members) as AppState['members'],
    sessions: must(sessions) as AppState['sessions'],
    attendance: must(attendance) as AppState['attendance'],
    soe,
    qa: must(qa) as Qa[],
    cases,
    announcements: (must(announcements) as Omit<AppState['announcements'][number], 'seen_by'>[]).map((a) => ({
      ...a,
      seen_by: readRows.filter((r) => r.announcement_id === a.id).map((r) => r.member_id),
    })),
    unread: unread.count ?? 0,
    serverTime: new Date().toISOString(),
  };
  return json(state);
});
