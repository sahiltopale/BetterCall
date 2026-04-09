import { ragService } from "./services/ragService";
import { aiService } from "./services/aiService";
import { indiaKanoonService } from "./services/indiaKanoonService";
import { initializeDraftProcessor } from "./services/draftProcessor";
import { initializeDraftGenerator } from "./services/draftGenerator";

/**
 * Initialize all RAG and AI services
 */
export async function initializeRAGServices(): Promise<void> {
  console.log("🚀 Initializing BetterCall AI Suite RAG Services...");
  
  try {
    // Initialize RAG service (Pinecone connection)
    console.log("📡 Connecting to Pinecone vector database...");
    await ragService.initialize();
    console.log("✅ RAG service initialized (check logs for configuration status)");
    
    // Initialize Draft Processing services
    try {
      console.log("📄 Initializing Draft Processing services...");
      const draftProcessor = await initializeDraftProcessor();
      await initializeDraftGenerator(draftProcessor);
      console.log("✅ Draft generation services initialized (using Gemini AI & legal-drafts index)");
    } catch (error: any) {
      console.log("⚠️  Draft services not fully configured - some features may be limited");
      console.log(`   💡 ${error.message || 'Ensure PINECONE_API_KEY and GEMINI_API_KEY are set'}`);
    }
    
    // Test AI service
    try {
      console.log("🤖 Testing AI service connection...");
      const testAnalysis = await aiService.analyzeLegalDocument("Test document for connection verification");
      if (testAnalysis.confidence > 0) {
        console.log("✅ OpenAI service is operational");
      }
    } catch (error) {
      console.log("⚠️  AI service not fully configured - using fallback mode");
    }
    
    // Test India Kanoon service 
    console.log("⚖️ Testing India Kanoon API connection...");
    const ikStatus = indiaKanoonService.getServiceStatus();
    if (ikStatus.configured) {
      try {
        const testSearch = await indiaKanoonService.searchCases({ query: "test", maxResults: 1 });
        console.log(`✅ India Kanoon API operational (${testSearch.total || 0} results available)`);
      } catch (error) {
        console.log("⚠️  India Kanoon API token configured but connection failed - using mock data");
      }
    } else {
      console.log("⚠️  India Kanoon API token not configured - using mock data");
      console.log("   💡 Set INDIA_KANOON_API_TOKEN environment variable for live API access");
      // Test mock functionality
      const testSearch = await indiaKanoonService.searchCases({ query: "test", maxResults: 1 });
      console.log(`✅ India Kanoon mock service operational (${testSearch.total || 0} mock results available)`);
    }
    
    console.log("🎉 Services initialized - server ready with available functionality!");
    
  } catch (error) {
    console.error("❌ Error initializing services:", error);
    console.log("⚠️  Continuing with fallback/mock services...");
  }
}

/**
 * Health check for all services
 */
export async function healthCheckServices(): Promise<{
  ragService: boolean;
  aiService: boolean;
  indiaKanoonService: boolean;
  overall: boolean;
}> {
  const results = {
    ragService: false,
    aiService: false,
    indiaKanoonService: false,
    overall: false
  };

  try {
    // Check RAG service
    const ragTest = await ragService.searchRelevantLaws("constitutional law", 1);
    results.ragService = Array.isArray(ragTest);
  } catch (error) {
    console.log("RAG service health check failed:", error);
  }

  try {
    // Check AI service
    const aiTest = await aiService.analyzeLegalDocument("test");
    results.aiService = !!aiTest.summary;
  } catch (error) {
    console.log("AI service health check failed:", error);
  }

  try {
    // Check India Kanoon service (always returns results, either from API or mock)
    const ikTest = await indiaKanoonService.searchCases({ query: "test", maxResults: 1 });
    results.indiaKanoonService = ikTest.total >= 0;
  } catch (error) {
    console.log("India Kanoon service health check failed:", error);
    results.indiaKanoonService = false;
  }

  results.overall = results.ragService && results.aiService && results.indiaKanoonService;
  
  return results;
}

/**
 * Populate vector database with sample legal documents
 */
export async function populateSampleLegalData(): Promise<void> {
  console.log("📚 Populating vector database with sample legal documents...");
  
  const sampleDocuments = [
    {
      id: "ipc-section-420",
      title: "Indian Penal Code - Section 420 (Cheating)",
      content: "Whoever cheats and thereby dishonestly induces the person deceived to deliver any property to any person, or to make, alter or destroy the whole or any part of a valuable security, or anything which is signed or sealed, and which is capable of being converted into a valuable security, shall be punished with imprisonment of either description for a term which may extend to seven years, and shall also be liable to fine.",
      section: "Section 420",
      act: "Indian Penal Code",
      year: "1860",
      category: "Criminal Law",
      citation: "IPC Sec. 420"
    },
    {
      id: "constitution-article-21",
      title: "Constitution of India - Article 21 (Right to Life and Personal Liberty)",
      content: "No person shall be deprived of his life or personal liberty except according to procedure established by law. The right to life includes the right to live with human dignity and all that goes along with it, namely, the bare necessities of life such as adequate nutrition, clothing and shelter and facilities for reading, writing and expressing oneself in diverse forms.",
      section: "Article 21",
      act: "Constitution of India",
      year: "1950",
      category: "Constitutional Law",
      citation: "Art. 21"
    },
    {
      id: "contract-act-section-10",
      title: "Indian Contract Act - Section 10 (What agreements are contracts)",
      content: "All agreements are contracts if they are made by the free consent of parties competent to contract, for a lawful consideration and with a lawful object, and are not hereby expressly declared to be void. Nothing herein contained shall affect any law in force in India, and not hereby repealed, by which any contract is required to be made in writing or in the presence of witnesses, or any law relating to the registration of documents.",
      section: "Section 10",
      act: "Indian Contract Act",
      year: "1872",
      category: "Contract Law",
      citation: "Contract Act Sec. 10"
    },
    {
      id: "cpc-order-7-rule-11",
      title: "Code of Civil Procedure - Order VII Rule 11 (Rejection of plaint)",
      content: "The plaint shall be rejected in the following cases: (a) where it does not disclose a cause of action; (b) where the relief claimed is undervalued and the plaintiff, on being required by the Court to correct the valuation within a time to be fixed by the Court, fails to do so; (c) where the relief claimed is properly valued but the plaint is written upon paper insufficiently stamped, and the plaintiff, on being required by the Court to supply the requisite stamp-paper within a time to be fixed by the Court, fails to do so.",
      section: "Order VII Rule 11",
      act: "Code of Civil Procedure",
      year: "1908", 
      category: "Civil Procedure",
      citation: "CPC O. VII R. 11"
    },
    {
      id: "companies-act-section-166",
      title: "Companies Act - Section 166 (Duties of directors)",
      content: "Subject to the provisions of this Act, a director of a company shall act in good faith in order to promote the objects of the company for the benefit of its members as a whole, and in the best interests of the company, its employees, the shareholders, the community and for the protection of environment. A director of a company shall exercise his duties with due and reasonable care, skill and diligence and shall exercise independent judgment.",
      section: "Section 166",
      act: "Companies Act",
      year: "2013",
      category: "Corporate Law", 
      citation: "Companies Act Sec. 166"
    }
  ];

  try {
    const uploadedCount = await ragService.batchUploadDocuments(sampleDocuments, 5);
    console.log(`✅ Successfully uploaded ${uploadedCount} sample legal documents`);
  } catch (error) {
    console.error("❌ Error uploading sample documents:", error);
    throw error;
  }
}

/**
 * Test RAG functionality with sample queries
 */
export async function testRAGFunctionality(): Promise<void> {
  console.log("🧪 Testing RAG functionality with sample queries...");
  
  const testQueries = [
    "constitutional rights and privacy",
    "contract formation and validity", 
    "criminal liability for cheating",
    "civil procedure and plaint rejection",
    "corporate governance and director duties"
  ];

  for (const query of testQueries) {
    try {
      console.log(`\n🔍 Testing query: "${query}"`);
      
      const results = await ragService.searchRelevantLaws(query, 3);
      console.log(`   Found ${results.length} relevant documents`);
      
      if (results.length > 0) {
        const topResult = results[0];
        console.log(`   Top result: ${topResult.lawName} (Score: ${topResult.relevanceScore.toFixed(3)})`);
      }
      
      // Small delay to avoid overwhelming the API
      await new Promise(resolve => setTimeout(resolve, 500));
      
    } catch (error) {
      console.log(`   ❌ Error testing query "${query}":`, error);
    }
  }
  
  console.log("\n✅ RAG functionality testing completed");
}

/**
 * Complete initialization routine
 */
export async function initializeAll(): Promise<void> {
  try {
    await initializeRAGServices();
    
    // Only populate data in development if services are properly configured
    if (process.env.NODE_ENV === 'development' && process.env.ENABLE_MOCK_DATA === 'true') {
      try {
        await populateSampleLegalData();
        await testRAGFunctionality();
      } catch (error) {
        console.log("⚠️  Skipping sample data population - services not fully configured");
      }
    }
    
    console.log("🎯 BetterCall AI Suite is ready for legal document analysis!");
  } catch (error) {
    console.error("❌ Error during initialization:", error);
    console.log("⚠️  Continuing with basic server functionality...");
  }
}