// Builds the group's SOE book in the browser: each competency by name, then every person's
// Level 1, 2 and 3 statements one after another.

export type SoeExportRow = {
  id: string;
  member_id: string;
  competency: string;
  competency_type: string;
  level1: string;
  level2: string;
  level3: string;
  status: string;
  submitted_at: string | null;
};

type Person = { id: string; name: string; sort: number };

const LEVELS = ['Knowledge and understanding', 'Application of knowledge', 'Reasoned advice'];
const BRONZE: [number, number, number] = [115, 95, 59];
const INK: [number, number, number] = [29, 35, 43];
const MUTED: [number, number, number] = [93, 102, 115];

// The built-in PDF fonts only cover Western European characters, so typographic marks are
// turned into their plain forms and anything else outside that range is dropped.
function plain(text: string) {
  return text
    .replace(/[‘’‚′]/g, "'")
    .replace(/[“”„″]/g, '"')
    .replace(/[–—−]/g, '-')
    .replace(/[•●▪‣⁃]/g, '-')
    .replace(/…/g, '...')
    .replace(/ /g, ' ')
    .replace(/\r\n?/g, '\n')
    .replace(/[^\n\x20-\x7E\xA0-\xFF]/g, '');
}

export async function downloadSoePdf(rows: SoeExportRow[], people: Person[], options: { competency?: string } = {}) {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 18;
  const width = W - M * 2;
  let y = M;

  const who = new Map(people.map((p) => [p.id, p]));
  const label = (id: string) => `${who.get(id)?.name ?? 'Former member'} · ${id}`;

  const ensure = (needed: number) => {
    if (y + needed > H - M) {
      doc.addPage();
      y = M;
    }
  };
  const write = (text: string, size: number, color: [number, number, number], style: 'normal' | 'bold' | 'italic' = 'normal', gap = 0) => {
    doc.setFont('helvetica', style);
    doc.setFontSize(size);
    doc.setTextColor(...color);
    const lineHeight = size * 0.3528 * 1.45;
    for (const para of plain(text).split('\n')) {
      const lines: string[] = para.trim() ? doc.splitTextToSize(para, width) : [''];
      for (const line of lines) {
        ensure(lineHeight);
        doc.text(line, M, y + lineHeight * 0.75);
        y += lineHeight;
      }
    }
    y += gap;
  };
  const rule = () => {
    ensure(4);
    doc.setDrawColor(...BRONZE);
    doc.setLineWidth(0.3);
    doc.line(M, y, W - M, y);
    y += 4;
  };

  const chosen = options.competency ? rows.filter((r) => r.competency === options.competency) : rows;
  const competencies = [...new Set(chosen.map((r) => r.competency))].sort((a, b) => a.localeCompare(b));
  const today = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

  // Cover page with the contents.
  y = 60;
  write('GROUP 03 · RICS APC', 10, BRONZE, 'bold', 4);
  write(options.competency ? `SOE · ${options.competency}` : 'SOE register', 30, INK, 'bold', 4);
  write(`Statements of experience by competency. Downloaded ${today}.`, 11, MUTED, 'normal', 12);
  rule();
  competencies.forEach((c, i) => {
    const count = chosen.filter((r) => r.competency === c).length;
    write(`${i + 1}.  ${c}  (${count} ${count === 1 ? 'person' : 'people'})`, 11, INK, 'normal', 1);
  });

  for (const competency of competencies) {
    doc.addPage();
    y = M;
    const entries = chosen
      .filter((r) => r.competency === competency)
      .sort((a, b) => (who.get(a.member_id)?.sort ?? 999) - (who.get(b.member_id)?.sort ?? 999));
    write('COMPETENCY', 9, BRONZE, 'bold', 1);
    write(competency, 22, INK, 'bold', 2);
    write(`${entries.length} ${entries.length === 1 ? 'person' : 'people'} · ${entries[0]?.competency_type ?? ''}`, 10, MUTED, 'normal', 4);
    rule();

    entries.forEach((entry, index) => {
      if (index > 0) y += 6;
      ensure(30);
      write(label(entry.member_id), 15, INK, 'bold', 1);
      const submitted = entry.submitted_at
        ? `Submitted ${new Date(entry.submitted_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).replace('Sept', 'Sep')}`
        : 'Not submitted yet';
      write(`${submitted} · Review status: ${entry.status}`, 9.5, MUTED, 'normal', 3);
      [entry.level1, entry.level2, entry.level3].forEach((text, i) => {
        ensure(16);
        write(`LEVEL ${i + 1} · ${LEVELS[i].toUpperCase()}`, 8.5, BRONZE, 'bold', 1.5);
        if (text.trim()) write(text.trim(), 10.5, INK, 'normal', 4);
        else write('Not added yet.', 10.5, MUTED, 'italic', 4);
      });
    });
  }

  const pages = doc.getNumberOfPages();
  for (let n = 1; n <= pages; n++) {
    doc.setPage(n);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(...MUTED);
    doc.text('Group 03 · SOE register', M, H - 8);
    doc.text(`${n} / ${pages}`, W - M, H - 8, { align: 'right' });
  }

  const slug = options.competency ? options.competency.replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '') : 'all-competencies';
  doc.save(`Group-03-SOE-${slug}.pdf`);
}
