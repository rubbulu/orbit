import { GoogleGenAI, Type } from '@google/genai';
import { Decision, ConflictType, ConflictSeverity } from '../../shared/types.js';
import { executeWithModelFallback } from './models.js';

export interface RawDetectedConflict {
  newDecisionId: string;
  existingDecisionId: string;
  type: ConflictType;
  severity: ConflictSeverity;
  confidence: number;
  explanation: string;
}

export interface ConflictDetectionResult {
  conflicts: RawDetectedConflict[];
}

const CONFLICT_SYSTEM_PROMPT = `You are a decision-integrity auditor for ORBIT, an institutional memory intelligence system.
Your job is to compare newly extracted decisions against existing historical decisions to detect genuine operational contradictions and policy conflicts.

CRITICAL CONFLICT AUDIT RULES:
1. A conflict exists ONLY when two decisions CANNOT both be true or both be executed as stated.
   Examples of genuine conflicts:
   - Changed dates or schedules (e.g., "Launch on Nov 15" vs "Launch delayed to Dec 1").
   - Opposing resource allocations (e.g., "Open requisition for 2 backend engineers" vs "Institute immediate hiring freeze across all engineering roles").
   - Contradictory pricing or financial commitments (e.g., "Starter tier priced at $29" vs "Starter tier priced at $49").
   - Budget ceilings that cut approved expenditures.
2. Do NOT flag decisions that are merely related, complementary, or address different topics or scopes.
   - For example: Extending trial periods to 30 days is NOT a conflict with keeping Starter tier at $29.
   - Exporting CSV audit logs is NOT a conflict with discarding raw audio streams.
3. BE CONSERVATIVE: when in doubt, do NOT flag.
4. Only return conflicts where your confidence is >= 0.7.
5. In 'explanation', explain in 1-2 concise, objective plain English sentences why the two commitments directly contradict each other.
6. Allowed conflict types:
   - "direct_contradiction": logically opposite decisions (e.g. hiring vs freeze, enable vs disable).
   - "timeline_conflict": incompatible launch dates, milestone shifts, or conflicting delivery deadlines.
   - "resource_conflict": competing budget limits, hardware allocation cuts, or headcount caps.
   - "scope_change": conflicting feature commitments or tier requirements.`;

const conflictSchema = {
  type: Type.OBJECT,
  properties: {
    conflicts: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          newDecisionId: {
            type: Type.STRING,
            description: "The ID of the newly ingested decision (e.g., DEC-010)",
          },
          existingDecisionId: {
            type: Type.STRING,
            description: "The ID of the older historical decision it contradicts (e.g., DEC-003)",
          },
          type: {
            type: Type.STRING,
            enum: ["direct_contradiction", "resource_conflict", "timeline_conflict", "scope_change"],
            description: "Classification of the conflict",
          },
          severity: {
            type: Type.STRING,
            enum: ["critical", "high", "medium"],
            description: "Business severity of this contradiction",
          },
          confidence: {
            type: Type.NUMBER,
            description: "Confidence rating between 0.0 and 1.0 (must be >= 0.7)",
          },
          explanation: {
            type: Type.STRING,
            description: "Concise 1-2 sentence plain English explanation of the contradiction",
          },
        },
        required: ["newDecisionId", "existingDecisionId", "type", "severity", "confidence", "explanation"],
      },
    },
  },
  required: ["conflicts"],
};

export async function detectCrossMeetingConflicts(params: {
  newDecisions: Decision[];
  existingDecisions: Decision[];
}): Promise<RawDetectedConflict[]> {
  const apiKey = process.env.GEMINI_API_KEY?.trim();

  // If no new or existing decisions, or no API key, return empty
  if (!apiKey || params.newDecisions.length === 0 || params.existingDecisions.length === 0) {
    return [];
  }

  // Filter existing decisions: only active or already conflict (skip superseded)
  const activeHistorical = params.existingDecisions.filter(d => d.status !== 'superseded');
  if (activeHistorical.length === 0) {
    return [];
  }

  const ai = new GoogleGenAI({ apiKey });

  const historicalSummary = activeHistorical.map(d => (
    `[${d.id}] (Meeting: ${d.meetingId}, Made by: ${d.madeBy}, Date: ${d.timestamp || 'Recorded'})\n` +
    `  Decision: "${d.text}"\n` +
    `  Rationale: ${d.rationale}\n` +
    `  Quote: "${d.sourceQuote}"`
  )).join('\n\n');

  const newSummary = params.newDecisions.map(d => (
    `[${d.id}] (Meeting: ${d.meetingId}, Made by: ${d.madeBy})\n` +
    `  Decision: "${d.text}"\n` +
    `  Rationale: ${d.rationale}\n` +
    `  Quote: "${d.sourceQuote}"`
  )).join('\n\n');

  const prompt = `HISTORICAL DECISIONS IN MEMORY:
===
${historicalSummary}
===

NEWLY EXTRACTED DECISIONS:
===
${newSummary}
===

Compare each NEW decision against the HISTORICAL decisions. Detect any operational contradictions or incompatible commitments. Remember: only return true conflicts with confidence >= 0.7.`;

  try {
    return await executeWithModelFallback<RawDetectedConflict[]>(
      'CONFLICT DETECTOR',
      async (modelName: string) => {
        const timeoutPromise = new Promise<never>((_, reject) => {
          const id = setTimeout(() => {
            clearTimeout(id);
            reject(new Error('Conflict detection timed out after 25 seconds'));
          }, 25000);
        });

        const apiPromise = ai.models.generateContent({
          model: modelName,
          contents: prompt,
          config: {
            systemInstruction: CONFLICT_SYSTEM_PROMPT,
            responseMimeType: 'application/json',
            responseSchema: conflictSchema,
            temperature: 0.1,
          },
        });

        const response = await Promise.race([apiPromise, timeoutPromise]);
        const text = response.text?.trim() || '';

        if (!text) {
          return [];
        }

        const parsed: ConflictDetectionResult = JSON.parse(text);
        const validConflicts = (parsed.conflicts || []).filter(c => {
          // Verify both IDs exist
          const newExists = params.newDecisions.some(d => d.id === c.newDecisionId);
          const histExists = activeHistorical.some(d => d.id === c.existingDecisionId);
          return newExists && histExists && c.confidence >= 0.7;
        });

        console.log(`[CONFLICT DETECTOR] Audit complete! Found ${validConflicts.length} confirmed conflict(s).`);
        return validConflicts;
      }
    );
  } catch (err: any) {
    // If all models fail, return empty list gracefully (do not break meeting transmission)
    console.warn('[CONFLICT DETECTOR] Conflict detection could not reach model, returning zero conflicts gracefully:', err?.message || err);
    return [];
  }
}
