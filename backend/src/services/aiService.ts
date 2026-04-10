import { GoogleGenerativeAI } from "@google/generative-ai";

export interface AIAnalysisResult {
  summary: string;
  keyPoints: string[];
  legalIssues: string[];
  recommendations: string[];
  precedentSuggestions: string[];
  confidence: number;
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface CounterAuthority {
  title: string;
  citation?: string;
  source: string;
  proposition: string;
  relevance: string;
  url?: string;
}

export interface CounterArgumentGenerationInput {
  facts: string;
  opponentPosition: string;
  yourSide: string;
  stage: string;
  jurisdiction?: string;
  court?: string;
  authorities?: CounterAuthority[];
}

export interface CounterArgumentGenerationResult {
  summary: string;
  opposingViewpoints: string[];
  rebuttals: string[];
  proceduralDefenses: string[];
  strategyChecklist: string[];
  confidence: number;
}

export class AIService {
  private gemini: GoogleGenerativeAI | null = null;

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY || 
                   process.env.VITE_GEMINI_API_KEY || 
                   process.env.VITE_GOOGLE_AI_API_KEY ||
                   process.env.GOOGLE_AI_API_KEY;
    
    if (apiKey) {
      this.gemini = new GoogleGenerativeAI(apiKey);
      console.log("✅ Gemini AI service initialized successfully");
    } else {
      console.warn("⚠️  Gemini API key not available - using fallback responses");
    }
  }

  /**
   * Analyze legal document using Gemini
   */
  async analyzeLegalDocument(documentText: string, context?: string): Promise<AIAnalysisResult> {
    try {
      if (!this.gemini) {
        console.warn("Gemini not available, using fallback analysis");
        return this.getFallbackAnalysis(documentText);
      }

      const prompt = `You are a senior legal counsel specializing in Indian jurisprudence with expertise in constitutional law, civil and criminal procedure, and statutory interpretation. Analyze this legal document with the rigor and precision expected in High Court and Supreme Court proceedings.

CRITICAL INSTRUCTIONS:
- Use proper legal terminology and Latin maxims where appropriate
- Cite specific statutory provisions with section numbers
- Reference constitutional articles and fundamental rights
- Identify ratio decidendi and obiter dicta if this is a judgment
- Apply principles of statutory interpretation (literal, golden, mischief rules)
- Consider doctrine of precedent and stare decisis
- Analyze procedural compliance with CPC/CrPC requirements

${context ? `ADDITIONAL CONTEXT: ${context}` : ''}

DOCUMENT FOR ANALYSIS:
${documentText.substring(0, 5000)}${documentText.length > 5000 ? '\n[Document truncated for analysis - first 5000 characters]' : ''}

Provide comprehensive legal analysis in JSON format:
{
  "summary": "Detailed case synopsis including: (1) Nature of proceedings (original/appellate/revisional), (2) Principal legal questions raised, (3) Statutory framework invoked, (4) Court's findings and reasoning, (5) Final disposition with specific relief granted/denied. Use precise legal terminology.",
  "keyPoints": [
    "Point 1 with specific statutory reference (e.g., 'Section 141 of Negotiable Instruments Act, 1881 - vicarious liability of directors')",
    "Point 2 citing constitutional provision (e.g., 'Article 14 violation - arbitrary state action without reasonable classification')",
    "Include at least 6-8 detailed points with legal citations"
  ],
  "legalIssues": [
    "Frame issues as courts would - use 'Whether...' format",
    "Issue 1: Whether the impugned order suffers from violation of principles of natural justice...",
    "Issue 2: Whether the statutory provision is ultra vires Article 19(1)(g)...",
    "Issue 3: Whether there exists a cause of action maintainable in law...",
    "Include 4-6 precisely framed legal issues"
  ],
  "recommendations": [
    "CRITICAL: NO generic recommendations allowed. Each MUST cite specific sections, acts, and timelines.",
    "Example GOOD: 'File review petition under Article 137 of Constitution read with Order 47 Rule 1 CPC before the Supreme Court within 30 days from the date of judgment. Ensure application demonstrates error apparent on face of record per Lily Thomas v. Union of India (2000) 6 SCC 224.'",
    "Example BAD: 'Consider filing an appeal' or 'Review procedural compliance' - TOO GENERIC",
    "Recommendation 1: File [specific application] under Section X of [Act name] within [exact days] per Article Y of Limitation Act, 1963",
    "Recommendation 2: Invoke writ jurisdiction under Article 226/32 specifying which fundamental right and which constitutional article violated",
    "Recommendation 3: Cite binding precedent [Case Name v. Case Name, Citation] with specific legal principle applied",
    "Include 5-7 detailed recommendations, each 2-3 sentences with full statutory backing"
  ],
  "precedentSuggestions": [
    "Relevant Supreme Court/High Court judgments with proper citations",
    "Format: Case Name vs. Case Name, [Year] Citation (Court) - Brief holding",
    "Example: Kesavananda Bharati vs. State of Kerala, AIR 1973 SC 1461 - Basic Structure Doctrine",
    "Include 4-6 key precedents that are directly applicable"
  ]
}`;

      const model = this.gemini.getGenerativeModel({ 
        model: "gemini-3.1-flash-lite-preview",
        generationConfig: {
          responseMimeType: "application/json",
          temperature: 0.4,
          maxOutputTokens: 4096,
        }
      });

      console.log("🔍 Starting Gemini analysis with enhanced prompt...");
      const result = await model.generateContent(prompt);
      const response = await result.response;
      const responseText = response.text();
      console.log("✅ Gemini response received, length:", responseText.length);
      
      const analysis = JSON.parse(responseText || "{}");
      console.log("📊 Analysis parsed - keyPoints:", analysis.keyPoints?.length, "recommendations:", analysis.recommendations?.length);
      
      return {
        summary: analysis.summary || "Analysis could not be completed",
        keyPoints: analysis.keyPoints || [],
        legalIssues: analysis.legalIssues || [],
        recommendations: analysis.recommendations || [],
        precedentSuggestions: analysis.precedentSuggestions || [],
        confidence: this.calculateConfidence(documentText, analysis)
      };

    } catch (error) {
      console.error("AI Analysis error:", error);
      return this.getFallbackAnalysis(documentText);
    }
  }

  /**
   * Generate legal research questions based on case text
   */
  async generateResearchQuestions(caseText: string): Promise<string[]> {
    try {
      if (!this.gemini) {
        return [
          "What are the relevant statutory provisions applicable to this case?",
          "Are there any recent precedents that could influence the outcome?",
          "What procedural requirements must be satisfied?",
          "What are the potential defenses available?",
          "What remedies or relief can be sought?"
        ];
      }

      const prompt = `Based on this legal case text, generate 5 specific research questions that a lawyer should investigate:

${caseText.substring(0, 2000)}...

Return as a JSON array of strings:
["question1", "question2", "question3", "question4", "question5"]`;

      const model = this.gemini.getGenerativeModel({ 
        model: "gemini-3.1-flash-lite-preview",
        generationConfig: {
          responseMimeType: "application/json",
        }
      });

      const result = await model.generateContent(prompt);
      const response = await result.response;
      const data = JSON.parse(response.text() || '[]');
      return Array.isArray(data) ? data : data.questions || [];
    } catch (error) {
      console.error("Error generating research questions:", error);
      return [
        "What are the relevant statutory provisions applicable to this case?",
        "Are there any recent precedents that could influence the outcome?",
        "What procedural requirements must be satisfied?",
        "What are the potential defenses available?",
        "What remedies or relief can be sought?"
      ];
    }
  }

  /**
   * Summarize multiple case precedents
   */
  async summarizePrecedents(cases: Array<{ title: string; content: string }>): Promise<string> {
    try {
      if (!this.gemini) {
        return "Multiple precedents establish important legal principles that require detailed analysis.";
      }

      const casesText = cases.map(c => `${c.title}: ${c.content.substring(0, 500)}`).join('\n\n');
      
      const prompt = `Summarize these legal precedents and explain their collective significance:

${casesText}

Provide a coherent summary that explains:
1. Common legal principles
2. Evolution of jurisprudence
3. Practical implications for current practice`;

      const model = this.gemini.getGenerativeModel({ 
        model: "gemini-3.1-flash-lite-preview"
      });

      const result = await model.generateContent(prompt);
      const response = await result.response;
      return response.text() || "Summary could not be generated";
    } catch (error) {
      console.error("Error summarizing precedents:", error);
      return "Multiple precedents establish important legal principles that require detailed analysis.";
    }
  }

  /**
   * Legal chatbot functionality
   */
  async chatWithLegalAI(messages: ChatMessage[]): Promise<string> {
    try {
      if (!this.gemini) {
        return "I'm currently unavailable. Please consult with a qualified legal professional for legal advice.";
      }

      const systemPrompt = `You are a knowledgeable legal AI assistant specializing in Indian law. 
Provide accurate, helpful legal information while reminding users that this is not legal advice 
and they should consult qualified lawyers for their specific situations. 
Focus on Indian constitutional law, civil and criminal procedure, and major statutes.`;

      // Combine system prompt with user messages
      const conversationHistory = messages.map(msg => `${msg.role}: ${msg.content}`).join('\n\n');
      const fullPrompt = `${systemPrompt}\n\nConversation:\n${conversationHistory}\n\nResponse:`;

      const model = this.gemini.getGenerativeModel({ 
        model: "gemini-3.1-flash-lite-preview"
      });

      const result = await model.generateContent(fullPrompt);
      const response = await result.response;
      return response.text() || "I'm sorry, I couldn't process your request.";
    } catch (error) {
      console.error("Chat AI error:", error);
      return "I'm experiencing technical difficulties. Please try again later.";
    }
  }

  /**
   * Extract key legal entities from text
   */
  async extractLegalEntities(text: string): Promise<{
    statutes: string[];
    cases: string[];
    sections: string[];
    courts: string[];
    parties: string[];
  }> {
    try {
      if (!this.gemini) {
        return {
          statutes: [],
          cases: [],
          sections: [],
          courts: [],
          parties: []
        };
      }

      const prompt = `Extract legal entities from this text and categorize them:

${text.substring(0, 2000)}

Return as JSON:
{
  "statutes": ["act names"],
  "cases": ["case names"],
  "sections": ["section numbers with acts"],
  "courts": ["court names"],
  "parties": ["party names"]
}`;

      const model = this.gemini.getGenerativeModel({ 
        model: "gemini-3.1-flash-lite-preview",
        generationConfig: {
          responseMimeType: "application/json",
        }
      });

      const result = await model.generateContent(prompt);
      const response = await result.response;
      const entities = JSON.parse(response.text() || "{}");
      return {
        statutes: entities.statutes || [],
        cases: entities.cases || [],
        sections: entities.sections || [],
        courts: entities.courts || [],
        parties: entities.parties || []
      };
    } catch (error) {
      console.error("Error extracting entities:", error);
      return {
        statutes: [],
        cases: [],
        sections: [],
        courts: [],
        parties: []
      };
    }
  }

  /**
   * Generate legal brief outline
   */
  async generateBriefOutline(caseType: string, facts: string): Promise<string[]> {
    try {
      if (!this.gemini) {
        return [
          "I. Introduction and Statement of Facts",
          "II. Issues Presented", 
          "III. Legal Arguments",
          "IV. Relevant Case Law and Statutes",
          "V. Conclusion and Prayer for Relief"
        ];
      }

      const prompt = `Generate a legal brief outline for a ${caseType} case with these facts:

${facts}

Provide a structured outline as JSON array:
["I. Introduction and Statement of Facts", "II. Issues Presented", ...]`;

      const model = this.gemini.getGenerativeModel({ 
        model: "gemini-3.1-flash-lite-preview",
        generationConfig: {
          responseMimeType: "application/json",
        }
      });

      const result = await model.generateContent(prompt);
      const response = await result.response;
      const data = JSON.parse(response.text() || '[]');
      return Array.isArray(data) ? data : data.outline || [];
    } catch (error) {
      console.error("Error generating brief outline:", error);
      return [
        "I. Introduction and Statement of Facts",
        "II. Issues Presented", 
        "III. Legal Arguments",
        "IV. Relevant Case Law and Statutes",
        "V. Conclusion and Prayer for Relief"
      ];
    }
  }

  async generateCounterArguments(input: CounterArgumentGenerationInput): Promise<CounterArgumentGenerationResult> {
    try {
      if (!this.gemini) {
        return this.getFallbackCounterArguments(input);
      }

      const authorityBlock = (input.authorities || [])
        .slice(0, 12)
        .map((a, idx) => {
          const citationPart = a.citation ? ` [${a.citation}]` : "";
          const urlPart = a.url ? ` (${a.url})` : "";
          return `${idx + 1}. ${a.title}${citationPart} | ${a.source} | ${a.proposition} | ${a.relevance}${urlPart}`;
        })
        .join("\n");

      const prompt = `You are senior Indian litigation counsel. Generate a focused counter-argument memo from the client's input.

CLIENT FACTS:
${input.facts}

OPPONENT POSITION:
${input.opponentPosition}

LITIGATION CONTEXT:
- Our side: ${input.yourSide}
- Stage: ${input.stage}
- Jurisdiction: ${input.jurisdiction || "Not specified"}
- Court: ${input.court || "Not specified"}

RETRIEVED AUTHORITIES (may be empty):
${authorityBlock || "None provided. Build from facts only and mark where verification is needed."}

Return STRICT JSON with this shape only:
{
  "summary": "4-6 sentence strategic summary",
  "opposingViewpoints": [
    "Strongest opponent contention in legal terms",
    "... at least 4 items"
  ],
  "rebuttals": [
    "Point-by-point rebuttal tied to facts/statute/precedent",
    "... at least 5 items"
  ],
  "proceduralDefenses": [
    "Maintainability / limitation / jurisdiction / burden / admissibility defenses",
    "... at least 4 items"
  ],
  "strategyChecklist": [
    "Actionable hearing preparation checklist with sequence",
    "... at least 6 items"
  ]
}

Rules:
- Use concise legal drafting style.
- Prefer issue framing in 'Whether...' format where relevant.
- If authority support is missing, state 'verify citation before filing' inside the relevant rebuttal.
- Do not include markdown or any text outside JSON.`;

      const model = this.gemini.getGenerativeModel({
        model: "gemini-3.1-flash-lite-preview",
        generationConfig: {
          responseMimeType: "application/json",
          temperature: 0.2,
          maxOutputTokens: 4096,
        }
      });

      const result = await model.generateContent(prompt);
      const response = await result.response;
      const parsed = JSON.parse(response.text() || "{}");

      return {
        summary: parsed.summary || "Counter-argument analysis generated from provided facts.",
        opposingViewpoints: Array.isArray(parsed.opposingViewpoints) ? parsed.opposingViewpoints : [],
        rebuttals: Array.isArray(parsed.rebuttals) ? parsed.rebuttals : [],
        proceduralDefenses: Array.isArray(parsed.proceduralDefenses) ? parsed.proceduralDefenses : [],
        strategyChecklist: Array.isArray(parsed.strategyChecklist) ? parsed.strategyChecklist : [],
        confidence: this.calculateCounterConfidence(input, parsed),
      };
    } catch (error) {
      console.error("Counter argument generation error:", error);
      return this.getFallbackCounterArguments(input);
    }
  }

  /**
   * Calculate confidence score for analysis
   */
  private calculateConfidence(documentText: string, analysis: any): number {
    let score = 0.5; // Base score
    
    // Text quality indicators
    if (documentText.length > 1000) score += 0.1;
    if (documentText.includes('section') || documentText.includes('article')) score += 0.1;
    
    // Analysis quality indicators  
    if (analysis.keyPoints?.length >= 3) score += 0.1;
    if (analysis.recommendations?.length >= 3) score += 0.1;
    if (analysis.legalIssues?.length >= 2) score += 0.1;
    if (analysis.precedentSuggestions?.length >= 2) score += 0.1;
    
    return Math.min(Math.round(score * 100) / 100, 0.95);
  }

  private calculateCounterConfidence(input: CounterArgumentGenerationInput, output: any): number {
    let score = 0.55;
    if (input.facts.length > 500) score += 0.1;
    if ((input.authorities || []).length >= 3) score += 0.15;
    if (Array.isArray(output?.rebuttals) && output.rebuttals.length >= 4) score += 0.1;
    if (Array.isArray(output?.proceduralDefenses) && output.proceduralDefenses.length >= 3) score += 0.1;
    return Math.min(Math.round(score * 100) / 100, 0.95);
  }

  /**
   * Extract laws from any text (summary, document, etc.)
   */
  extractLawsFromText(text: string): Array<{
    provision: string;
    fullText: string;
    act: string;
    section: string;
    relevance: string;
  }> {
    const laws: Array<{
      provision: string;
      fullText: string;
      act: string;
      section: string;
      relevance: string;
    }> = [];
    const seen = new Set<string>();

    // Pattern 1: "Section X of Act Name" or "Section X, Act Name"
    const sectionPattern = /(?:Section|Sec\.?|§)\s*(\d+[A-Z]?(?:\([a-z0-9\-]+\))?)\s*(?:of|,)\s*(?:the\s+)?([A-Za-z\s,\(\)&'-]+?)(?:\s+\d{4})?(?=[,.;]|\s+and|\s+in|$)/gi;
    let match;
    while ((match = sectionPattern.exec(text)) !== null) {
      const section = `Section ${match[1]}`;
      const actName = match[2].trim().replace(/\s+Act\s*$/i, '').trim();
      const provision = `${section} of ${actName}`;
      
      if (!seen.has(provision) && actName.length > 2) {
        laws.push({
          provision,
          fullText: provision,
          act: actName,
          section,
          relevance: "Mentioned in legal document"
        });
        seen.add(provision);
      }
    }

    // Pattern 2: IPC/CrPC/CPC sections: "S. 307 IPC" or "Sec 482 CrPC"
    const codePattern = /(?:Section|Sec\.?|S\.)\s*(\d+[A-Z]?)\s+(?:(IPC|BNSS|Cr\.?PC|CPC|NDPS|IEA))/gi;
    while ((match = codePattern.exec(text)) !== null) {
      const section = `Section ${match[1]}`;
      const codeAbbrev = match[2].toUpperCase();
      
      // Map abbreviations to full names
      const codeMap: Record<string, string> = {
        'IPC': 'Indian Penal Code',
        'BNSS': 'Bharatiya Nagarik Suraksha Sanhita',
        'CRPC': 'Code of Criminal Procedure',
        'CR.PC': 'Code of Criminal Procedure',
        'CPC': 'Code of Civil Procedure',
        'IEA': 'Indian Evidence Act',
        'NDPS': 'Narcotic Drugs and Psychotropic Substances Act'
      };
      
      const actName = codeMap[codeAbbrev] || codeAbbrev;
      const provision = `${section} of ${actName}`;
      
      if (!seen.has(provision)) {
        laws.push({
          provision,
          fullText: provision,
          act: actName,
          section,
          relevance: "Applied in judgment"
        });
        seen.add(provision);
      }
    }

    // Pattern 3: Constitution articles: "Article 21" or "Art. 14"
    const articlePattern = /(?:Article|Art\.)\s*(\d+[A-Z]?)/gi;
    while ((match = articlePattern.exec(text)) !== null) {
      const article = `Article ${match[1]}`;
      const provision = `${article} of the Constitution of India`;
      
      if (!seen.has(provision)) {
        laws.push({
          provision,
          fullText: provision,
          act: 'Constitution of India',
          section: article,
          relevance: "Constitutional foundation"
        });
        seen.add(provision);
      }
    }

    // Pattern 4: Bare act citations like "Section 482 BNSS, 2023"
    const bareActPattern = /(?:Section|Sec\.?)\s*(\d+[A-Z]?)\s+(?:of\s+)?(?:the\s+)?(Bharatiya\s+Nagarik\s+Suraksha\s+Sanhita|BNSS)(?:,\s*(\d{4}))?/gi;
    while ((match = bareActPattern.exec(text)) !== null) {
      const section = `Section ${match[1]}`;
      const actName = 'Bharatiya Nagarik Suraksha Sanhita (BNSS)';
      const provision = `${section} of ${actName}`;
      
      if (!seen.has(provision)) {
        laws.push({
          provision,
          fullText: provision,
          act: actName,
          section,
          relevance: "Applicable statute"
        });
        seen.add(provision);
      }
    }

    return laws;
  }

  /**
   * Detect document type from content
   */
  detectDocumentType(documentText: string): {
    type: string;
    confidence: number;
    indicators: string[];
  } {
    const text = documentText.toLowerCase();
    const indicators: string[] = [];
    let type = "Legal Document";
    let confidence = 0.5;

    // Check for judgment indicators
    if (text.includes("judgment") || text.includes("decree") || text.includes("order dated")) {
      indicators.push("Contains 'judgment' or 'decree' keyword");
      if ((text.match(/hon'ble|honourable|justice/gi) || []).length > 2) {
        indicators.push("Multiple references to judges/justices");
      }
      if ((text.match(/herein|whereas|respectfully submitted|the court/gi) || []).length > 5) {
        indicators.push("Formal judgment language pattern");
      }
      type = "Judgment/Order";
      confidence = 0.75;
    }
    
    // Check for petition indicators
    else if (text.includes("petition") || text.includes("writ petition") || text.includes("prayer")) {
      indicators.push("Contains petition indicators");
      if ((text.match(/pray|respectfully|humbly submitted/gi) || []).length > 2) {
        indicators.push("Petition language detected");
      }
      type = "Petition/Application";
      confidence = 0.70;
    }
    
    // Check for contract indicators
    else if (text.includes("agreement") || text.includes("contract") || text.includes("whereas") || text.includes("hereinafter")) {
      indicators.push("Contract/Agreement keywords found");
      if ((text.match(/hereby|acknowledge|agree|consideration/gi) || []).length > 3) {
        indicators.push("Contract terminology detected");
      }
      type = "Contract/Agreement";
      confidence = 0.68;
    }
    
    // Check for statute indicators
    else if (text.includes("act") && (text.includes("section") || text.includes("§") || text.includes("clause")) && (text.includes("parliament") || text.includes("legislature"))) {
      indicators.push("Legislation keywords found");
      if ((text.match(/chapter|part|schedule|section \d+/gi) || []).length > 3) {
        indicators.push("Statutory structure detected");
      }
      type = "Statute/Legislation";
      confidence = 0.72;
    }
    
    // Check for memorandum/letter indicators
    else if (text.includes("memorandum") || (text.includes("dear") && text.includes("regards"))) {
      indicators.push("Memorandum/Letter format");
      type = "Memorandum/Correspondence";
      confidence = 0.65;
    }
    
    // Check for affidavit indicators
    else if (text.includes("affidavit") || text.includes("solemnly") || text.includes("state on oath")) {
      indicators.push("Affidavit indicators found");
      type = "Affidavit";
      confidence = 0.70;
    }
    
    // Generic legal document
    else if ((text.match(/section|act|statute|clause|provision|paragraph/gi) || []).length > 5) {
      indicators.push("Generic legal document - contains multiple legal references");
      type = "Legal Document (Type Unspecified)";
      confidence = 0.55;
    }

    return { type, confidence, indicators };
  }

  /**
   * Check if laws are still valid (not repealed/superseded)
   */
  async checkLawStatus(laws: Array<{act: string; section?: string; provision?: string}>, indiaKanoonService: any) {
    const statusChecks = await Promise.all(
      laws.map(async (law: any) => {
        const lawName = law.act || law.provision || "";
        const section = law.section || "";
        
        try {
          // Search for current status of the law in India Kanoon
          const searchQuery = `${lawName} ${section ? `section ${section}` : ""} amended repealed status`;
          const searchResults = await indiaKanoonService.searchCases({
            query: searchQuery,
            maxResults: 5,
            cite: lawName
          });

          // Common patterns to identify law status
          let status = "VALID"; // Default assumption
          let reasoning = "No changes found - likely still in force";
          let lastUpdated = new Date().toISOString().split('T')[0];

          // Check search results for repeal/amendment indicators
          let hasRepealed = false;
          let hasAmended = false;
          let relevantCases: any[] = [];

          if (searchResults.docs && searchResults.docs.length > 0) {
            relevantCases = searchResults.docs.slice(0, 3);
            
            for (const doc of searchResults.docs) {
              const title = (doc.title || "").toLowerCase();
              const headline = (doc.headline || "").toLowerCase();
              
              if (title.includes("repeal") || headline.includes("repeal") || 
                  title.includes("repealed") || headline.includes("repealed")) {
                hasRepealed = true;
              } else if (title.includes("amend") || headline.includes("amend") ||
                        title.includes("amendment") || headline.includes("amendment")) {
                hasAmended = true;
              }
            }
          }

          // Determine final status
          if (hasRepealed) {
            status = "REPEALED";
            reasoning = "Law appears to have been repealed - verify with official sources";
          } else if (hasAmended) {
            status = "AMENDED";
            reasoning = "Law has been amended - check latest version for applicability";
          } else {
            status = "VALID";
            reasoning = "No repeal found - law likely still applicable";
          }

          return {
            act: lawName,
            section: section,
            status,
            reasoning,
            lastUpdated,
            relatedCases: relevantCases.map(c => ({
              title: c.title,
              date: c.docdisplaydate,
              court: c.court,
              url: c.url
            })),
            confidence: searchResults.total > 0 ? 0.75 : 0.5
          };
        } catch (error: any) {
          // Fallback for API errors
          return {
            act: lawName,
            section: section || "",
            status: "UNKNOWN",
            reasoning: "Unable to verify status - recommend checking official legal databases",
            lastUpdated: new Date().toISOString().split('T')[0],
            relatedCases: [],
            confidence: 0,
            error: error.message
          };
        }
      })
    );

    return statusChecks;
  }

  private getFallbackCounterArguments(input: CounterArgumentGenerationInput): CounterArgumentGenerationResult {
    return {
      summary: "Input-only counter-argument strategy generated. Validate all statutory references and citations before use in pleadings.",
      opposingViewpoints: [
        "Whether the claimant has established a complete cause of action on pleaded facts.",
        "Whether documentary evidence relied upon is admissible and sufficiently proved.",
        "Whether jurisdictional and maintainability thresholds are satisfied.",
        "Whether interim or final relief can be granted without irreparable harm analysis."
      ],
      rebuttals: [
        "Deny material averments not supported by primary documents and demand strict proof.",
        "Challenge legal inference where statutory ingredients are not specifically pleaded.",
        "Distinguish cited precedents on facts, forum, and procedural posture; verify citation before filing.",
        "Assert that equitable relief is unavailable due to delay, conduct, or alternate remedy.",
        "Insist on burden-of-proof compliance before any adverse inference is drawn."
      ],
      proceduralDefenses: [
        "Maintainability objection at threshold hearing.",
        "Limitation and delay/laches objection based on chronology.",
        "Jurisdiction and forum competence objection.",
        "Non-joinder/mis-joinder and defective pleadings objection."
      ],
      strategyChecklist: [
        "Create fact chronology with source documents and dates.",
        "Map each opponent issue to statutory ingredients and gaps.",
        "Prepare preliminary objections before merits arguments.",
        "Prepare short note distinguishing opponent authorities.",
        "Draft hearing note with primary and fallback submissions.",
        "Keep citation verification sheet before filing or argument."
      ],
      confidence: (input.authorities || []).length > 0 ? 0.72 : 0.62,
    };
  }

  /**
   * Fallback analysis when AI fails
   */
  private getFallbackAnalysis(documentText: string): AIAnalysisResult {
    return {
      summary: "This legal document contains important legal principles and procedural elements that require detailed analysis by qualified legal professionals.",
      keyPoints: [
        "Document contains relevant legal provisions and case citations",
        "Procedural compliance and statutory requirements are mentioned", 
        "Constitutional and fundamental rights considerations may apply",
        "Evidence and burden of proof issues are relevant",
        "Jurisdictional and court procedure aspects are important"
      ],
      legalIssues: [
        "Statutory interpretation and application",
        "Constitutional validity and fundamental rights",
        "Procedural compliance and due process",
        "Evidence and burden of proof requirements"
      ],
      recommendations: [
        "Conduct thorough legal research on cited statutes and cases",
        "Verify procedural compliance with applicable court rules",
        "Review constitutional provisions and fundamental rights implications",
        "Consult with specialized legal counsel for case-specific advice",
        "Prepare comprehensive legal arguments with supporting precedents"
      ],
      precedentSuggestions: [
        "Research Supreme Court decisions on similar legal issues",
        "Review High Court judgments from relevant jurisdiction",
        "Examine statutory provisions and their judicial interpretation",
        "Study constitutional bench decisions on fundamental rights"
      ],
      confidence: 0.6
    };
  }
}

// Export singleton instance
export const aiService = new AIService();