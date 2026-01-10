import { createOpenAI } from '@ai-sdk/openai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createAnthropic } from '@ai-sdk/anthropic';
import { generateText, type LanguageModel } from 'ai';
import { PROMPTS } from '../prompts';

class AiService {
    getModel(): LanguageModel {
        const provider = localStorage.getItem('prof2math_ai_provider') || 'openai';
        const apiKey = localStorage.getItem('prof2math_ai_api_key');

        if (!apiKey) {
            throw new Error("AI API Key is missing. Please configure it in settings.");
        }

        if (provider === 'openai') {
            const openai = createOpenAI({ apiKey, dangerouslyAllowBrowser: true } as any);
            return openai('gpt-4o');
        } else if (provider === 'google') {
            const google = createGoogleGenerativeAI({ apiKey });
            // Using the specific preview model as requested/configured by user
            return google('gemini-2.0-flash-exp');
        } else if (provider === 'anthropic') {
            const anthropic = createAnthropic({ apiKey });
            return anthropic('claude-3-5-sonnet-20240620');
        }

        throw new Error(`Unsupported AI provider: ${provider}`);
    }

    async generateFileContent(template: string, subject: string, description: string): Promise<string> {
        let prompt;

        switch (template) {
            case 'Exercises': prompt = PROMPTS.FILE_TEMPLATES.EXERCISE;
                break;
            case 'Theory': prompt = PROMPTS.FILE_TEMPLATES.THEORY;
                break;
            case 'Theory + exercises': prompt = PROMPTS.FILE_TEMPLATES.THEORY_AND_EXERCISES;
                break;
            default: throw new Error(`Not implemented: '${template}' template is not supported.`);
        }

        const model = this.getModel();
        const language = localStorage.getItem('prof2math_language') || 'English';


        prompt = prompt.replace('@subject', subject)
            .replace('@description', description)
            .replace('@Language', language);

        const { text } = await generateText({
            model,
            prompt
        });

        return this.formatAiResponse(text);
    }

    private formatAiResponse(text: string): string {
        const trimmed = text.trim();
        // Check if it starts with ```markdown (or just ```) and ends with ```
        // and importantly, that it looks like a wrapper (start and end)
        const startRegex = /^```(markdown)?/i;
        const endRegex = /```$/;

        if (startRegex.test(trimmed) && endRegex.test(trimmed)) {
            // Remove the start match
            let cleaned = trimmed.replace(startRegex, '');
            // Remove the end match (last 3 chars generally, but regex handles it)
            cleaned = cleaned.replace(endRegex, '');
            return cleaned.trim();
        }

        return text;
    }
}

export const aiService = new AiService();
