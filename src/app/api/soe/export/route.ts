import { db, must } from '@/lib/server/db';
import { handle, json } from '@/lib/server/http';
import { requireMember } from '@/lib/server/identity';

export const dynamic = 'force-dynamic';

// Every SOE with its full text, for the group's PDF download.
export const GET = handle(async () => {
  await requireMember();
  const rows = must(
    await db()
      .from('soe')
      .select('id,member_id,competency,competency_type,level1,level2,level3,status,submitted_at')
      .order('competency')
      .order('member_id'),
  );
  return json(rows);
});
