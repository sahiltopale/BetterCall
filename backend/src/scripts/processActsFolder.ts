/**
 * Script to process Act PDFs from a folder and upload to Pinecone for RAG.
 *
 * Usage examples:
 *   npm run process-acts
 *   npm run process-acts -- --folder "d:/projects/lawdoc/acts_maharashtra_pdfs"
 *   npm run process-acts -- --index legal-acts --limit 100
 */

import dotenv from 'dotenv';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { promises as fs } from 'fs';
import { DraftProcessor } from '../services/draftProcessor';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

type CliOptions = {
  folder: string;
  indexName: string;
  limit?: number;
};

function parseArgs(argv: string[]): CliOptions {
  const args = new Map<string, string>();
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith('--')) {
      continue;
    }
    const key = arg.slice(2);
    const value = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : 'true';
    args.set(key, value);
  }

  const defaultActsFolder = join(__dirname, '..', '..', '..', '..', 'lawdoc', 'acts_maharashtra_pdfs');
  const folder = args.get('folder') || process.env.ACTS_FOLDER || defaultActsFolder;
  const indexName = args.get('index') || process.env.PINECONE_ACTS_INDEX || 'legal-acts';
  const limitRaw = args.get('limit');
  const limit = limitRaw ? Number(limitRaw) : undefined;

  if (limitRaw && (!Number.isFinite(limit) || limit <= 0)) {
    throw new Error('Invalid --limit value. It must be a positive number.');
  }

  return { folder, indexName, limit };
}

function parseFilenameMetadata(filename: string): { category: string; tags: string[] } {
  const normalized = filename.replace(/\.pdf$/i, '');
  const parts = normalized.split('__');
  const actTag = parts.find((p) => /^act-\d+/i.test(p));
  const yearTag = parts.find((p) => /\b(18|19|20)\d{2}\b/.test(p));

  const tags = ['act', 'maharashtra'];
  if (actTag) tags.push(actTag.toLowerCase());
  if (yearTag) tags.push(yearTag.toLowerCase());

  return {
    category: 'acts',
    tags,
  };
}

async function main() {
  console.log('🚀 Starting acts ingestion for Pinecone RAG...\n');

  try {
    const { folder, indexName, limit } = parseArgs(process.argv.slice(2));

    const pineconeKey = process.env.PINECONE_API_KEY || process.env.VITE_PINECONE_API_KEY;
    const geminiKey =
      process.env.GEMINI_API_KEY ||
      process.env.VITE_GEMINI_API_KEY ||
      process.env.VITE_GOOGLE_AI_API_KEY ||
      process.env.GOOGLE_AI_API_KEY;

    if (!pineconeKey) {
      throw new Error('PINECONE_API_KEY is not set in environment variables');
    }
    if (!geminiKey) {
      throw new Error('GEMINI_API_KEY is not set in environment variables');
    }

    const stat = await fs.stat(folder).catch(() => null);
    if (!stat || !stat.isDirectory()) {
      throw new Error(`Acts folder does not exist or is not a directory: ${folder}`);
    }

    const files = await fs.readdir(folder);
    const pdfFiles = files.filter((file) => file.toLowerCase().endsWith('.pdf'));
    const selectedFiles = typeof limit === 'number' ? pdfFiles.slice(0, limit) : pdfFiles;

    if (selectedFiles.length === 0) {
      throw new Error(`No .pdf files found in folder: ${folder}`);
    }

    console.log(`📁 Folder: ${folder}`);
    console.log(`🧠 Index: ${indexName}`);
    console.log(`📄 PDFs to process: ${selectedFiles.length}${typeof limit === 'number' ? ` (limited from ${pdfFiles.length})` : ''}\n`);

    const processor = new DraftProcessor(pineconeKey, geminiKey, indexName);
    await processor.initialize();

    let completed = 0;
    for (const file of selectedFiles) {
      const metadata = parseFilenameMetadata(file);
      const filePath = join(folder, file);
      await processor.processPDFFile(filePath, {
        draftType: 'act',
        category: metadata.category,
        tags: metadata.tags,
      });
      completed++;
      console.log(`✅ Completed ${completed}/${selectedFiles.length}: ${file}`);
    }

    const stats = await processor.getStats();
    console.log('\n📊 Index stats:');
    console.log(JSON.stringify(stats, null, 2));
    console.log('\n✅ Acts ingestion completed successfully.');
  } catch (error: any) {
    console.error('\n❌ Acts ingestion failed:', error.message);
    console.error(error);
    process.exit(1);
  }
}

main();