import { GoogleGenerativeAI } from '@google/generative-ai';
import { DraftProcessor } from './draftProcessor';
import type { 
  DraftGenerationRequest, 
  DraftGenerationResponse 
} from '@shared/schema';

interface GenerationOptions {
  temperature?: number;
  maxTokens?: number;
  model?: string;
}

export class DraftGenerator {
  private gemini: GoogleGenerativeAI;
  private draftProcessor: DraftProcessor;

  constructor(geminiApiKey: string, draftProcessor: DraftProcessor) {
    this.gemini = new GoogleGenerativeAI(geminiApiKey);
    this.draftProcessor = draftProcessor;
  }

  /**
   * Generate a legal draft using RAG approach with retry logic
   */
  async generateDraft(
    request: DraftGenerationRequest,
    options: GenerationOptions = {}
  ): Promise<DraftGenerationResponse> {
    const startTime = Date.now();
    const maxRetries = 3;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        // Step 1: Build search query
        const searchQuery = this.buildSearchQuery(request);

        // Step 2: Retrieve relevant context from existing drafts
        const similarDrafts = await this.draftProcessor.searchSimilarDrafts(
          searchQuery,
          5 // Top 5 most relevant drafts
        );

        // Step 3: Build context from similar drafts
        const context = this.buildContext(similarDrafts);

        // Step 4: Generate draft using Gemini with context
        const systemPrompt = this.buildSystemPrompt(request.draftType);
        const userPrompt = this.buildUserPrompt(request, context);

        const model = this.gemini.getGenerativeModel({ 
          model: options.model || 'gemini-3.1-flash-lite-preview',
          generationConfig: {
            temperature: options.temperature || 0.7,
            maxOutputTokens: options.maxTokens || 2000, // Reduced from 3000 to stay within quota
          }
        });

        const fullPrompt = `${systemPrompt}\n\n${userPrompt}`;
        const result = await model.generateContent(fullPrompt);
        const response = await result.response;
        
        const generatedDraft = response.text() || '';
        const tokensUsed = result.response.usageMetadata?.totalTokenCount || 0;

        // Step 5: Generate suggestions for improvement
        const suggestions = await this.generateSuggestions(generatedDraft, request);

        // Step 6: Format response
        const processingTime = ((Date.now() - startTime) / 1000).toFixed(2);

        return {
          id: `draft-${Date.now()}`,
          draft: generatedDraft,
          metadata: {
            generatedAt: new Date().toISOString(),
            model: options.model || 'gpt-4-turbo-preview',
            tokensUsed,
            processingTime: `${processingTime}s`,
          },
          references: similarDrafts.map(draft => ({
            filename: draft.filename,
          relevanceScore: draft.score,
          sections: [draft.text.substring(0, 100) + '...'],
        })),
        suggestions,
      };
    } catch (error: any) {
      lastError = error;
      const isQuotaError = error?.message?.includes('quota') || error?.message?.includes('429') || error?.message?.includes('Resource');
      
      if (isQuotaError && attempt < maxRetries - 1) {
        // Exponential backoff: wait 2^attempt seconds before retrying
        const waitTime = Math.pow(2, attempt) * 1000;
        console.warn(`⚠️ Quota limit hit, retrying in ${waitTime}ms (attempt ${attempt + 1}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
        continue;
      }
      
      if (attempt === maxRetries - 1) {
        console.error(`❌ Draft generation failed after ${maxRetries} attempts:`, error);
      }
    }
    }

    // If we exhausted all retries, throw the last error
    if (lastError) {
      throw new Error(`Failed to generate draft after ${maxRetries} attempts: ${lastError.message}`);
    }

    throw new Error('Failed to generate draft: Unknown error');
  }

  /**
   * Build search query from request
   */
  private buildSearchQuery(request: DraftGenerationRequest): string {
    let query = request.prompt;

    if (request.draftType) {
      query = `${request.draftType}: ${query}`;
    }

    if (request.additionalContext?.parties) {
      query += ` involving ${request.additionalContext.parties.join(', ')}`;
    }

    if (request.additionalContext?.court) {
      query += ` for ${request.additionalContext.court}`;
    }

    return query;
  }

  /**
   * Build system prompt based on draft type
   */
  private buildSystemPrompt(draftType?: string): string {
    const basePrompt = `You are an expert legal document drafter with extensive experience in Indian law. 
Your task is to generate professional, accurate, and well-structured legal documents.

Guidelines:
1. Use formal legal language appropriate for Indian courts
2. Follow standard legal document formatting and structure
3. Include all necessary legal clauses and provisions
4. Ensure accuracy in legal terminology and citations
5. Maintain consistency with Indian legal practices
6. Be precise and avoid ambiguity
7. Use the provided examples as reference for style and structure`;

    const draftTypePrompts: Record<string, string> = {
      petition: `${basePrompt}

For petitions specifically:
- Include proper court designation and case details
- State facts chronologically and clearly
- Present legal grounds with statutory references
- Include appropriate prayers for relief
- Follow the proper format: Title, Facts, Grounds, Prayer`,

      affidavit: `${basePrompt}

For affidavits specifically:
- Use first-person narrative
- Include proper jurat and verification
- State facts clearly and sequentially
- Include deponent's details
- Follow the format: Title, I/We statements, Verification`,

      agreement: `${basePrompt}

For agreements specifically:
- Define parties clearly with full legal names
- Include recitals explaining the context
- State terms and conditions precisely
- Include standard clauses (termination, dispute resolution, etc.)
- Ensure consideration is clearly stated`,

      notice: `${basePrompt}

For legal notices specifically:
- State the sender and recipient clearly
- Mention the cause of action
- Specify the relief sought
- Include appropriate legal basis
- Set clear timelines for response/action`,
    };

    return draftType && draftTypePrompts[draftType.toLowerCase()]
      ? draftTypePrompts[draftType.toLowerCase()]
      : basePrompt;
  }

  /**
   * Build user prompt with context
   */
  private buildUserPrompt(
    request: DraftGenerationRequest,
    context: string
  ): string {
    let prompt = `Based on the following examples from similar legal drafts:\n\n${context}\n\n`;

    prompt += `Please generate a legal draft with the following requirements:\n\n`;
    prompt += `${request.prompt}\n\n`;

    if (request.draftType) {
      prompt += `Document Type: ${request.draftType}\n`;
    }

    if (request.additionalContext) {
      const ctx = request.additionalContext;

      if (ctx.parties && ctx.parties.length > 0) {
        prompt += `Parties involved: ${ctx.parties.join(', ')}\n`;
      }

      if (ctx.court) {
        prompt += `Court: ${ctx.court}\n`;
      }

      if (ctx.specificClauses && ctx.specificClauses.length > 0) {
        prompt += `\nPlease ensure the following clauses are included:\n`;
        ctx.specificClauses.forEach((clause: string, index: number) => {
          prompt += `${index + 1}. ${clause}\n`;
        });
      }

      if (ctx.tone) {
        prompt += `\nTone: ${ctx.tone}\n`;
      }
    }

    prompt += `\nPlease provide a complete, professional draft document.`;

    return prompt;
  }

  /**
   * Build context from similar drafts
   */
  private buildContext(similarDrafts: any[]): string {
    if (similarDrafts.length === 0) {
      return 'No similar drafts found. Please create a draft based on standard legal practices.';
    }

    let context = '';
    similarDrafts.forEach((draft, index) => {
      context += `Example ${index + 1} (from ${draft.filename}, relevance: ${(
        draft.score * 100
      ).toFixed(1)}%):\n`;
      context += `${draft.text.substring(0, 800)}...\n\n`;
    });

    return context;
  }

  /**
   * Generate suggestions for draft improvement
   */
  private async generateSuggestions(
    draft: string,
    request: DraftGenerationRequest
  ): Promise<string[]> {
    try {
      const model = this.gemini.getGenerativeModel({ 
        model: 'gemini-3.1-flash-lite-preview',
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 500,
        }
      });

      const prompt = `You are a legal review expert. Analyze the provided legal draft and suggest improvements.

Review this draft and provide 3-5 specific suggestions for improvement:

${draft}

Format your response as numbered list.`;

      const result = await model.generateContent(prompt);
      const response = await result.response;
      const suggestionsText = response.text() || '';
      
      // Parse suggestions (assuming they're numbered)
      const suggestions = suggestionsText
        .split('\n')
        .filter((line: string) => /^\d+\./.test(line.trim()))
        .map((line: string) => line.replace(/^\d+\.\s*/, '').trim());

      return suggestions.slice(0, 5);
    } catch (error) {
      console.error('Error generating suggestions:', error);
      return [
        'Review all party names and details for accuracy',
        'Verify all statutory references and citations',
        'Ensure all dates and timelines are clearly stated',
        'Check formatting and structure consistency',
      ];
    }
  }

  /**
   * Refine an existing draft
   */
  async refineDraft(
    originalDraft: string,
    refinementInstructions: string
  ): Promise<string> {
    try {
      const model = this.gemini.getGenerativeModel({ 
        model: 'gemini-3.1-flash-lite-preview',
        generationConfig: {
          temperature: 0.5,
          maxOutputTokens: 3000,
        }
      });

      const prompt = `You are an expert legal document editor. Refine the provided draft based on the given instructions.

Original Draft:

${originalDraft}

Refinement Instructions:
${refinementInstructions}

Please provide the refined draft.`;

      const result = await model.generateContent(prompt);
      const response = await result.response;
      return response.text() || originalDraft;
    } catch (error) {
      console.error('Error refining draft:', error);
      throw error;
    }
  }

  /**
   * Extract key sections from a draft
   */
  async extractSections(draft: string): Promise<Record<string, string>> {
    try {
      const model = this.gemini.getGenerativeModel({ 
        model: 'gemini-3.1-flash-lite-preview',
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 2000,
          responseMimeType: 'application/json',
        }
      });

      const prompt = `You are a legal document analyzer. Extract and categorize the main sections from the provided legal draft. 
Return the result as a JSON object with section names as keys and their content as values.

Extract the main sections from this draft:

${draft}`;

      const result = await model.generateContent(prompt);
      const response = await result.response;
      const content = response.text() || '{}';
      return JSON.parse(content);
    } catch (error) {
      console.error('Error extracting sections:', error);
      return {};
    }
  }

  /**
   * Compare two drafts and highlight differences
   */
  async compareDrafts(draft1: string, draft2: string): Promise<string> {
    try {
      const model = this.gemini.getGenerativeModel({ 
        model: 'gemini-3.1-flash-lite-preview',
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 1500,
        }
      });

      const prompt = `You are a legal document comparison expert. Compare two drafts and highlight key differences.

Draft 1:

${draft1}

Draft 2:

${draft2}

Provide a detailed comparison highlighting the key differences.`;

      const result = await model.generateContent(prompt);
      const response = await result.response;
      return response.text() || 'Unable to compare drafts.';
    } catch (error) {
      console.error('Error comparing drafts:', error);
      throw error;
    }
  }
}

// Singleton instance
let draftGeneratorInstance: DraftGenerator | null = null;

export async function initializeDraftGenerator(
  draftProcessor: DraftProcessor
): Promise<DraftGenerator> {
  if (draftGeneratorInstance) {
    return draftGeneratorInstance;
  }

  const geminiApiKey = process.env.GEMINI_API_KEY || 
                       process.env.VITE_GEMINI_API_KEY || 
                       process.env.VITE_GOOGLE_AI_API_KEY ||
                       process.env.GOOGLE_AI_API_KEY;

  if (!geminiApiKey) {
    throw new Error('GEMINI_API_KEY is not set');
  }

  draftGeneratorInstance = new DraftGenerator(geminiApiKey, draftProcessor);

  return draftGeneratorInstance;
}

export function getDraftGenerator(): DraftGenerator {
  if (!draftGeneratorInstance) {
    throw new Error('Draft generator not initialized. Call initializeDraftGenerator first.');
  }
  return draftGeneratorInstance;
}
