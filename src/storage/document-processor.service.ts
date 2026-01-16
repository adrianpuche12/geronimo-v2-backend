import pdfParse = require('pdf-parse');
import mammoth = require('mammoth');

/**
 * DocumentProcessorService
 *
 * Servicio para detectar tipo de archivo y extraer texto
 * Soporta: PDF, Word (docx), texto plano, markdown, JSON, HTML
 */
export class DocumentProcessorService {

  /**
   * Detecta el tipo de archivo basado en MIME type
   */
  detectFileType(mimeType: string): 'text' | 'extractable_binary' | 'binary' {
    const textMimes = [
      'text/plain',
      'text/markdown',
      'application/json',
      'text/html',
      'text/css',
      'text/javascript',
      'application/javascript',
      'text/csv',
      'application/xml',
      'text/xml'
    ];

    const extractableMimes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
      'application/msword' // .doc
    ];

    if (textMimes.includes(mimeType)) {
      return 'text';
    }

    if (extractableMimes.includes(mimeType)) {
      return 'extractable_binary';
    }

    return 'binary';
  }

  /**
   * Extrae texto de un archivo según su tipo
   * @returns Texto extraído o null si no se puede extraer
   */
  async extractText(buffer: Buffer, mimeType: string): Promise<string | null> {
    try {
      const fileType = this.detectFileType(mimeType);

      // Archivos de texto plano - conversión directa
      if (fileType === 'text') {
        return buffer.toString('utf-8');
      }

      // Archivos binarios con texto extraíble
      if (fileType === 'extractable_binary') {
        switch (mimeType) {
          case 'application/pdf':
            return await this.extractPDF(buffer);

          case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
          case 'application/msword':
            return await this.extractWord(buffer);

          default:
            console.warn(`[DocumentProcessor] No extractor for mime type: ${mimeType}`);
            return null;
        }
      }

      // Archivos binarios sin texto extraíble (imágenes, videos, etc.)
      console.log(`[DocumentProcessor] Binary file without text extraction: ${mimeType}`);
      return null;

    } catch (error) {
      console.error(`[DocumentProcessor] Error extracting text:`, error.message);
      return null;
    }
  }

  /**
   * Extrae texto de un PDF
   */
  private async extractPDF(buffer: Buffer): Promise<string> {
    try {
      const data = await pdfParse(buffer);
      const text = data.text.trim();

      console.log(`[DocumentProcessor] PDF extracted: ${text.length} characters, ${data.numpages} pages`);

      if (!text) {
        return '(PDF sin texto extraíble - puede ser imagen escaneada)';
      }

      return text;
    } catch (error) {
      console.error('[DocumentProcessor] Error extracting PDF:', error.message);
      throw new Error(`Error al extraer texto del PDF: ${error.message}`);
    }
  }

  /**
   * Extrae texto de un documento Word (.docx)
   */
  private async extractWord(buffer: Buffer): Promise<string> {
    try {
      const result = await mammoth.extractRawText({ buffer });
      const text = result.value.trim();

      console.log(`[DocumentProcessor] Word extracted: ${text.length} characters`);

      if (result.messages.length > 0) {
        console.warn('[DocumentProcessor] Word extraction warnings:', result.messages);
      }

      if (!text) {
        return '(Documento Word sin texto extraíble)';
      }

      return text;
    } catch (error) {
      console.error('[DocumentProcessor] Error extracting Word:', error.message);
      throw new Error(`Error al extraer texto del documento Word: ${error.message}`);
    }
  }

  /**
   * Valida si un archivo debe almacenarse en B2 basado en su tamaño
   */
  shouldStoreInB2(fileSize: number, fileType: 'text' | 'extractable_binary' | 'binary'): boolean {
    const SIZE_1MB = 1024 * 1024;
    const SIZE_5MB = 5 * 1024 * 1024;

    // Archivos de texto pequeños: PostgreSQL
    if (fileType === 'text' && fileSize < SIZE_1MB) {
      return false;
    }

    // Archivos binarios extraíbles pequeños: PostgreSQL (solo texto extraído)
    if (fileType === 'extractable_binary' && fileSize < SIZE_5MB) {
      return true; // Guardar original en B2, texto en PostgreSQL
    }

    // Todo lo demás: B2
    return true;
  }

  /**
   * Obtiene información sobre el archivo
   */
  getFileInfo(buffer: Buffer, mimeType: string) {
    const fileType = this.detectFileType(mimeType);
    const fileSize = buffer.length;
    const shouldStoreInB2 = this.shouldStoreInB2(fileSize, fileType);

    return {
      fileType,
      fileSize,
      shouldStoreInB2,
      canExtractText: fileType === 'text' || fileType === 'extractable_binary'
    };
  }
}

// Singleton instance
export const documentProcessorService = new DocumentProcessorService();
