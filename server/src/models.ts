import dotenv from 'dotenv';

dotenv.config();

/**
 * Returns the ordered priority list of Gemini candidate models.
 * 1. process.env.GEMINI_MODEL first (if configured and non-empty)
 * 2. gemini-flash-lite-latest (fastest & officially supported for free/new keys)
 * 3. gemini-2.5-flash-lite
 * 4. gemini-3.8-flash
 * 5. gemini-flash-latest
 */
export function getGeminiModelList(): string[] {
  const envModel = process.env.GEMINI_MODEL?.trim();
  
  const models = [
    envModel,
    'gemini-flash-lite-latest',
    'gemini-2.5-flash-lite',
    'gemini-3.8-flash',
    'gemini-flash-latest'
  ].filter(Boolean) as string[];

  // Return deduplicated list in strict priority order
  return Array.from(new Set(models));
}

export const GEMINI_CANDIDATE_MODELS = getGeminiModelList();

/**
 * Checks whether an error represents a model 404, deprecation, or unavailability,
 * which indicates we should immediately skip to the next fallback model without retrying.
 */
export function isModelUnavailableError(err: any): boolean {
  if (!err) return false;
  
  const status = err.status || err.code || err.statusCode;
  if (status === 404 || status === '404' || status === 'NOT_FOUND') {
    return true;
  }

  const rawStr = typeof err === 'string' 
    ? err 
    : (err.message || '') + ' ' + (err.stack || '') + ' ' + JSON.stringify(err);

  const lower = rawStr.toLowerCase();
  return (
    lower.includes('404') ||
    lower.includes('not found') ||
    lower.includes('not_found') ||
    lower.includes('no longer available') ||
    lower.includes('deprecated') ||
    lower.includes('unsupported') ||
    lower.includes('is not available') ||
    lower.includes('does not exist') ||
    lower.includes('503') ||
    lower.includes('high demand')
  );
}

/**
 * Cleans and sanitizes error messages so raw JSON structures or SDK dumps
 * are NEVER displayed in the user interface.
 */
export function cleanErrorMessage(rawError: any): string {
  if (!rawError) return 'An unexpected error occurred during processing.';

  let text = typeof rawError === 'string' ? rawError : rawError.message || String(rawError);

  // If the error message embeds a JSON string (e.g. GoogleGenAI error JSON)
  try {
    // Check if whole text is JSON
    const parsed = JSON.parse(text);
    if (parsed.error?.message) {
      return cleanErrorMessage(parsed.error.message);
    }
  } catch {
    // Check if JSON object is embedded inside a prefix like "[GoogleGenAI Error]: {...}"
    const jsonMatch = text.match(/\{[\s\S]*"error"[\s\S]*\}/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]);
        if (parsed.error?.message) {
          return cleanErrorMessage(parsed.error.message);
        }
      } catch {
        // Continue to regex cleanup
      }
    }
  }

  // Clean specific known Gemini messages into human-readable mission control text
  if (text.includes('API_KEY_INVALID') || text.includes('API key not valid')) {
    return 'Invalid Gemini API Key. Please verify the GEMINI_API_KEY value in server/.env.';
  }

  if (text.includes('KEY_MISSING') || text.includes('GEMINI_API_KEY is not configured')) {
    return 'GEMINI_API_KEY is missing from server/.env. Please configure your Google AI Studio API key.';
  }

  if (text.includes('no longer available') || text.includes('not found to new users')) {
    return 'The requested AI model is deprecated or unavailable. Switched to fallback model.';
  }

  if (text.includes('RESOURCE_EXHAUSTED') || text.includes('Quota exceeded')) {
    return 'AI rate limit exceeded. Please wait a few moments before transmitting again.';
  }

  if (text.includes('timed out after') || text.includes('TIMEOUT')) {
    return 'Telemetry analysis timed out after 30 seconds. Please try again with a shorter excerpt.';
  }

  if (text.includes('fetch failed') || text.includes('ENOTFOUND') || text.includes('ECONNREFUSED')) {
    return 'Network connection to Gemini AI failed. Please verify internet connectivity.';
  }

  // Strip JSON formatting characters and code markers
  text = text
    .replace(/^Error:\s*/i, '')
    .replace(/\[.*?Error\]:?\s*/gi, '')
    .replace(/\{"error":\{.*?"message":"([^"]+)".*?\}\}/gs, '$1')
    .replace(/[{}\[\]"]/g, '')
    .trim();

  // If text is still empty or looks like garbage
  if (!text || text.length < 5) {
    return 'Telemetry analysis failed. Please verify your API key and retry.';
  }

  return text;
}

/**
 * Universal runner to execute an AI operation with automatic model fallback.
 * Tries each model from getGeminiModelList() in priority order.
 * If a 404 or "no longer available" error occurs, it skips immediately to the next model.
 */
export async function executeWithModelFallback<T>(
  label: string,
  operation: (modelName: string) => Promise<T>,
  options: { maxAttemptsPerModel?: number } = {}
): Promise<T> {
  const models = getGeminiModelList();
  const maxAttempts = options.maxAttemptsPerModel || 2;
  let lastError: any = null;

  for (const modelName of models) {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        console.log(`[${label}] Trying model: ${modelName} (attempt ${attempt}/${maxAttempts})...`);
        const result = await operation(modelName);
        console.log(`[${label}] Succeeded with model: ${modelName}`);
        return result;
      } catch (err: any) {
        lastError = err;
        const isUnavailable = isModelUnavailableError(err);
        const cleanMsg = cleanErrorMessage(err);
        
        console.warn(`[${label}] Model ${modelName} (attempt ${attempt}) failed: ${cleanMsg}`);

        // If the model is 404, not found, or deprecated, DO NOT retry this model; proceed to next model
        if (isUnavailable) {
          console.warn(`[${label}] Model ${modelName} is unavailable/deprecated. Skipping to next model in priority list.`);
          break;
        }

        // Delay slightly before retrying the same model (e.g. transient network glitch)
        if (attempt < maxAttempts) {
          await new Promise(r => setTimeout(r, 800));
        }
      }
    }
  }

  const finalMsg = cleanErrorMessage(lastError);
  const finalError: any = new Error(finalMsg);
  finalError.code = lastError?.code || 'AI_EXECUTION_FAILED';
  finalError.original = lastError;
  throw finalError;
}
