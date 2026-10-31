import { GoogleGenAI, Type } from '@google/genai';
import { executeWithModelFallback } from './models.js';

export interface ExtractedDecision {
  text: string;
  madeBy: string;
  rationale: string;
  sourceQuote: string;
  importance: 'critical' | 'high' | 'medium';
}

export interface ExtractedActionItem {
  task: string;
  owner: string | null;
  deadline: string | null;
  relatedDecisionIndex: number;
}

export interface ExtractionResult {
  meetingTitle: string;
  participants: string[];
  decisions: ExtractedDecision[];
  actionItems: ExtractedActionItem[];
}

const SYSTEM_PROMPT = `You are a meticulous meeting analyst for ORBIT, an institutional memory system.
Your job is to read meeting transcripts and extract definitive commitments, decisions, and action items.

CRITICAL EXTRACTION RULES:
1. A DECISION is something the group explicitly agreed or committed to, not a discussion point, proposal, or exploratory idea.
2. Every decision must include the EXACT sourceQuote copied word-for-word from the transcript proving the commitment was made.
3. Attribute madeBy accurately using the speaker names from the transcript.
4. Resolve relative dates (e.g. "next Friday", "in two weeks", "by end of month") into concrete ISO dates (YYYY-MM-DD) using the provided meeting date as the anchor.
5. If an action item's owner or deadline is not stated, set it to null. NEVER invent owners or deadlines.
6. Rate importance by business impact:
   - "critical": impacts core launch dates, major budget allocations (> $10k), enterprise security, or company roadmap.
   - "high": core pricing, major feature scope changes, critical vendor choices.
   - "medium": internal tooling, minor workflow adjustments, documentation.
7. Each action item must indicate which decision it implements via 'relatedDecisionIndex' (0-based index into the decisions array).`;

const extractionSchema = {
  type: Type.OBJECT,
  properties: {
    meetingTitle: {
      type: Type.STRING,
      description: "Concise, descriptive title for the meeting, e.g. 'Enterprise Pilot Review' or 'Q4 Budget Alignment'",
    },
    participants: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "List of participant full names or speaker handles identified in the transcript",
    },
    decisions: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          text: {
            type: Type.STRING,
            description: "Clear, declarative statement of the agreed commitment or decision",
          },
          madeBy: {
            type: Type.STRING,
            description: "Speaker who announced or finalized the decision",
          },
          rationale: {
            type: Type.STRING,
            description: "The underlying reason or justification given for this decision",
          },
          sourceQuote: {
            type: Type.STRING,
            description: "Exact word-for-word quote from the transcript",
          },
          importance: {
            type: Type.STRING,
            enum: ["critical", "high", "medium"],
            description: "Business impact level",
          },
        },
        required: ["text", "madeBy", "rationale", "sourceQuote", "importance"],
      },
    },
    actionItems: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          task: {
            type: Type.STRING,
            description: "Action item task description",
          },
          owner: {
            type: Type.STRING,
            nullable: true,
            description: "Assigned owner name, or null if unassigned",
          },
          deadline: {
            type: Type.STRING,
            nullable: true,
            description: "ISO date format (YYYY-MM-DD) or null if unstated",
          },
          relatedDecisionIndex: {
            type: Type.INTEGER,
            description: "0-based index of the decision in decisions array that this action belongs to",
          },
        },
        required: ["task", "relatedDecisionIndex"],
      },
    },
  },
  required: ["meetingTitle", "participants", "decisions", "actionItems"],
};

export async function extractMeetingTelemetry(params: {
  transcript: string;
  meetingDate?: string;
  titleHint?: string;
}): Promise<ExtractionResult> {
  const apiKey = process.env.GEMINI_API_KEY?.trim();

  if (!apiKey || apiKey === 'your_gemini_api_key_here') {
    const error: any = new Error(
      'GEMINI_API_KEY is not configured in server/.env. Please add your key to server/.env to enable live AI extraction.'
    );
    error.code = 'KEY_MISSING';
    throw error;
  }

  const ai = new GoogleGenAI({ apiKey });
  const anchorDate = params.meetingDate || new Date().toISOString().split('T')[0];

  const userPrompt = `MEETING DATE: ${anchorDate}
${params.titleHint ? `TITLE HINT: ${params.titleHint}\n` : ''}
TRANSCRIPT:
"""
${params.transcript}
"""

Extract the meeting title, participants, decisions, and action items adhering strictly to the defined schema.`;

  return await executeWithModelFallback<ExtractionResult>(
    'GEMINI EXTRACTOR',
    async (modelName: string) => {
      // 30-second timeout guard
      const timeoutPromise = new Promise<never>((_, reject) => {
        const id = setTimeout(() => {
          clearTimeout(id);
          const err: any = new Error('Gemini API call timed out after 30 seconds.');
          err.code = 'TIMEOUT';
          reject(err);
        }, 30000);
      });

      const apiPromise = ai.models.generateContent({
        model: modelName,
        contents: userPrompt,
        config: {
          systemInstruction: SYSTEM_PROMPT,
          responseMimeType: 'application/json',
          responseSchema: extractionSchema,
          temperature: 0.1,
        },
      });

      const response = await Promise.race([apiPromise, timeoutPromise]);
      const rawText = response.text?.trim() || '';

      if (!rawText) {
        throw new Error('Gemini returned an empty response.');
      }

      const parsed: ExtractionResult = JSON.parse(rawText);

      // Validate basic structure
      if (!Array.isArray(parsed.decisions) || !Array.isArray(parsed.actionItems)) {
        throw new Error('Malformed JSON structure from Gemini.');
      }

      return parsed;
    }
  );
}
