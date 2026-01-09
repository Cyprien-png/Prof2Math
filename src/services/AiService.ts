import { createOpenAI } from '@ai-sdk/openai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createAnthropic } from '@ai-sdk/anthropic';
import type { LanguageModel } from 'ai';

class AiService {
    getModel(): LanguageModel {
        const provider = localStorage.getItem('mathdown_ai_provider') || 'openai';
        const apiKey = localStorage.getItem('mathdown_ai_api_key');

        if (!apiKey) {
            throw new Error("AI API Key is missing. Please configure it in settings.");
        }

        if (provider === 'openai') {
            const openai = createOpenAI({ apiKey, dangerouslyAllowBrowser: true } as any);
            return openai('gpt-4o');
        } else if (provider === 'google') {
            const google = createGoogleGenerativeAI({ apiKey });
            // Using the specific preview model as requested/configured by user
            return google('gemini-3-flash-preview');
        } else if (provider === 'anthropic') {
            const anthropic = createAnthropic({ apiKey });
            return anthropic('claude-3-5-sonnet-20240620');
        }

        throw new Error(`Unsupported AI provider: ${provider}`);
    }
}

export const aiService = new AiService();
