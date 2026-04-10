/**
 * API Service for communicating with the BetterCallAI Backend
 * Handles all HTTP requests to the Express backend server
 */

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

export interface SearchFilters {
  court?: string;
  jurisdiction?: string;
  documentType?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  limit?: number;
}

export interface CaseSearchResult {
  id: string;
  title: string;
  court: string;
  date: string;
  summary: string;
  relevanceScore?: number;
}

export interface AnalysisResult {
  id: string;
  documentName: string;
  uploadDate: string;
  analysis: {
    summary: string;
    keyPoints: string[];
    precedentsFound: Array<{
      caseId: string;
      caseTitle: string;
      relevance: string;
      citation: string;
    }>;
    lawsApplied?: Array<{
      provision: string;
      fullText: string;
      act: string;
      section: string;
      relevance: string;
    }>;
    legalIssues: string[];
    recommendations: string[];
    sentiment: string;
    externalPrecedents?: Array<{
      title: string;
      court: string;
      date: string;
      url: string;
    }>;
  };
  confidence: number;
  processingTime: string;
}

export interface VectorSearchResult {
  query: string;
  semanticResults: Array<{
    id: string;
    lawName: string;
    section: string;
    content: string;
    relevanceScore: number;
    metadata: {
      act: string;
      year: string;
      category: string;
      court?: string;
      citation?: string;
    };
  }>;
  fallbackResults?: any[];
  totalFound: number;
  confidence: number;
}

export interface CounterArgumentRequest {
  facts: string;
  opponentPosition: string;
  yourSide?: "petitioner" | "respondent" | "appellant" | "defendant" | "complainant";
  stage?: "notice" | "interim" | "trial" | "appeal" | "revision" | "writ";
  jurisdiction?: string;
  court?: string;
  enableRetrieval?: boolean;
  maxAuthorities?: number;
}

export interface CounterArgumentResult {
  id: string;
  generatedAt: string;
  mode: "input-only" | "retrieval-enriched";
  summary: string;
  opposingViewpoints: string[];
  rebuttals: string[];
  proceduralDefenses: string[];
  authorities: Array<{
    title: string;
    citation?: string;
    source: string;
    proposition: string;
    relevance: string;
    url?: string;
  }>;
  strategyChecklist: string[];
  confidence: number;
  retrievalUsed: {
    ragMatches: number;
    precedentMatches: number;
  };
}

class ApiService {
  private baseURL: string;

  constructor() {
    this.baseURL = API_BASE_URL;
  }

  /**
   * Make HTTP request with proper error handling
   */
  private async makeRequest<T>(
    endpoint: string, 
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseURL}${endpoint}`;
    
    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('API Request failed:', error);
      throw error;
    }
  }

  /**
   * Search for legal cases
   */
  async searchCases(query: string, filters: SearchFilters = {}): Promise<{
    cases: CaseSearchResult[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    const params = new URLSearchParams({
      q: query,
      ...Object.fromEntries(
        Object.entries(filters).filter(([_, v]) => v !== undefined).map(([k, v]) => [k, String(v)])
      ),
    });

    return this.makeRequest(`/api/search?${params}`);
  }

  /**
   * Get case details by ID
   */
  async getCaseById(caseId: string): Promise<any> {
    return this.makeRequest(`/api/case/${caseId}`);
  }

  /**
   * Analyze legal document/judgment
   */
  async analyzeDocument(file: File): Promise<AnalysisResult> {
    const formData = new FormData();
    formData.append('document', file);

    const response = await fetch(`${this.baseURL}/api/analyze-judgment`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || 'Analysis failed');
    }

    return response.json();
  }

  /**
   * Analyze text content directly
   */
  async analyzeText(content: string, documentName?: string): Promise<AnalysisResult> {
    return this.makeRequest('/api/analyze-judgment', {
      method: 'POST',
      body: JSON.stringify({
        content,
        documentName: documentName || 'text-input.txt'
      }),
    });
  }

  /**
   * Perform vector search using RAG
   */
  async vectorSearch(query: string, limit: number = 10): Promise<VectorSearchResult> {
    const params = new URLSearchParams({ q: query, limit: String(limit) });
    return this.makeRequest(`/api/vector-search?${params}`);
  }

  /**
   * Upload document to RAG system
   */
  async uploadToRAG(document: {
    id: string;
    content: string;
    metadata?: Record<string, any>;
  }): Promise<{ success: boolean; message: string }> {
    return this.makeRequest('/api/rag/upload-document', {
      method: 'POST',
      body: JSON.stringify({ document }),
    });
  }

  /**
   * Chat with AI about legal matters
   */
  async chatWithAI(messages: Array<{
    role: 'user' | 'assistant' | 'system';
    content: string;
  }>, context?: any): Promise<{
    response: string;
    timestamp: string;
    context: any;
  }> {
    return this.makeRequest('/api/ai/chat', {
      method: 'POST',
      body: JSON.stringify({ messages, context }),
    });
  }

  /**
   * Extract legal entities from text
   */
  async extractEntities(text: string): Promise<{
    entities: Array<{
      type: string;
      value: string;
      confidence: number;
    }>;
  }> {
    return this.makeRequest('/api/ai/extract-entities', {
      method: 'POST',
      body: JSON.stringify({ text }),
    });
  }

  /**
   * Generate counter arguments from user facts with optional retrieval enrichment
   */
  async generateCounterArguments(payload: CounterArgumentRequest): Promise<CounterArgumentResult> {
    return this.makeRequest('/api/counter-arguments', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  /**
   * Search India Kanoon database
   */
  async searchIndiaKanoon(params: {
    query: string;
    maxResults?: number;
    pagenum?: number;
    startDate?: string;
    endDate?: string;
    court?: string;
    doctype?: string;
    title?: string;
    author?: string;
    citation?: string;
  }): Promise<{
    docs: any[];
    total: number;
    query: string;
  }> {
    const searchParams = new URLSearchParams();
    searchParams.append('q', params.query); // Use 'q' to match backend route
    
    if (params.maxResults) searchParams.append('maxResults', params.maxResults.toString());
    if (params.pagenum !== undefined) searchParams.append('pagenum', params.pagenum.toString());
    if (params.startDate) searchParams.append('startDate', params.startDate);
    if (params.endDate) searchParams.append('endDate', params.endDate);
    if (params.court) searchParams.append('court', params.court);
    if (params.doctype) searchParams.append('doctype', params.doctype);
    if (params.title) searchParams.append('title', params.title);
    if (params.author) searchParams.append('author', params.author);
    if (params.citation) searchParams.append('cite', params.citation);
    
    return this.makeRequest(`/api/india-kanoon/search?${searchParams}`);
  }

  /**
   * Get case details from India Kanoon
   */
  async getIndiaKanoonCase(caseId: string): Promise<any> {
    return this.makeRequest(`/api/india-kanoon/case/${caseId}`);
  }

  /**
   * Health check for backend connectivity
   */
  async healthCheck(): Promise<{ status: string; timestamp: string }> {
    try {
      const response = await fetch(`${this.baseURL}/api/health`);
      if (response.ok) {
        return { status: 'connected', timestamp: new Date().toISOString() };
      }
      throw new Error('Backend not responding');
    } catch (error) {
      return { 
        status: 'disconnected', 
        timestamp: new Date().toISOString() 
      };
    }
  }
}

export const apiService = new ApiService();
export default apiService;