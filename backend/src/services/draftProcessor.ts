import { Pinecone } from '@pinecone-database/pinecone';
import pdfParse from 'pdf-parse';
import { promises as fs } from 'fs';
import { join, basename, dirname } from 'path';
import { createHash } from 'crypto';
import { GoogleGenerativeAI } from '@google/generative-ai';

interface DraftChunk {
  id: string;
  text: string;
  filename: string;
  chunkIndex: number;
  totalChunks: number;
  metadata: {
    draftType?: string;
    category?: string;
    tags?: string[];
  };
}

interface SearchResult {
  id: string;
  filename: string;
  text: string;
  score: number;
  metadata: any;
}

export class DraftProcessor {
  private pinecone: Pinecone;
  private indexName: string;
  private gemini: GoogleGenerativeAI;
  private index: any;

  constructor(
    pineconeApiKey: string,
    geminiApiKey: string,
    indexName: string = 'legal-drafts'
  ) {
    this.pinecone = new Pinecone({ apiKey: pineconeApiKey });
    this.gemini = new GoogleGenerativeAI(geminiApiKey);
    this.indexName = indexName;
  }

  /**
   * Initialize the Pinecone index
   */
  async initialize(): Promise<void> {
    try {
      // Check if index exists
      const indexes = await this.pinecone.listIndexes();
      const indexExists = indexes.indexes?.some(idx => idx.name === this.indexName);

      if (!indexExists) {
        console.log(`Creating Pinecone index: ${this.indexName}`);
        await this.pinecone.createIndex({
          name: this.indexName,
          dimension: 3072, // gemini-embedding-001 dimension
          metric: 'cosine',
          spec: {
            serverless: {
              cloud: 'aws',
              region: 'us-east-1'
            }
          }
        });
        
        // Wait for index to be ready
        await this.waitForIndexReady();
      }

      this.index = this.pinecone.Index(this.indexName);
      console.log('Draft processor initialized successfully');
    } catch (error) {
      console.error('Error initializing draft processor:', error);
      throw error;
    }
  }

  /**
   * Wait for the index to be ready
   */
  private async waitForIndexReady(): Promise<void> {
    let isReady = false;
    let attempts = 0;
    const maxAttempts = 30;

    while (!isReady && attempts < maxAttempts) {
      try {
        const indexDescription = await this.pinecone.describeIndex(this.indexName);
        isReady = indexDescription.status?.ready ?? false;
        
        if (!isReady) {
          await new Promise(resolve => setTimeout(resolve, 2000));
          attempts++;
        }
      } catch (error) {
        console.error('Error checking index status:', error);
        await new Promise(resolve => setTimeout(resolve, 2000));
        attempts++;
      }
    }

    if (!isReady) {
      throw new Error('Index did not become ready in time');
    }
  }

  /**
   * Extract text from a PDF buffer
   */
  async extractTextFromPDF(buffer: Buffer): Promise<string> {
    try {
      const data = await pdfParse(buffer);
      return data.text;
    } catch (error) {
      console.error('Error extracting text from PDF:', error);
      throw new Error('Failed to extract text from PDF');
    }
  }

  /**
   * Extract text from a PDF file
   */
  async extractTextFromPDFFile(filePath: string): Promise<string> {
    try {
      const buffer = await fs.readFile(filePath);
      return this.extractTextFromPDF(buffer);
    } catch (error) {
      console.error(`Error reading PDF file ${filePath}:`, error);
      throw error;
    }
  }

  /**
   * Split text into overlapping chunks
   */
  chunkText(text: string, chunkSize: number = 1000, overlap: number = 200): string[] {
    const chunks: string[] = [];
    let start = 0;

    while (start < text.length) {
      const end = Math.min(start + chunkSize, text.length);
      const chunk = text.slice(start, end);
      chunks.push(chunk);
      start += chunkSize - overlap;
    }

    return chunks;
  }

  /**
   * Generate embeddings using Gemini
   */
  async generateEmbedding(text: string): Promise<number[]> {
    try {
      const model = this.gemini.getGenerativeModel({ model: 'gemini-embedding-001' }, { apiVersion: 'v1beta' });
      const result = await model.embedContent(text);
      return result.embedding.values;
    } catch (error) {
      console.error('Error generating embedding:', error);
      throw error;
    }
  }

  /**
   * Process a single PDF file and store in Pinecone
   */
  async processPDFFile(
    filePath: string,
    metadata?: { draftType?: string; category?: string; tags?: string[] }
  ): Promise<void> {
    try {
      const filename = basename(filePath);
      console.log(`Processing ${filename}...`);

      // Extract text
      const text = await this.extractTextFromPDFFile(filePath);

      // Process the text
      await this.processTextContent(filename, text, metadata);

      console.log(`Successfully processed ${filename}`);
    } catch (error) {
      console.error(`Error processing file ${filePath}:`, error);
      throw error;
    }
  }

  /**
   * Process text content and store in Pinecone
   */
  async processTextContent(
    filename: string,
    text: string,
    metadata?: { draftType?: string; category?: string; tags?: string[] }
  ): Promise<void> {
    // Chunk the text
    const chunks = this.chunkText(text);

    // Process chunks in batches
    const batchSize = 20;
    for (let i = 0; i < chunks.length; i += batchSize) {
      const batch = chunks.slice(i, i + batchSize);
      const vectors = await Promise.all(
        batch.map(async (chunk, batchIndex) => {
          const globalIndex = i + batchIndex;
          const embedding = await this.generateEmbedding(chunk);
          const vectorId = createHash('md5')
            .update(`${filename}_${globalIndex}`)
            .digest('hex');

          return {
            id: vectorId,
            values: embedding,
            metadata: {
              filename,
              chunkIndex: globalIndex,
              totalChunks: chunks.length,
              text: chunk,
              draftType: metadata?.draftType || 'unknown',
              category: metadata?.category || 'general',
              tags: metadata?.tags || [],
            },
          };
        })
      );

      // Upsert to Pinecone
      await this.index.upsert(vectors);
    }
  }

  /**
   * Process all PDFs in a folder
   */
  async processDraftsFolder(folderPath: string): Promise<void> {
    try {
      const files = await fs.readdir(folderPath);
      const pdfFiles = files.filter(file => file.toLowerCase().endsWith('.pdf'));

      console.log(`Found ${pdfFiles.length} PDF files to process`);

      for (const file of pdfFiles) {
        const filePath = join(folderPath, file);
        await this.processPDFFile(filePath);
      }

      console.log(`Successfully processed ${pdfFiles.length} files`);
    } catch (error) {
      console.error('Error processing drafts folder:', error);
      throw error;
    }
  }

  /**
   * Search for similar draft content
   */
  async searchSimilarDrafts(query: string, topK: number = 5): Promise<SearchResult[]> {
    try {
      // Generate embedding for query
      const queryEmbedding = await this.generateEmbedding(query);

      // Query Pinecone
      const results = await this.index.query({
        vector: queryEmbedding,
        topK,
        includeMetadata: true,
      });

      // Format results
      return results.matches.map((match: any) => ({
        id: match.id,
        filename: match.metadata.filename,
        text: match.metadata.text,
        score: match.score,
        metadata: {
          draftType: match.metadata.draftType,
          category: match.metadata.category,
          tags: match.metadata.tags,
          chunkIndex: match.metadata.chunkIndex,
          totalChunks: match.metadata.totalChunks,
        },
      }));
    } catch (error) {
      console.error('Error searching similar drafts:', error);
      throw error;
    }
  }

  /**
   * Search with filters
   */
  async searchWithFilters(
    query: string,
    filters: {
      draftType?: string;
      category?: string;
      tags?: string[];
    },
    topK: number = 5
  ): Promise<SearchResult[]> {
    try {
      const queryEmbedding = await this.generateEmbedding(query);

      // Build filter object
      const filter: any = {};
      if (filters.draftType) {
        filter.draftType = { $eq: filters.draftType };
      }
      if (filters.category) {
        filter.category = { $eq: filters.category };
      }
      if (filters.tags && filters.tags.length > 0) {
        filter.tags = { $in: filters.tags };
      }

      const results = await this.index.query({
        vector: queryEmbedding,
        topK,
        filter,
        includeMetadata: true,
      });

      return results.matches.map((match: any) => ({
        id: match.id,
        filename: match.metadata.filename,
        text: match.metadata.text,
        score: match.score,
        metadata: match.metadata,
      }));
    } catch (error) {
      console.error('Error searching with filters:', error);
      throw error;
    }
  }

  /**
   * Delete all vectors for a specific file
   */
  async deleteFileVectors(filename: string): Promise<void> {
    try {
      // Query to get all vector IDs for this file
      const dummyEmbedding = new Array(1536).fill(0);
      const results = await this.index.query({
        vector: dummyEmbedding,
        topK: 10000,
        filter: {
          filename: { $eq: filename }
        },
        includeMetadata: false,
      });

      const ids = results.matches.map((match: any) => match.id);
      
      if (ids.length > 0) {
        await this.index.deleteMany(ids);
        console.log(`Deleted ${ids.length} vectors for file ${filename}`);
      }
    } catch (error) {
      console.error(`Error deleting vectors for ${filename}:`, error);
      throw error;
    }
  }

  /**
   * Get index statistics
   */
  async getStats(): Promise<any> {
    try {
      const stats = await this.index.describeIndexStats();
      return stats;
    } catch (error) {
      console.error('Error getting index stats:', error);
      throw error;
    }
  }
}

// Singleton instance
let draftProcessorInstance: DraftProcessor | null = null;

export async function initializeDraftProcessor(): Promise<DraftProcessor> {
  if (draftProcessorInstance) {
    return draftProcessorInstance;
  }

  const pineconeApiKey = process.env.PINECONE_API_KEY || process.env.VITE_PINECONE_API_KEY;
  const geminiApiKey = process.env.GEMINI_API_KEY || 
                       process.env.VITE_GEMINI_API_KEY || 
                       process.env.VITE_GOOGLE_AI_API_KEY ||
                       process.env.GOOGLE_AI_API_KEY;

  if (!pineconeApiKey) {
    throw new Error('PINECONE_API_KEY is not set');
  }
  if (!geminiApiKey) {
    throw new Error('GEMINI_API_KEY is not set');
  }

  draftProcessorInstance = new DraftProcessor(pineconeApiKey, geminiApiKey, 'legal-drafts');
  await draftProcessorInstance.initialize();

  return draftProcessorInstance;
}

export function getDraftProcessor(): DraftProcessor {
  if (!draftProcessorInstance) {
    throw new Error('Draft processor not initialized. Call initializeDraftProcessor first.');
  }
  return draftProcessorInstance;
}
