import { execFile } from 'node:child_process';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export async function isPdftkAvailable() {
  try {
    await execFileAsync('pdftk', ['--version']);
    return true;
  } catch {
    return false;
  }
}

function escapeXml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function buildXfdf(fieldValues) {
  const fields = Object.entries(fieldValues)
    .filter(([, value]) => value != null && String(value).trim() !== '')
    .map(
      ([name, value]) =>
        `<field name="${escapeXml(name)}"><value>${escapeXml(value)}</value></field>`,
    )
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<xfdf xmlns="http://ns.adobe.com/xfdf/" xml:space="preserve">
<fields>
${fields}
</fields>
</xfdf>`;
}

export async function fillPdfWithPdftk(templatePath, fieldValues) {
  const dir = await mkdtemp(join(tmpdir(), 'verifill-pdf-'));
  const xfdfPath = join(dir, 'data.xfdf');
  const filledPath = join(dir, 'filled.pdf');

  try {
    await writeFile(xfdfPath, buildXfdf(fieldValues), 'utf8');
    await execFileAsync('pdftk', [
      templatePath,
      'fill_form',
      xfdfPath,
      'output',
      filledPath,
      'need_appearances',
    ]);
    return await readFile(filledPath);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
