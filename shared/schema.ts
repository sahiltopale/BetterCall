import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, integer, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Users table for Firebase authentication
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: text("email").notNull().unique(),
  displayName: text("display_name"),
  photoURL: text("photo_url"),
  firebaseUid: text("firebase_uid").notNull().unique(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  email: true,
  displayName: true,
  photoURL: true,
  firebaseUid: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

// Legal Case schema
export const legalCase = z.object({
  id: z.string(),
  caseNumber: z.string(),
  title: z.string(),
  court: z.string(),
  date: z.string(),
  judges: z.array(z.string()),
  excerpt: z.string(),
  fullText: z.string().optional(),
  citations: z.array(z.string()).optional(),
  jurisdiction: z.string(),
  documentType: z.string(),
  petitioner: z.string().optional(),
  respondent: z.string().optional(),
  verdict: z.string().optional(),
  headnotes: z.array(z.string()).optional(),
  relatedCases: z.array(z.string()).optional(),
});

export type LegalCase = z.infer<typeof legalCase>;

// Search Query schema
export const searchQuerySchema = z.object({
  query: z.string().min(1),
  filters: z.object({
    court: z.string().optional(),
    jurisdiction: z.string().optional(),
    dateFrom: z.string().optional(),
    dateTo: z.string().optional(),
    documentType: z.string().optional(),
  }).optional(),
  page: z.number().default(1),
  limit: z.number().default(10),
});

export type SearchQuery = z.infer<typeof searchQuerySchema>;

// Search Result schema
export const searchResultSchema = z.object({
  cases: z.array(legalCase),
  total: z.number(),
  page: z.number(),
  limit: z.number(),
  totalPages: z.number(),
});

export type SearchResult = z.infer<typeof searchResultSchema>;

// Judgment Analysis schema
export const judgmentAnalysisSchema = z.object({
  id: z.string(),
  documentName: z.string(),
  uploadDate: z.string(),
  analysis: z.object({
    summary: z.string(),
    keyPoints: z.array(z.string()),
    precedentsFound: z.array(z.object({
      caseId: z.string(),
      caseTitle: z.string(),
      relevance: z.string(),
      citation: z.string(),
    })),
    lawsApplied: z.array(z.object({
      provision: z.string(),
      fullText: z.string(),
      act: z.string(),
      section: z.string(),
      relevance: z.string(),
    })).optional(),
    legalIssues: z.array(z.string()),
    recommendations: z.array(z.string()),
    sentiment: z.string().optional(),
  }),
});

export type JudgmentAnalysis = z.infer<typeof judgmentAnalysisSchema>;

// Vector Search Result schema
export const vectorSearchResultSchema = z.object({
  id: z.string(),
  lawName: z.string(),
  section: z.string(),
  content: z.string(),
  relevanceScore: z.number(),
  metadata: z.object({
    act: z.string(),
    year: z.string().optional(),
    category: z.string().optional(),
  }),
});

export type VectorSearchResult = z.infer<typeof vectorSearchResultSchema>;

// Saved Search schema
export const savedSearchSchema = z.object({
  id: z.string(),
  userId: z.string(),
  query: z.string(),
  filters: z.record(z.string(), z.any()).optional(),
  savedAt: z.string(),
  name: z.string(),
});

export type SavedSearch = z.infer<typeof savedSearchSchema>;

// Draft Document schemas
export const draftDocumentSchema = z.object({
  id: z.string(),
  filename: z.string(),
  content: z.string(),
  draftType: z.string().optional(),
  metadata: z.object({
    parties: z.array(z.string()).optional(),
    court: z.string().optional(),
    dateCreated: z.string().optional(),
    category: z.string().optional(),
    tags: z.array(z.string()).optional(),
  }).optional(),
  uploadedAt: z.string(),
});

export type DraftDocument = z.infer<typeof draftDocumentSchema>;

// Draft Generation Request schema
export const draftGenerationRequestSchema = z.object({
  prompt: z.string().min(10, "Prompt must be at least 10 characters"),
  draftType: z.string().optional(),
  contextDocuments: z.array(z.string()).optional(), // Array of document IDs
  additionalContext: z.object({
    parties: z.array(z.string()).optional(),
    court: z.string().optional(),
    specificClauses: z.array(z.string()).optional(),
    tone: z.enum(["formal", "persuasive", "neutral"]).optional(),
  }).optional(),
});

export type DraftGenerationRequest = z.infer<typeof draftGenerationRequestSchema>;

// Draft Generation Response schema
export const draftGenerationResponseSchema = z.object({
  id: z.string(),
  draft: z.string(),
  metadata: z.object({
    generatedAt: z.string(),
    model: z.string(),
    tokensUsed: z.number().optional(),
    processingTime: z.string(),
  }),
  references: z.array(z.object({
    filename: z.string(),
    relevanceScore: z.number(),
    sections: z.array(z.string()).optional(),
  })),
  suggestions: z.array(z.string()).optional(),
});

export type DraftGenerationResponse = z.infer<typeof draftGenerationResponseSchema>;

// Draft Search Result schema
export const draftSearchResultSchema = z.object({
  id: z.string(),
  filename: z.string(),
  excerpt: z.string(),
  relevanceScore: z.number(),
  metadata: z.object({
    draftType: z.string().optional(),
    category: z.string().optional(),
    tags: z.array(z.string()).optional(),
  }).optional(),
});

export type DraftSearchResult = z.infer<typeof draftSearchResultSchema>;

// Counter Argument Generator schemas
export const counterArgumentRequestSchema = z.object({
  facts: z.string().min(20, "Facts must be at least 20 characters"),
  opponentPosition: z.string().min(10, "Opponent position must be at least 10 characters"),
  yourSide: z.enum(["petitioner", "respondent", "appellant", "defendant", "complainant"]).default("respondent"),
  stage: z.enum(["notice", "interim", "trial", "appeal", "revision", "writ"]).default("trial"),
  jurisdiction: z.string().optional(),
  court: z.string().optional(),
  enableRetrieval: z.boolean().default(true),
  maxAuthorities: z.number().min(1).max(20).default(8),
});

export type CounterArgumentRequest = z.infer<typeof counterArgumentRequestSchema>;

export const counterAuthoritySchema = z.object({
  title: z.string(),
  citation: z.string().optional(),
  source: z.string(),
  proposition: z.string(),
  relevance: z.string(),
  url: z.string().optional(),
});

export const counterArgumentResponseSchema = z.object({
  id: z.string(),
  generatedAt: z.string(),
  mode: z.enum(["input-only", "retrieval-enriched"]),
  summary: z.string(),
  opposingViewpoints: z.array(z.string()),
  rebuttals: z.array(z.string()),
  proceduralDefenses: z.array(z.string()),
  authorities: z.array(counterAuthoritySchema),
  strategyChecklist: z.array(z.string()),
  confidence: z.number(),
  retrievalUsed: z.object({
    ragMatches: z.number(),
    precedentMatches: z.number(),
  }),
});

export type CounterArgumentResponse = z.infer<typeof counterArgumentResponseSchema>;
