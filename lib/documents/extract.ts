import 'server-only'

// Text extraction from PDF, DOCX, TXT, MD.
// Never runs in browser — server-only guard prevents accidental client import.

export type ExtractionResult = {
  text: string
  pageCount?: number
  error?: string
}

export async function extractText(
  buffer: Buffer,
  mimeType: string,
  fileName: string,
): Promise<ExtractionResult> {
  const ext = fileName.split('.').pop()?.toLowerCase() ?? ''

  if (mimeType === 'application/pdf' || ext === 'pdf') {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const pdfMod   = await import('pdf-parse') as any
      const pdfParse = pdfMod.default ?? pdfMod
      const data = await pdfParse(buffer)
      return { text: data.text.trim(), pageCount: data.numpages }
    } catch (err) {
      return { text: '', error: `PDF extraction failed: ${(err as Error).message}` }
    }
  }

  if (
    mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    ext === 'docx'
  ) {
    try {
      const mammoth = await import('mammoth')
      const result  = await mammoth.extractRawText({ buffer })
      return { text: result.value.trim() }
    } catch (err) {
      return { text: '', error: `DOCX extraction failed: ${(err as Error).message}` }
    }
  }

  if (['text/plain', 'text/markdown', 'text/x-markdown'].includes(mimeType) || ['txt', 'md'].includes(ext)) {
    return { text: buffer.toString('utf-8').trim() }
  }

  return { text: '', error: `Unsupported file type: ${mimeType} (.${ext})` }
}
