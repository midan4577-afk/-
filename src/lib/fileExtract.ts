export interface ExtractedFile {
  fileName: string;
  text: string;
}

async function extractPdfText(file: File): Promise<string> {
  const pdfjs = await import('pdfjs-dist');
  const workerUrl = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default;
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

  const buffer = await file.arrayBuffer();
  const doc = await pdfjs.getDocument({ data: buffer }).promise;
  const pageTexts: string[] = [];
  for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
    const page = await doc.getPage(pageNum);
    const content = await page.getTextContent();
    const text = content.items.map((item) => ('str' in item ? item.str : '')).join(' ');
    pageTexts.push(text);
  }
  return pageTexts.join('\n\n');
}

async function extractDocxText(file: File): Promise<string> {
  const mammoth = await import('mammoth');
  const buffer = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer: buffer });
  return result.value;
}

export async function extractTextFromFile(file: File): Promise<ExtractedFile> {
  const lowerName = file.name.toLowerCase();
  let text = '';
  try {
    if (lowerName.endsWith('.pdf') || file.type === 'application/pdf') {
      text = await extractPdfText(file);
    } else if (
      lowerName.endsWith('.docx') ||
      file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ) {
      text = await extractDocxText(file);
    } else if (lowerName.endsWith('.txt') || file.type.startsWith('text/')) {
      text = await file.text();
    } else {
      throw new Error('סוג קובץ לא נתמך. ניתן להעלות PDF, Word (docx) או טקסט.');
    }
  } catch (err) {
    throw new Error(`שגיאה בקריאת הקובץ "${file.name}": ${err instanceof Error ? err.message : String(err)}`);
  }
  return { fileName: file.name, text: text.trim() };
}
