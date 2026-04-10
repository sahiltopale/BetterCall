import type { Express, Request } from "express";
import { createServer, type Server } from "http";
import multer from "multer";
import pdfParse from "pdf-parse";
import { storage } from "./storage";
import { ragService } from "./services/ragService";
import { indiaKanoonService } from "./services/indiaKanoonService"; 
import { aiService } from "./services/aiService";
import sharedSchema from "../shared/schema";

const { counterArgumentRequestSchema, searchQuerySchema } = sharedSchema as any;

// Extend Request interface for file uploads
interface MulterRequest extends Request {
  file?: Express.Multer.File;
}

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req: any, file: any, cb: any) => {
    if (file.mimetype === 'application/pdf' || 
        file.mimetype.includes('document') ||
        file.originalname.endsWith('.pdf')) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed'), false);
    }
  }
});

export async function registerRoutes(app: Express): Promise<Server> {
  // Health check endpoint
  app.get("/api/health", (req, res) => {
    res.json({ 
      status: "ok", 
      timestamp: new Date().toISOString(),
      service: "BetterCallAI Backend" 
    });
  });

  // Search cases endpoint
  app.get("/api/search", async (req, res) => {
    try {
      const query = req.query.q as string || "";
      const filters = {
        court: req.query.court as string,
        jurisdiction: req.query.jurisdiction as string,
        documentType: req.query.documentType as string,
        dateFrom: req.query.dateFrom as string,
        dateTo: req.query.dateTo as string,
        page: parseInt(req.query.page as string) || 1,
        limit: parseInt(req.query.limit as string) || 10,
      };

      const results = await storage.searchCases(query, filters);
      res.json(results);
    } catch (error: any) {
      console.error("Search error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Get case by ID
  app.get("/api/case/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const caseData = await storage.getCaseById(id);
      
      if (!caseData) {
        return res.status(404).json({ error: "Case not found" });
      }

      res.json(caseData);
    } catch (error: any) {
      console.error("Get case error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Analyze judgment endpoint with RAG integration
  app.post("/api/analyze-judgment", upload.single('document'), async (req: MulterRequest, res) => {
    try {
      let documentText = "";
      let documentName = "uploaded-document.pdf";

      // Handle file upload
      if (req.file) {
        documentName = req.file.originalname;
        
        if (req.file.mimetype === 'application/pdf') {
          // Parse PDF content
          try {
            const pdfData = await pdfParse(req.file.buffer);
            documentText = pdfData.text;
          } catch (pdfError) {
            console.error("PDF parsing error:", pdfError);
            return res.status(400).json({ error: "Failed to parse PDF file" });
          }
        } else {
          documentText = req.file.buffer.toString('utf-8');
        }
      } else if (req.body.content) {
        // Handle text content directly
        documentText = req.body.content;
        documentName = req.body.documentName || "text-input.txt";
      } else {
        return res.status(400).json({ error: "No document or content provided" });
      }

      if (!documentText.trim()) {
        return res.status(400).json({ error: "Document appears to be empty or unreadable" });
      }

      // Detect document type
      const documentTypeInfo = aiService.detectDocumentType(documentText);
      
      // Use RAG for comprehensive analysis
      const ragAnalysis = await ragService.analyzeJudgmentWithRAG(documentText);
      
      // Get additional AI insights
      const aiAnalysis = await aiService.analyzeLegalDocument(documentText);
      
      // Search for relevant precedents using India Kanoon
      const precedents = await indiaKanoonService.findRelevantPrecedents(documentText);

      // Create enhanced summary with document type information
      const enhancedSummary = `[Document Type: ${documentTypeInfo.type} (${Math.round(documentTypeInfo.confidence * 100)}% confidence)]\n\n${ragAnalysis.summary}${documentTypeInfo.type !== "Judgment/Order" ? `\n\n⚠️ NOTE: This document is classified as "${documentTypeInfo.type}" rather than a judgment. Analysis has been adapted accordingly. Key indicators: ${documentTypeInfo.indicators.join("; ")}` : ""}`;

      // Combine results into comprehensive analysis
      const analysis = {
        id: `analysis-${Date.now()}`,
        documentName,
        uploadDate: new Date().toISOString(),
        documentType: documentTypeInfo.type,
        documentTypeConfidence: documentTypeInfo.confidence,
        documentTypeIndicators: documentTypeInfo.indicators,
        analysis: {
          summary: enhancedSummary,
          keyPoints: ragAnalysis.keyPoints,
          lawsApplied: ragAnalysis.lawsApplied.map(law => ({
            provision: law.provision,
            fullText: law.fullText,
            act: law.act,
            section: law.section,
            relevance: law.relevance
          })),
          precedentsFound: ragAnalysis.relevantLaws.slice(0, 5).map(law => ({
            caseId: law.id,
            caseTitle: law.lawName,
            relevance: `Relevant for ${law.metadata.category.toLowerCase()} - ${law.section}`,
            citation: law.metadata.citation || law.section
          })),
          legalIssues: aiAnalysis.legalIssues,
          recommendations: ragAnalysis.recommendations,
          sentiment: `Analysis confidence: ${Math.round(ragAnalysis.confidence * 100)}%`,
          externalPrecedents: precedents.slice(0, 3).map(p => ({
            title: p.title,
            court: p.court,
            date: p.docdisplaydate,
            url: p.url
          }))
        },
        confidence: ragAnalysis.confidence,
        processingTime: "2-3 seconds"
      };
      
      res.json(analysis);
    } catch (error: any) {
      console.error("Analysis error:", error);
      res.status(500).json({ 
        error: error.message,
        fallback: await storage.analyzeJudgment("fallback-document", "")
      });
    }
  });

  // Enhanced vector search endpoint with RAG
  app.get("/api/vector-search", async (req, res) => {
    try {
      const query = req.query.q as string || "";
      const limit = parseInt(req.query.limit as string) || 10;
      
      // Use RAG service for semantic search
      const ragResults = await ragService.searchRelevantLaws(query, limit);
      
      // Also get traditional storage results for fallback
      const storageResults = await storage.vectorSearch(query);
      
      // Combine and rank results
      const combinedResults = {
        query,
        semanticResults: ragResults,
        fallbackResults: storageResults,
        totalFound: ragResults.length,
        confidence: ragResults.length > 0 ? 
          ragResults.reduce((sum, r) => sum + r.relevanceScore, 0) / ragResults.length : 0
      };
      
      res.json(combinedResults);
    } catch (error: any) {
      console.error("Vector search error:", error);
      const fallbackResults = await storage.vectorSearch(req.query.q as string || "");
      res.status(500).json({ 
        error: error.message,
        fallback: fallbackResults
      });
    }
  });

  // RAG-specific endpoints
  app.post("/api/rag/upload-document", async (req, res) => {
    try {
      const { document } = req.body;
      
      if (!document || !document.id || !document.content) {
        return res.status(400).json({ error: "Invalid document format" });
      }
      
      await ragService.uploadLegalDocument(document);
      res.json({ success: true, message: "Document uploaded to vector database" });
    } catch (error: any) {
      console.error("Document upload error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/rag/batch-upload", async (req, res) => {
    try {
      const { documents, batchSize = 100 } = req.body;
      
      if (!documents || !Array.isArray(documents)) {
        return res.status(400).json({ error: "Documents array is required" });
      }
      
      await ragService.batchUploadDocuments(documents, batchSize);
      res.json({ 
        success: true, 
        message: `Successfully uploaded ${documents.length} documents`,
        processed: documents.length
      });
    } catch (error: any) {
      console.error("Batch upload error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // AI-powered legal chat endpoint
  app.post("/api/ai/chat", async (req, res) => {
    try {
      const { messages, context } = req.body;
      
      if (!messages || !Array.isArray(messages)) {
        return res.status(400).json({ error: "Messages array is required" });
      }
      
      const response = await aiService.chatWithLegalAI(messages);
      
      res.json({
        response,
        timestamp: new Date().toISOString(),
        context: context || null
      });
    } catch (error: any) {
      console.error("AI chat error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Legal entity extraction endpoint
  app.post("/api/ai/extract-entities", async (req, res) => {
    try {
      const { text } = req.body;
      
      if (!text) {
        return res.status(400).json({ error: "Text is required" });
      }
      
      const entities = await aiService.extractLegalEntities(text);
      res.json(entities);
    } catch (error: any) {
      console.error("Entity extraction error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/counter-arguments", async (req, res) => {
    try {
      const parsed = counterArgumentRequestSchema.safeParse(req.body || {});
      if (!parsed.success) {
        return res.status(400).json({
          error: "Invalid request payload",
          details: parsed.error.flatten(),
        });
      }

      const input = parsed.data;
      const maxAuthorities = input.maxAuthorities || 8;
      const retrievalEnabled = input.enableRetrieval !== false;

      let ragMatches: any[] = [];
      let precedents: any[] = [];

      if (retrievalEnabled) {
        const retrievalQuery = `${input.facts}\nOpponent Position: ${input.opponentPosition}\nStage: ${input.stage}`;

        try {
          ragMatches = await ragService.searchRelevantLaws(retrievalQuery, maxAuthorities);
        } catch (error) {
          console.warn("RAG retrieval failed for counter arguments:", error);
        }

        try {
          precedents = await indiaKanoonService.findRelevantPrecedents(retrievalQuery);
        } catch (error) {
          console.warn("Precedent retrieval failed for counter arguments:", error);
        }
      }

      const authorityPool = [
        ...ragMatches.map((law: any) => ({
          title: law.lawName || `${law.metadata?.act || "Statute"} ${law.section || ""}`.trim(),
          citation: law.metadata?.citation,
          source: "RAG",
          proposition: law.content || `${law.section || "Provision"} from ${law.metadata?.act || "relevant act"}`,
          relevance: `Semantic relevance ${Math.round((law.relevanceScore || 0) * 100)}%`,
          url: undefined,
        })),
        ...precedents.map((p: any) => ({
          title: p.title || "Relevant precedent",
          citation: p.tid ? `IK-${p.tid}` : undefined,
          source: p.court || "India Kanoon",
          proposition: p.headline || p.title || "Potentially relevant precedent",
          relevance: `Date ${p.docdisplaydate || "Unknown"}`,
          url: p.url,
        })),
      ].slice(0, maxAuthorities);

      const generated = await aiService.generateCounterArguments({
        facts: input.facts,
        opponentPosition: input.opponentPosition,
        yourSide: input.yourSide,
        stage: input.stage,
        jurisdiction: input.jurisdiction,
        court: input.court,
        authorities: authorityPool,
      });

      const response = {
        id: `counter-${Date.now()}`,
        generatedAt: new Date().toISOString(),
        mode: authorityPool.length > 0 ? "retrieval-enriched" : "input-only",
        summary: generated.summary,
        opposingViewpoints: generated.opposingViewpoints,
        rebuttals: generated.rebuttals,
        proceduralDefenses: generated.proceduralDefenses,
        authorities: authorityPool,
        strategyChecklist: generated.strategyChecklist,
        confidence: generated.confidence,
        retrievalUsed: {
          ragMatches: ragMatches.length,
          precedentMatches: precedents.length,
        },
      };

      res.json(response);
    } catch (error: any) {
      console.error("Counter-argument generation error:", error);
      res.status(500).json({ error: error.message || "Failed to generate counter arguments" });
    }
  });

  // Draft Generation endpoints
  app.post("/api/drafts/generate", async (req, res) => {
    try {
      const { getDraftGenerator } = await import("./services/draftGenerator");
      const draftGenerator = getDraftGenerator();
      
      const request = req.body;
      
      // Validate request
      if (!request.prompt || request.prompt.length < 10) {
        return res.status(400).json({ 
          error: "Prompt must be at least 10 characters long" 
        });
      }
      
      const result = await draftGenerator.generateDraft(request);
      res.json(result);
    } catch (error: any) {
      console.error("Draft generation error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/drafts/refine", async (req, res) => {
    try {
      const { getDraftGenerator } = await import("./services/draftGenerator");
      const draftGenerator = getDraftGenerator();
      
      const { originalDraft, refinementInstructions } = req.body;
      
      if (!originalDraft || !refinementInstructions) {
        return res.status(400).json({ 
          error: "Both originalDraft and refinementInstructions are required" 
        });
      }
      
      const refinedDraft = await draftGenerator.refineDraft(
        originalDraft,
        refinementInstructions
      );
      
      res.json({ 
        refinedDraft,
        originalLength: originalDraft.length,
        refinedLength: refinedDraft.length,
        timestamp: new Date().toISOString()
      });
    } catch (error: any) {
      console.error("Draft refinement error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/drafts/compare", async (req, res) => {
    try {
      const { getDraftGenerator } = await import("./services/draftGenerator");
      const draftGenerator = getDraftGenerator();
      
      const { draft1, draft2 } = req.body;
      
      if (!draft1 || !draft2) {
        return res.status(400).json({ 
          error: "Both draft1 and draft2 are required" 
        });
      }
      
      const comparison = await draftGenerator.compareDrafts(draft1, draft2);
      
      res.json({ 
        comparison,
        timestamp: new Date().toISOString()
      });
    } catch (error: any) {
      console.error("Draft comparison error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/drafts/extract-sections", async (req, res) => {
    try {
      const { getDraftGenerator } = await import("./services/draftGenerator");
      const draftGenerator = getDraftGenerator();
      
      const { draft } = req.body;
      
      if (!draft) {
        return res.status(400).json({ error: "Draft is required" });
      }
      
      const sections = await draftGenerator.extractSections(draft);
      
      res.json({ 
        sections,
        timestamp: new Date().toISOString()
      });
    } catch (error: any) {
      console.error("Section extraction error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/drafts/upload-pdf", upload.single('file'), async (req: MulterRequest, res) => {
    try {
      const { getDraftProcessor } = await import("./services/draftProcessor");
      const draftProcessor = getDraftProcessor();
      
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }
      
      const filename = req.file.originalname;
      const metadata = req.body.metadata ? JSON.parse(req.body.metadata) : undefined;
      
      // Extract text from PDF
      const text = await draftProcessor.extractTextFromPDF(req.file.buffer);
      
      // Process and store in Pinecone
      await draftProcessor.processTextContent(filename, text, metadata);
      
      res.json({ 
        success: true,
        message: `File ${filename} processed and added to knowledge base`,
        filename,
        textLength: text.length,
        timestamp: new Date().toISOString()
      });
    } catch (error: any) {
      console.error("PDF upload error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/drafts/search", async (req, res) => {
    try {
      const { getDraftProcessor } = await import("./services/draftProcessor");
      const draftProcessor = getDraftProcessor();
      
      const query = req.query.q as string || "";
      const topK = parseInt(req.query.topK as string) || 5;
      
      if (!query) {
        return res.status(400).json({ error: "Query parameter 'q' is required" });
      }
      
      const results = await draftProcessor.searchSimilarDrafts(query, topK);
      
      res.json({ 
        query,
        results,
        totalFound: results.length,
        timestamp: new Date().toISOString()
      });
    } catch (error: any) {
      console.error("Draft search error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/drafts/process-folder", async (req, res) => {
    try {
      const { getDraftProcessor } = await import("./services/draftProcessor");
      const draftProcessor = getDraftProcessor();
      
      const { folderPath } = req.body;
      
      if (!folderPath) {
        return res.status(400).json({ error: "folderPath is required" });
      }
      
      await draftProcessor.processDraftsFolder(folderPath);
      
      res.json({ 
        success: true,
        message: `Successfully processed all PDFs in ${folderPath}`,
        timestamp: new Date().toISOString()
      });
    } catch (error: any) {
      console.error("Folder processing error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/drafts/stats", async (req, res) => {
    try {
      const { getDraftProcessor } = await import("./services/draftProcessor");
      const draftProcessor = getDraftProcessor();
      
      const stats = await draftProcessor.getStats();
      
      res.json({ 
        stats,
        timestamp: new Date().toISOString()
      });
    } catch (error: any) {
      console.error("Stats error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // India Kanoon integration endpoints
  app.get("/api/india-kanoon/search", async (req, res) => {
    try {
      const searchParams = {
        query: req.query.q as string || "",
        maxResults: parseInt(req.query.maxResults as string) || 50, // Reduced from 1000 to save API costs
        pagenum: parseInt(req.query.pagenum as string) || 0,
        startDate: req.query.startDate as string,
        endDate: req.query.endDate as string,
        court: req.query.court as string,
        doctype: req.query.doctype as string,
        title: req.query.title as string,
        cite: req.query.cite as string,
        author: req.query.author as string,
        bench: req.query.bench as string,
      };
      
      const results = await indiaKanoonService.searchCases(searchParams);
      res.json(results);
    } catch (error: any) {
      console.error("India Kanoon search error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/india-kanoon/case/:caseId", async (req, res) => {
    try {
      const { caseId } = req.params;
      const caseDetails = await indiaKanoonService.getCaseDetails(caseId);
      
      if (!caseDetails) {
        return res.status(404).json({ error: "Case not found" });
      }
      
      res.json(caseDetails);
    } catch (error: any) {
      console.error("India Kanoon case details error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/india-kanoon/advanced-search", async (req, res) => {
    try {
      const searchParams = req.body;
      const results = await indiaKanoonService.advancedSearch(searchParams);
      res.json(results);
    } catch (error: any) {
      console.error("Advanced search error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // User authentication endpoints (for Firebase integration)
  app.post("/api/auth/register", async (req, res) => {
    try {
      const { email, displayName, photoURL, firebaseUid } = req.body;
      
      // Check if user already exists
      const existingUser = await storage.getUserByFirebaseUid(firebaseUid);
      if (existingUser) {
        return res.json(existingUser);
      }

      // Create new user
      const user = await storage.createUser({
        email,
        displayName,
        photoURL,
        firebaseUid,
      });

      res.json(user);
    } catch (error: any) {
      console.error("Registration error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/auth/user/:firebaseUid", async (req, res) => {
    try {
      const { firebaseUid } = req.params;
      const user = await storage.getUserByFirebaseUid(firebaseUid);
      
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      res.json(user);
    } catch (error: any) {
      console.error("Get user error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Case Prediction endpoint with AI analysis and risk assessment
  app.post("/api/predict-case", async (req, res) => {
    try {
      const { caseDescription, caseType, jurisdiction } = req.body;
      
      if (!caseDescription || !caseDescription.trim()) {
        return res.status(400).json({ error: "Case description is required" });
      }

      // Retrieve relevant precedents for context
      let precedents: any[] = [];
      try {
        precedents = await indiaKanoonService.findRelevantPrecedents(caseDescription, 5);
      } catch (error) {
        console.warn("Precedent retrieval failed for case prediction:", error);
      }

      // Retrieve relevant laws from RAG
      let laws: any[] = [];
      try {
        laws = await ragService.searchRelevantLaws(caseDescription, 8);
      } catch (error) {
        console.warn("Law retrieval failed for case prediction:", error);
      }

      // Generate comprehensive case prediction using AI
      const prompt = `You are an expert legal analyst specialized in case outcome prediction for Indian courts. Analyze this case and provide a structured prediction report.

Case Type: ${caseType || "General"}
Jurisdiction: ${jurisdiction || "India"}

Case Description:
${caseDescription}

Relevant Laws: ${laws.length > 0 ? laws.map(l => `${l.metadata?.act || 'Statute'} ${l.section || ''}`).join('; ') : 'None found'}
Relevant Precedents: ${precedents.length > 0 ? precedents.map(p => `${p.title}`).slice(0, 3).join('; ') : 'None found'}

Provide a detailed prediction in this exact JSON format:
{
  "successProbability": 0.65,
  "successReasoning": "Clear explanation of probability",
  "overallAssessment": "Comprehensive case assessment",
  "courtAnalysis": {
    "judicialPatterns": "Analysis of patterns",
    "precedentAlignment": "Precedent analysis",
    "caseStrength": 0.65
  },
  "evidenceAssessment": [
    {"type": "Evidence type", "analysis": "Analysis", "strength": 0.7}
  ],
  "strategicRecommendations": [
    {"action": "Strategy", "reasoning": "Why recommended"}
  ],
  "riskAssessment": {
    "financialRisk": 0.4,
    "financialRiskDetails": "Explanation",
    "proceduralRisk": 0.3,
    "proceduralRiskDetails": "Explanation",
    "litigationRisk": 0.4,
    "litigationRiskDetails": "Explanation"
  },
  "precedentAnalysis": [
    {"caseTitle": "Case", "citation": "Citation", "applicability": "How it applies", "relevanceScore": 75}
  ],
  "keyStrengths": ["Strength 1", "Strength 2"],
  "keyWeaknesses": ["Weakness 1", "Weakness 2"],
  "estimatedDuration": "6-12 months",
  "estimatedCosts": "₹2-5 lakhs",
  "confidence": 0.7
}`;

      try {
        // Use aiService's Gemini instance method
        const geminiResponse = await fetch(
          'https://generativelanguage.googleapis.com/v1alpha/models/gemini-3.1-flash-lite-preview:generateContent',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-goog-api-key': process.env.GEMINI_API_KEY || process.env.VITE_GOOGLE_AI_API_KEY || '',
            },
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }],
              generationConfig: {
                temperature: 1.0,
                maxOutputTokens: 2500,
              },
            }),
          }
        );

        if (!geminiResponse.ok) {
          const errorText = await geminiResponse.text();
          console.error('Gemini API Error:', geminiResponse.status, errorText);
          throw new Error(`Gemini API error: ${geminiResponse.status} - ${errorText}`);
        }

        const data = await geminiResponse.json();
        const responseText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
        
        if (!responseText) {
          throw new Error('No response from Gemini API');
        }

        // Parse JSON response
        let prediction;
        try {
          prediction = JSON.parse(responseText);
        } catch (e) {
          // Try to extract JSON if wrapped in text
          const jsonMatch = responseText.match(/\{[\s\S]*\}/);
          if (!jsonMatch) {
            throw new Error('Could not parse AI response as JSON');
          }
          prediction = JSON.parse(jsonMatch[0]);
        }

        // Ensure all required fields exist
        prediction = {
          id: `predict-${Date.now()}`,
          successProbability: Math.min(1, Math.max(0, prediction.successProbability || 0.5)),
          successReasoning: prediction.successReasoning || "Case analysis under review",
          overallAssessment: prediction.overallAssessment || "Comprehensive case analysis completed",
          courtAnalysis: {
            judicialPatterns: prediction.courtAnalysis?.judicialPatterns || "Judicial patterns analyzed",
            precedentAlignment: prediction.courtAnalysis?.precedentAlignment || "Precedent alignment reviewed",
            caseStrength: Math.min(1, Math.max(0, prediction.courtAnalysis?.caseStrength || 0.5)),
          },
          evidenceAssessment: (prediction.evidenceAssessment || []).map((e: any) => ({
            type: e.type || "Evidence",
            analysis: e.analysis || "Assessment pending",
            strength: Math.min(1, Math.max(0, e.strength || 0.5)),
          })),
          strategicRecommendations: (prediction.strategicRecommendations || []).map((r: any) => ({
            action: r.action || "Strategy",
            reasoning: r.reasoning || "Analysis in progress",
          })),
          riskAssessment: {
            financialRisk: Math.min(1, Math.max(0, prediction.riskAssessment?.financialRisk || 0.4)),
            financialRiskDetails: prediction.riskAssessment?.financialRiskDetails || "Financial risks assessed",
            proceduralRisk: Math.min(1, Math.max(0, prediction.riskAssessment?.proceduralRisk || 0.3)),
            proceduralRiskDetails: prediction.riskAssessment?.proceduralRiskDetails || "Procedural risks evaluated",
            litigationRisk: Math.min(1, Math.max(0, prediction.riskAssessment?.litigationRisk || 0.4)),
            litigationRiskDetails: prediction.riskAssessment?.litigationRiskDetails || "Litigation risks considered",
          },
          precedentAnalysis: (prediction.precedentAnalysis || []).slice(0, 10).map((p: any) => ({
            caseTitle: p.caseTitle || "Relevant precedent",
            citation: p.citation || "Citation",
            applicability: p.applicability || "Applicable to case",
            relevanceScore: Math.min(100, Math.max(0, p.relevanceScore || 75)),
          })),
          keyStrengths: (prediction.keyStrengths || []).filter((s: any) => typeof s === 'string'),
          keyWeaknesses: (prediction.keyWeaknesses || []).filter((w: any) => typeof w === 'string'),
          estimatedDuration: prediction.estimatedDuration || "6-12 months",
          estimatedCosts: prediction.estimatedCosts || "₹2-5 lakhs",
          confidence: Math.min(1, Math.max(0, prediction.confidence || 0.7)),
          retrievalUsed: {
            lawsFound: laws.length,
            precedentsFound: precedents.length,
          },
        };

        res.json(prediction);
      } catch (apiError: any) {
        console.error("Case Prediction API Error Details:", {
          message: apiError.message,
          stack: apiError.stack,
          hasGeminiKey: !!process.env.GEMINI_API_KEY,
          hasViteKey: !!process.env.VITE_GOOGLE_AI_API_KEY,
        });
        
        // Return fallback prediction
        return res.json({
          id: `predict-${Date.now()}`,
          successProbability: 0.5,
          successReasoning: "AI analysis service is temporarily unavailable. Using fallback analysis.",
          overallAssessment: "The case presents a balanced profile requiring detailed expert analysis. Both parties have arguable positions based on available information.",
          courtAnalysis: {
            judicialPatterns: "Similar cases show mixed outcomes depending on factual circumstances and precedent application",
            precedentAlignment: `${precedents.length} precedents available for alignment analysis`,
            caseStrength: 0.5,
          },
          evidenceAssessment: [
            {
              type: "Documentary Evidence",
              analysis: "Review of underlying contracts and correspondence required",
              strength: 0.5,
            },
            {
              type: "Legal Arguments",
              analysis: `${laws.length} relevant legal provisions available for statutory analysis`,
              strength: 0.5,
            },
          ],
          strategicRecommendations: [
            {
              action: "Consult with experienced litigation counsel",
              reasoning: "Complex cases benefit from expert guidance in strategy development",
            },
            {
              action: "Prepare comprehensive evidence package",
              reasoning: "Strong documentary support is critical for case success",
            },
            {
              action: "Research applicable precedents in depth",
              reasoning: `${precedents.length} relevant precedents identified for detailed study`,
            },
          ],
          riskAssessment: {
            financialRisk: 0.45,
            financialRiskDetails: "Financial exposure depends on claim quantum and likelihood of adverse judgment",
            proceduralRisk: 0.35,
            proceduralRiskDetails: "Procedural compliance with court rules and statutory requirements is essential",
            litigationRisk: 0.50,
            litigationRiskDetails: "Inherent uncertainty in judicial decision-making creates litigation risk",
          },
          precedentAnalysis: precedents.slice(0, 3).map(p => ({
            caseTitle: p.title || "Relevant precedent",
            citation: p.tid ? `IK-${p.tid}` : "Citation unavailable",
            applicability: "Similar legal principles may be applicable to current dispute",
            relevanceScore: 65,
          })),
          keyStrengths: [
            "Case details provided for analysis",
            laws.length > 0 ? `${laws.length} relevant legal provisions available` : "Legal framework exists",
          ].filter(s => s),
          keyWeaknesses: [
            "AI analysis service temporarily offline",
            "Requires manual expert review for detailed prediction",
          ],
          estimatedDuration: "6-18 months depending on complexity and appeals",
          estimatedCosts: "₹2-10 lakhs depending on representation and court fees",
          confidence: 0.4,
          retrievalUsed: {
            lawsFound: laws.length,
            precedentsFound: precedents.length,
          },
          _debug: process.env.NODE_ENV === 'development' ? {
            apiError: apiError.message,
            retrievedLaws: laws.length,
            retrievedPrecedents: precedents.length,
          } : undefined,
        });
      }
    } catch (error: any) {
      console.error("Case prediction error:", error);
      res.status(500).json({ error: error.message || "Failed to predict case outcome" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
