import {GoogleGenAI} from "@google/genai";
import {JsonSchema} from '../types/amazon';

/**
 * AI service for generating JSON data
 */
export const aiService = {
    /**
     * Generate JSON data based on a schema and user reference
     * @param selectedProperty - The selected property
     * @param subSchema - The schema for the selected property
     * @param userReference - The user reference (optional)
     * @param language_tag
     * @param marketplace_id
     * @returns Promise with generated JSON
     */
    generateJson: async (
        selectedProperty: string,
        subSchema: JsonSchema,
        userReference: string,
        language_tag: string,
        marketplace_id: string,
    ): Promise<string> => {
        console.log('Generating JSON...');
        console.log('Language tag:', language_tag);
        console.log('Marketplace ID:', marketplace_id);
        console.log('Selected property:', selectedProperty);
        console.log('Sub-schema:', subSchema);
        console.log('User reference:', userReference);
        const prompt = `You are an expert assistant for creating Amazon product listings.
                        Your task is to generate or complete JSON data for the property: ${selectedProperty}.
                        
                        Here is the JSON Schema that the final output must conform to:
                        \`\`\`json
                        ${JSON.stringify(subSchema, null, 2)}
                        \`\`\`
                        ${userReference ?
                            `The user has provided the following reference value, description, or partial JSON. Use this as your primary guide to generate and supplement the data. Ensure the final object is complete and valid according to the schema.
                                ---
                                User Reference:
                                ${userReference}
                                ---`
                            : `Based only on the schema provided, generate a complete and valid example JSON object for this property. The generated object should serve as a template that a user can fill out later.`
                        }
    
                        Instructions:
                        Ensure your output adheres strictly to all constraints defined in the schema (e.g., 'type', 'required' fields, 'enum' values, 'minLength', 'maxLength', 'pattern', etc.).
                        If marketplace_id :${marketplace_id}  and language_tag : ${language_tag} are required fields, they must be filled out in strict accordance with the constraints.
                        If the schema defines enums, pick the most relevant value based on the user's reference, or a reasonable default if no reference is given.
                        Only output the raw JSON object itself, without any markdown fences, comments, or other explanatory text.`;

        try {
            const ai = new GoogleGenAI({apiKey: process.env.API_KEY});
            const response = await ai.models.generateContent({
                model: "gemini-2.5-flash-lite-preview-06-17",
                contents: prompt,
                config: {
                    responseMimeType: "application/json",
                },
            });

            const responseText = response.text ?? '';
            if (!responseText) {
                throw new Error("AI response is empty or undefined");
            }

            let jsonStr = responseText.trim();
            const fenceRegex = /^```(\w*)?\s*\n?(.*?)\n?\s*```$/s;
            const match = jsonStr.match(fenceRegex);
            if (match && match[2]) {
                jsonStr = match[2].trim();
            }

            try {
                // Validate that the response is valid JSON
                const parsedJson = JSON.parse(jsonStr);
                return JSON.stringify(parsedJson, null, 2);
            } catch (e) {
                return jsonStr;
            }
        } catch (error: any) {
            throw new Error(`Generation failed: ${error.message}`);
        }
    }
};
