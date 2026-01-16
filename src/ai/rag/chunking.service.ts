import { Injectable, Logger } from "@nestjs/common";
import { v4 as uuidv4 } from "uuid";

export interface ChunkOptions {
  chunkSize?: number;      // Default: 512 tokens
  chunkOverlap?: number;   // Default: 50 tokens
  minChunkSize?: number;   // Default: 100 tokens
}

export interface Chunk {
  id: string;
  content: string;
  index: number;
  startChar: number;
  endChar: number;
  tokenCount: number;
  metadata: {
    documentId: string;
    projectId: string;
    tenantId: string;
    source: string;
  };
}

export interface ChunkResult {
  chunks: Chunk[];
  totalChunks: number;
  totalTokens: number;
  processingTime: number;
}

@Injectable()
export class ChunkingService {
  private readonly logger = new Logger(ChunkingService.name);
  
  private readonly DEFAULT_CHUNK_SIZE = 512;
  private readonly DEFAULT_OVERLAP = 50;
  private readonly DEFAULT_MIN_SIZE = 100;
  private readonly CHARS_PER_TOKEN = 4; // Approximate

  /**
   * Estimate token count from text
   */
  estimateTokens(text: string): number {
    return Math.ceil(text.length / this.CHARS_PER_TOKEN);
  }

  /**
   * Clean content by removing extra whitespace and normalizing
   */
  cleanContent(content: string): string {
    return content
      .replace(/\r\n/g, "\n")
      .replace(/\t/g, "  ")
      .replace(/\n{3,}/g, "\n\n")
      .replace(/[ ]{2,}/g, " ")
      .trim();
  }

  /**
   * Split content by paragraphs
   */
  splitByParagraphs(content: string): string[] {
    return content
      .split(/\n\n+/)
      .map(p => p.trim())
      .filter(p => p.length > 0);
  }

  /**
   * Split content by sentences
   */
  private splitBySentences(content: string): string[] {
    return content
      .split(/(?<=[.!?])\s+/)
      .map(s => s.trim())
      .filter(s => s.length > 0);
  }

  /**
   * Chunk a document into smaller pieces
   */
  chunkDocument(
    content: string,
    metadata: { documentId: string; projectId: string; tenantId: string; source: string },
    options?: ChunkOptions
  ): ChunkResult {
    const startTime = Date.now();
    
    const chunkSize = options?.chunkSize || this.DEFAULT_CHUNK_SIZE;
    const overlap = options?.chunkOverlap || this.DEFAULT_OVERLAP;
    const minSize = options?.minChunkSize || this.DEFAULT_MIN_SIZE;

    const cleanedContent = this.cleanContent(content);
    const paragraphs = this.splitByParagraphs(cleanedContent);
    
    const chunks: Chunk[] = [];
    let currentChunk = "";
    let currentStartChar = 0;
    let chunkIndex = 0;
    let charPosition = 0;

    for (const paragraph of paragraphs) {
      const paragraphTokens = this.estimateTokens(paragraph);
      const currentTokens = this.estimateTokens(currentChunk);

      // If adding this paragraph exceeds chunk size, save current and start new
      if (currentTokens + paragraphTokens > chunkSize && currentTokens >= minSize) {
        chunks.push(this.createChunk(
          currentChunk.trim(),
          chunkIndex,
          currentStartChar,
          charPosition,
          metadata
        ));
        
        // Start new chunk with overlap
        const overlapContent = this.getOverlapContent(currentChunk, overlap);
        currentChunk = overlapContent + paragraph;
        currentStartChar = charPosition - overlapContent.length;
        chunkIndex++;
      } else {
        currentChunk += (currentChunk ? "\n\n" : "") + paragraph;
      }
      
      charPosition += paragraph.length + 2; // +2 for paragraph separator
    }

    // Add remaining content
    if (currentChunk.trim() && this.estimateTokens(currentChunk) >= minSize) {
      chunks.push(this.createChunk(
        currentChunk.trim(),
        chunkIndex,
        currentStartChar,
        charPosition,
        metadata
      ));
    } else if (currentChunk.trim() && chunks.length > 0) {
      // Merge with previous chunk if too small
      const lastChunk = chunks[chunks.length - 1];
      lastChunk.content += "\n\n" + currentChunk.trim();
      lastChunk.endChar = charPosition;
      lastChunk.tokenCount = this.estimateTokens(lastChunk.content);
    } else if (currentChunk.trim()) {
      // First chunk is small, add anyway
      chunks.push(this.createChunk(
        currentChunk.trim(),
        chunkIndex,
        currentStartChar,
        charPosition,
        metadata
      ));
    }

    const totalTokens = chunks.reduce((sum, c) => sum + c.tokenCount, 0);
    const processingTime = Date.now() - startTime;

    this.logger.log(
      "Chunked document " + metadata.documentId + ": " + chunks.length + " chunks, " + totalTokens + " tokens in " + processingTime + "ms"
    );

    return {
      chunks,
      totalChunks: chunks.length,
      totalTokens,
      processingTime
    };
  }

  /**
   * Chunk code with language-aware splitting
   */
  chunkCode(
    content: string,
    metadata: { documentId: string; projectId: string; tenantId: string; source: string },
    options?: ChunkOptions
  ): ChunkResult {
    const startTime = Date.now();
    
    const chunkSize = options?.chunkSize || this.DEFAULT_CHUNK_SIZE;
    const overlap = options?.chunkOverlap || this.DEFAULT_OVERLAP;
    const minSize = options?.minChunkSize || this.DEFAULT_MIN_SIZE;

    const cleanedContent = this.cleanContent(content);
    
    // Split by function/class boundaries for code
    const codeBlocks = this.splitCodeByBlocks(cleanedContent);
    
    const chunks: Chunk[] = [];
    let currentChunk = "";
    let currentStartChar = 0;
    let chunkIndex = 0;
    let charPosition = 0;

    for (const block of codeBlocks) {
      const blockTokens = this.estimateTokens(block);
      const currentTokens = this.estimateTokens(currentChunk);

      if (currentTokens + blockTokens > chunkSize && currentTokens >= minSize) {
        chunks.push(this.createChunk(
          currentChunk.trim(),
          chunkIndex,
          currentStartChar,
          charPosition,
          metadata
        ));
        
        const overlapContent = this.getOverlapContent(currentChunk, overlap);
        currentChunk = overlapContent + block;
        currentStartChar = charPosition - overlapContent.length;
        chunkIndex++;
      } else {
        currentChunk += (currentChunk ? "\n\n" : "") + block;
      }
      
      charPosition += block.length + 2;
    }

    if (currentChunk.trim()) {
      chunks.push(this.createChunk(
        currentChunk.trim(),
        chunkIndex,
        currentStartChar,
        charPosition,
        metadata
      ));
    }

    const totalTokens = chunks.reduce((sum, c) => sum + c.tokenCount, 0);
    const processingTime = Date.now() - startTime;

    this.logger.log(
      "Chunked code " + metadata.documentId + ": " + chunks.length + " chunks, " + totalTokens + " tokens in " + processingTime + "ms"
    );

    return {
      chunks,
      totalChunks: chunks.length,
      totalTokens,
      processingTime
    };
  }

  private splitCodeByBlocks(content: string): string[] {
    // Split by common code boundaries
    const patterns = [
      /(?=^(?:export\s+)?(?:async\s+)?function\s+)/gm,
      /(?=^(?:export\s+)?class\s+)/gm,
      /(?=^(?:export\s+)?(?:const|let|var)\s+\w+\s*=\s*(?:async\s+)?\()/gm,
      /(?=^(?:export\s+)?interface\s+)/gm,
      /(?=^(?:export\s+)?type\s+)/gm,
    ];

    let blocks = [content];
    
    for (const pattern of patterns) {
      const newBlocks: string[] = [];
      for (const block of blocks) {
        const parts = block.split(pattern).filter(p => p.trim());
        newBlocks.push(...parts);
      }
      blocks = newBlocks;
    }

    return blocks.filter(b => b.trim());
  }

  private createChunk(
    content: string,
    index: number,
    startChar: number,
    endChar: number,
    metadata: { documentId: string; projectId: string; tenantId: string; source: string }
  ): Chunk {
    return {
      id: uuidv4(),
      content,
      index,
      startChar,
      endChar,
      tokenCount: this.estimateTokens(content),
      metadata
    };
  }

  private getOverlapContent(content: string, overlapTokens: number): string {
    const targetChars = overlapTokens * this.CHARS_PER_TOKEN;
    const sentences = this.splitBySentences(content);
    
    let overlap = "";
    for (let i = sentences.length - 1; i >= 0 && overlap.length < targetChars; i--) {
      overlap = sentences[i] + " " + overlap;
    }
    
    return overlap.trim() + "\n\n";
  }
}
