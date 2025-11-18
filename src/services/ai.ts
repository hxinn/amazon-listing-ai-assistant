import { GoogleGenAI } from "@google/genai";
import axios from 'axios';
import { JsonSchema } from '../types/amazon';
import { rateLimiter } from '../utils/rateLimiter';
import { config } from '../config';
import { parseSchemaProperties } from '../utils/valida.js';

/**
 * Amazon Listing system prompt used for both OpenAI and Google AI
 */
const AMAZON_LISTING_SYSTEM_PROMPT = `你是一个高度专业化且经验丰富的**Amazon Listing 产品属性专家 AI Agent**。你的核心职责是协助用户根据Amazon不同站点的上架产品要求和特定的分类类型JSON Schema规范，准确无误地填写产品属性。
## 你的专业能力包括：
1.  **全面的Amazon站点上架要求知识：**
   * 你深入了解Amazon全球各个站点（例如：美国站、欧洲站、日本站、澳洲站等）在产品上架方面的独特要求、政策、法规和最佳实践。
   * 你熟悉不同站点对产品信息展示、图片要求、符合性认证（如CE, FCC等）、禁售品等方面的差异，**包括对当地语言的偏好、商品描述的文化适应性，以及区域性计量单位的使用习惯。**
2.  **精通JSON Schema属性规范和约束：**
   * 你能够准确理解和解析各种**Amazon分类类型 (Category Type)** 对应的**JSON Schema文件**。
   * 你对JSON Schema中的各种**属性类型**（如：\`string\`, \`number\`, \`boolean\`, \`array\`, \`enum\`）、**格式**（\`format\`，如\`date-time\`, \`uri\`）、**约束条件**（如：\`minLength\`, \`maxLength\`, \`minimum\`, \`maximum\`, \`pattern\`, \`required\`, \`uniqueItems\`）有深刻的理解。
   * 你能够识别并处理嵌套属性、条件属性（\`if/then/else\`）、引用（\`$ref\`）等复杂的JSON Schema结构。
3.  **产品信息解析与映射：**
   * 你能够准确地解析用户提供的产品信息，无论这些信息是以文本、列表，或者其他非结构化形式呈现。**请注意，用户提供的所有产品信息将以英文呈现。**
   * 你具备将用户提供的产品信息与JSON Schema中定义的属性进行**精准映射**的能力。
4.  **智能属性填写、翻译与单位转换：**
   * 根据用户提供的**英文产品信息**和JSON Schema约束，你将自动且智能地填写对应的产品属性。
   * 在填写过程中，你将严格遵守JSON Schema中定义的各种约束（如数据类型、长度限制、枚举值、正则匹配等）。
   * **你具备将用户提供的英文产品信息准确翻译为目标Amazon站点的官方语言的能力。** 例如，如果目标站点是Amazon日本站，而用户提供了英文的"Product Color: Red"，你将自动将该属性值填写为"商品の色: 赤"。
   * **你还需要处理计量单位的智能转换。** 用户将以**厘米（cm）** 和 **千克（kg）** 为基础单位提供长度、宽度、高度、重量等信息。你将根据目标Amazon站点（或其JSON Schema）的要求，智能地将这些单位转换为该站点常用的计量单位（例如，将厘米转换为英寸，将千克转换为磅），并准确填写。
   * 如果发现用户提供的产品信息与JSON Schema约束不符，你将提供替代方案。
   * 对于必填**枚举值 (\`enum\`)** 的属性，你将优先从JSON Schema提供的枚举列表中选择最匹配的值。否则允许自定义值时优先自定义值
   * 对于**必填 (\`required\`)** 但用户未提供信息的属性，你将提供替代方案。
   * \`marketplace_id\`与\`language_tag\`如果这两属性为非必填则无需带出可以忽略,只有明确为必填时才输出
   * 你能够处理依赖关系复杂的属性，例如当一个属性的值决定了另一个属性是否出现或其可用值的范围。
5.  **友好且清晰的沟通：**
   * 你的输出将以**结构化的JSON格式**呈现，符合JSON Schema的最终规范。
   * 在需要用户干预或提供更多信息时，你的提示将清晰、具体、易于理解。
---
## 工作流程：

1.  **用户提供：**
   * 属性参考值: 
   * 对应Amazon站点的**分类类型JSON Schema约束文件或单个属性约束**
   * 目标Amazon站点、语种
2.  **你的输出：**
   * 一个完整的、符合所提供JSON Schema约束的**产品属性JSON对象**，其中属性值已根据目标站点语言和常用计量单位进行了翻译和转换。
   * 如果用户提供的信息不完整或不正确，你将提供替代方案。
   * 禁止输出空对象
   * 只输出原始 JSON 对象本身，而不输出任何标记符、注释或其他解释性文本。
---
**请记住：** 你的目标是最大限度地减少人工干预，确保生成的Listing属性符合Amazon的规范，提高上架效率和准确性。`;

const UNIT_PROMPT = "对于计量单位属性，使用动态模版进行替换。例: [{\"length\":\"${sku.length}\", \"unit\": \"centimeters\"}], 其中\"${sku.length}\"为计算出的动态模版;动态模版中sku.length,是程序提供的，计量单位不存在`centimeters`时，需要将动态模板的值乘以转换数值，转换为对应的地区常用计量单位例如：centimeters 转换 inches，${sku.length *  0.393701} 需要乘以`0.393701` *转换单位*返回"

/**
 * Generate user prompt based on schema, reference, marketplace and language
 */
const generateUserPrompt = (
    subSchema: JsonSchema,
    userReference: string,
    marketplace_id: string,
    language_tag: string
): string => {
    return `**以下为用户提供的信息**
            schema:
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
            language_tag : ${language_tag}`;
};

/**
 * AI service for generating JSON data
 */
export const aiService = {
    /**
     * Generate JSON data based on a schema and user reference using Anthropic Claude API
     * @param selectedProperty - The selected property
     * @param subSchema - The schema for the selected property
     * @param userReference - The user reference (optional)
     * @param language_tag - The language tag
     * @param marketplace_id - The marketplace ID
     * @returns Promise with generated JSON
     */
    generateJsonWithClaude: async (
        selectedProperty: string,
        subSchema: JsonSchema,
        userReference: string,
        language_tag: string,
        marketplace_id: string,
    ): Promise<string> => {
        console.log(`[Claude] Selected property: ${selectedProperty}, Marketplace ID: ${marketplace_id}, Language tag: ${language_tag} ,User reference: ${userReference} , Schema: ${subSchema}`);

        // Use the shared system prompt and generate user prompt
        const userPrompt = generateUserPrompt(subSchema, userReference, marketplace_id, language_tag);

        try {
            // Helper function to execute the API call with retry logic for 429 errors
            const executeWithRetry = async (retryCount = 0, maxRetries = 3) => {
                try {
                    // Use rate limiter to limit concurrent API calls
                    return await rateLimiter.execute(async () => {
                        const response = await axios.post(
                            `${config.CLAUDE_API_URL}/messages`,
                            {
                                model: "claude-3-7-sonnet",
                                max_tokens: 4096,
                                messages: [
                                    {
                                        role: "user",
                                        content: userPrompt
                                    }
                                ],
                                system: AMAZON_LISTING_SYSTEM_PROMPT,
                                response_format: { type: "json_object" }
                            },
                            {
                                headers: {
                                    'Content-Type': 'application/json',
                                    'x-api-key': process.env.CLAUDE_API_KEY,
                                    'anthropic-version': '2023-06-01'
                                }
                            }
                        );
                        return response.data;
                    });
                } catch (error: any) {
                    // Check if it's a 429 error (rate limit exceeded)
                    if (error.response?.status === 429) {
                        // Check if we've reached the maximum number of retries
                        if (retryCount >= maxRetries) {
                            console.error(`Maximum retry attempts (${maxRetries}) reached. Giving up.`);
                            throw new Error(`Rate limit exceeded (429). Maximum retry attempts reached: ${error.message}`);
                        }

                        console.log(`Rate limit exceeded (429). Retry attempt ${retryCount + 1}/${maxRetries}`);

                        // Extract retry delay from the error response
                        let retryDelay = 60; // Default 60 seconds if not specified

                        try {
                            if (error.response?.headers['retry-after']) {
                                retryDelay = parseInt(error.response.headers['retry-after'], 10);
                            }
                        } catch (parseError) {
                            console.error('Error parsing retry delay:', parseError);
                        }

                        console.log(`Waiting for ${retryDelay} seconds before retrying...`);

                        // Wait for the specified delay
                        await new Promise(resolve => setTimeout(resolve, retryDelay * 1000));

                        // Retry the request with incremented retry count
                        console.log(`Retrying request after waiting (attempt ${retryCount + 1}/${maxRetries})...`);
                        return await executeWithRetry(retryCount + 1, maxRetries);
                    }

                    // If it's not a 429 error, rethrow
                    throw error;
                }
            };

            // Execute the API call with retry logic
            const response = await executeWithRetry();

            if (!response.content || !response.content[0] || !response.content[0].text) {
                throw new Error("AI response is empty or undefined");
            }

            const responseText = response.content[0].text;
            let jsonStr = responseText.trim();

            const fenceRegex = /^```(\w*)?\s*\n?(.*?)\n?\s*```$/s;
            const match = jsonStr.match(fenceRegex);
            if (match && match[2]) {
                jsonStr = match[2].trim();
            }

            try {
                // Validate that the response is valid JSON
                const parsedJson = JSON.parse(jsonStr);
                return JSON.stringify(parsedJson);
            } catch (e) {
                // Throw error for invalid JSON instead of returning the raw string
                const error = e instanceof Error ? e : new Error(String(e));
                throw new Error(`AI response is not valid JSON: ${error.message}`);
            }
        } catch (error: any) {
            throw new Error(`Claude generation failed: ${error.message}`);
        }
    },

    /**
     * Generate JSON data based on a schema and user reference using OpenAI API
     * @param selectedProperty - The selected property
     * @param subSchema - The schema for the selected property
     * @param userReference - The user reference (optional)
     * @param language_tag - The language tag
     * @param marketplace_id - The marketplace ID
     * @returns Promise with generated JSON
     */
    generateJsonWithOpenAI: async (
        selectedProperty: string,
        subSchema: JsonSchema,
        userReference: string,
        language_tag: string,
        marketplace_id: string,
    ): Promise<string> => {
        // Use the shared system prompt and generate user prompt
        const userPrompt = generateUserPrompt(subSchema, userReference, marketplace_id, language_tag);

        try {
            // Helper function to execute the API call with retry logic for 429 errors
            const executeWithRetry = async (retryCount = 0, maxRetries = 3) => {
                try {
                    // Use rate limiter to limit concurrent API calls
                    return await rateLimiter.execute(async () => {
                        const response = await axios.post(
                            `${config.OPENAI_API_URL}/chat/completions`,
                            {
                                model: "gemini-2.5-flash-preview-05-20",
                                messages: [
                                    {
                                        role: "system",
                                        content: AMAZON_LISTING_SYSTEM_PROMPT
                                    },
                                    {
                                        role: "output",
                                        content: "请严格遵守以下规则:跳过`marketplace_id`属性,不输出`marketplace_id`属性"
                                    },
                                    {
                                        role: "user",
                                        content: userPrompt
                                    }
                                ],
                                response_format: { type: "json_object" }
                            },
                            {
                                headers: {
                                    'Content-Type': 'application/json',
                                    'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
                                }
                            }
                        );
                        return response.data;
                    });
                } catch (error: any) {
                    // Check if it's a 429 error (rate limit exceeded)
                    if (error.response?.status === 429) {
                        // Check if we've reached the maximum number of retries
                        if (retryCount >= maxRetries) {
                            console.error(`Maximum retry attempts (${maxRetries}) reached. Giving up.`);
                            throw new Error(`Rate limit exceeded (429). Maximum retry attempts reached: ${error.message}`);
                        }

                        console.log(`Rate limit exceeded (429). Retry attempt ${retryCount + 1}/${maxRetries}`);

                        // Extract retry delay from the error response
                        let retryDelay = 60; // Default 60 seconds if not specified

                        try {
                            if (error.response?.headers['retry-after']) {
                                retryDelay = parseInt(error.response.headers['retry-after'], 10);
                            }
                        } catch (parseError) {
                            console.error('Error parsing retry delay:', parseError);
                        }

                        console.log(`Waiting for ${retryDelay} seconds before retrying...`);

                        // Wait for the specified delay
                        await new Promise(resolve => setTimeout(resolve, retryDelay * 1000));

                        // Retry the request with incremented retry count
                        console.log(`Retrying request after waiting (attempt ${retryCount + 1}/${maxRetries})...`);
                        return await executeWithRetry(retryCount + 1, maxRetries);
                    }

                    // If it's not a 429 error, rethrow
                    throw error;
                }
            };

            // Execute the API call with retry logic
            const response = await executeWithRetry();

            if (!response.choices || !response.choices[0] || !response.choices[0].message || !response.choices[0].message.content) {
                throw new Error("AI response is empty or undefined");
            }

            const responseText = response.choices[0].message.content;
            let jsonStr = responseText.trim();

            const fenceRegex = /^```(\w*)?\s*\n?(.*?)\n?\s*```$/s;
            const match = jsonStr.match(fenceRegex);
            if (match && match[2]) {
                jsonStr = match[2].trim();
            }

            try {
                // Validate that the response is valid JSON
                const parsedJson = JSON.parse(jsonStr);
                return JSON.stringify(parsedJson);
            } catch (e) {
                // Throw error for invalid JSON instead of returning the raw string
                const error = e instanceof Error ? e : new Error(String(e));
                throw new Error(`AI response is not valid JSON: ${error.message}`);
            }
        } catch (error: any) {
            throw new Error(`OpenAI generation failed: ${error.message}`);
        }
    },
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
        console.log(`Selected property: ${selectedProperty}, Marketplace ID: ${marketplace_id}, Language tag: ${language_tag} ,User reference: ${userReference} , Schema: ${subSchema}`);

        // Use the shared system prompt and generate user prompt
        const userPrompt = generateUserPrompt(subSchema, userReference, marketplace_id, language_tag);


        try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

            // Helper function to execute the API call with retry logic for 429 errors
            const executeWithRetry = async (retryCount = 0, maxRetries = 3) => {
                try {
                    // Use rate limiter to limit concurrent API calls
                    return await rateLimiter.execute(async () => {
                        return await ai.models.generateContent({
                            model: "gemini-2.5-pro",
                            contents: userPrompt,
                            config: {
                                responseMimeType: "application/json",
                                systemInstruction: AMAZON_LISTING_SYSTEM_PROMPT,
                                temperature: 0.1
                            },
                        });
                    });
                } catch (error: any) {
                    // Check if it's a 429 error (rate limit exceeded)
                    if (error.response?.data?.error?.code === 429 ||
                        (error.message && error.message.includes('429'))) {

                        // Check if we've reached the maximum number of retries
                        if (retryCount >= maxRetries) {
                            console.error(`Maximum retry attempts (${maxRetries}) reached. Giving up.`);
                            throw new Error(`Rate limit exceeded (429). Maximum retry attempts reached: ${error.message}`);
                        }

                        console.log(`Rate limit exceeded (429). Retry attempt ${retryCount + 1}/${maxRetries}`);

                        // Extract retry delay from the error response
                        let retryDelay = 60; // Default 30 seconds if not specified

                        try {
                            // Navigate through the error details to find retryDelay
                            const details = error.response?.data?.error?.details;
                            if (details && Array.isArray(details)) {
                                for (const detail of details) {
                                    if (detail['@type'] === 'type.googleapis.com/google.rpc.RetryInfo' && detail.retryDelay) {
                                        // Extract seconds from the retryDelay string (format: "31s")
                                        const delayMatch = detail.retryDelay.match(/(\d+)s/);
                                        console.log("RetryInfo retryDelay:", delayMatch)
                                        if (delayMatch && delayMatch[1]) {
                                            retryDelay = parseInt(delayMatch[1], 10);
                                        }
                                        break;
                                    }
                                }
                            }
                        } catch (parseError) {
                            console.error('Error parsing retry delay:', parseError);
                        }

                        console.log(`Waiting for ${retryDelay} seconds before retrying...`);

                        // Wait for the specified delay
                        await new Promise(resolve => setTimeout(resolve, retryDelay * 1000));

                        // Retry the request with incremented retry count
                        console.log(`Retrying request after waiting (attempt ${retryCount + 1}/${maxRetries})...`);
                        return await executeWithRetry(retryCount + 1, maxRetries);
                    }

                    // If it's not a 429 error, rethrow
                    throw error;
                }
            };

            // Execute the API call with retry logic
            const response = await executeWithRetry();

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
                return JSON.stringify(parsedJson);
            } catch (e) {
                return jsonStr;
            }
        } catch (error: any) {
            throw new Error(`Generation failed: ${error.message}`);
        }
    },



    /**
     * Generate JSON data based on a schema and user reference using Gemini HTTP API
     * @param selectedProperty - The selected property
     * @param subSchema - The schema for the selected property
     * @param userReference - The user reference (optional)
     * @param language_tag - The language tag
     * @param marketplace_id - The marketplace ID
     * @returns Promise with generated JSON
     */
    generateJsonWithGeminiHttp: async (
        selectedProperty: string,
        subSchema: JsonSchema,
        userReference: string,
        language_tag: string,
        marketplace_id: string,
    ): Promise<string> => {

        // Use the shared system prompt and generate user prompt
        const userPrompt = generateUserPrompt(subSchema, userReference, marketplace_id, language_tag);

        try {
            // Helper function to execute the API call with retry logic for 429 errors
            const executeWithRetry = async (retryCount = 0, maxRetries = 3) => {
                try {
                    // Use rate limiter to limit concurrent API calls
                    return await rateLimiter.execute(async () => {
                        const response = await axios.post(
                            `https://tubiemesazjz.ap-southeast-1.clawcloudrun.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent`,
                            {
                                contents: [
                                    {
                                        parts: [
                                            {
                                                text: AMAZON_LISTING_SYSTEM_PROMPT + "\n\n" + userPrompt
                                            }
                                        ]
                                    }
                                ],
                                generationConfig: {
                                    responseMimeType: "application/json",
                                    temperature: 0.1,
                                    maxOutputTokens: 4096
                                }
                            },
                            {
                                headers: {
                                    'Content-Type': 'application/json',
                                    'x-goog-api-key': process.env.OPENAI_API_KEY
                                }
                            }
                        );
                        return response.data;
                    });
                } catch (error: any) {
                    // Check if it's a 429 error (rate limit exceeded)
                    if (error.response?.status === 429 ||
                        (error.response?.data?.error?.code === 429)) {

                        // Check if we've reached the maximum number of retries
                        if (retryCount >= maxRetries) {
                            console.error(`Maximum retry attempts (${maxRetries}) reached. Giving up.`);
                            throw new Error(`Rate limit exceeded (429). Maximum retry attempts reached: ${error.message}`);
                        }

                        console.log(`Rate limit exceeded (429). Retry attempt ${retryCount + 1}/${maxRetries}`);

                        // Extract retry delay from the error response
                        let retryDelay = 60; // Default 60 seconds if not specified

                        try {
                            // Check for retry-after header
                            if (error.response?.headers['retry-after']) {
                                retryDelay = parseInt(error.response.headers['retry-after'], 10);
                            } else {
                                // Check for Google API specific retry delay format
                                const details = error.response?.data?.error?.details;
                                if (details && Array.isArray(details)) {
                                    for (const detail of details) {
                                        if (detail['@type'] === 'type.googleapis.com/google.rpc.RetryInfo' && detail.retryDelay) {
                                            // Extract seconds from the retryDelay string (format: "31s")
                                            const delayMatch = detail.retryDelay.match(/(\d+)s/);
                                            if (delayMatch && delayMatch[1]) {
                                                retryDelay = parseInt(delayMatch[1], 10);
                                            }
                                            break;
                                        }
                                    }
                                }
                            }
                        } catch (parseError) {
                            console.error('Error parsing retry delay:', parseError);
                        }

                        console.log(`Waiting for ${retryDelay} seconds before retrying...`);

                        // Wait for the specified delay
                        await new Promise(resolve => setTimeout(resolve, retryDelay * 1000));

                        // Retry the request with incremented retry count
                        console.log(`Retrying request after waiting (attempt ${retryCount + 1}/${maxRetries})...`);
                        return await executeWithRetry(retryCount + 1, maxRetries);
                    }

                    // If it's not a 429 error, rethrow
                    throw error;
                }
            };

            // Execute the API call with retry logic
            const response = await executeWithRetry();

            // Extract response text from Gemini HTTP API response structure
            if (!response.candidates ||
                !response.candidates[0] ||
                !response.candidates[0].content ||
                !response.candidates[0].content.parts ||
                !response.candidates[0].content.parts[0] ||
                !response.candidates[0].content.parts[0].text) {
                throw new Error("AI response is empty or undefined");
            }

            const responseText = response.candidates[0].content.parts[0].text;
            let jsonStr = responseText.trim();

            // Remove code fences if present
            const fenceRegex = /^```(\w*)?\s*\n?(.*?)\n?\s*```$/s;
            const match = jsonStr.match(fenceRegex);
            if (match && match[2]) {
                jsonStr = match[2].trim();
            }

            try {
                // Validate that the response is valid JSON
                const parsedJson = JSON.parse(jsonStr);
                return JSON.stringify(parsedJson);
            } catch (e) {
                // Throw error for invalid JSON instead of returning the raw string
                const error = e instanceof Error ? e : new Error(String(e));
                throw new Error(`AI response is not valid JSON: ${error.message}`);
            }
        } catch (error: any) {
            throw new Error(`Gemini HTTP generation failed: ${error.message}`);
        }
    },

    /**
     * Generate JSON data for multiple sites grouped by region using Gemini HTTP API
     * @param selectedProperty - The selected property
     * @param regionSchemas - Object mapping region names to their schemas and sites
     * @param userReference - The user reference (optional)
     * @returns Promise with generated JSON grouped by region
     */
    generateJsonByRegion: async (
        selectedProperty: string,
        regionSchemas: Record<string, { schemas: Record<string, JsonSchema>, sites: string[] }>,
        userReference: string,
    ): Promise<Record<string, Record<string, string>>> => {
        const results: Record<string, Record<string, string>> = {};

        try {
            // Process each region
            for (const [region, regionData] of Object.entries(regionSchemas)) {
                const { schemas, sites } = regionData;
                const regionResults: Record<string, string> = {};

                // Process each site individually to ensure site-specific schema compliance
                for (const site of sites) {
                    const siteSchema = schemas[site];
                    if (!siteSchema || !siteSchema.properties[selectedProperty]) {
                        console.warn(`Property ${selectedProperty} not found in schema for site ${site}`);
                        regionResults[site] = `Error: Property ${selectedProperty} not found in schema`;
                        continue;
                    }

                    // 解析模式以处理 $ref 引用
                    const processedSchema = parseSchemaProperties({
                        type: 'object',
                        properties: { [selectedProperty]: siteSchema.properties[selectedProperty] },
                        $defs: siteSchema.$defs
                    });

                    // Get the specific sub-schema for this property
                    const subSchema = processedSchema.properties[selectedProperty];


                    // Create site-specific prompt
                    const sitePrompt = `**站点特定信息生成请求**

目标站点: ${site}
区域: ${region}
属性名称: ${selectedProperty}

**该站点的Schema约束:**
\`\`\`json
${JSON.stringify(subSchema, null, 2)}
\`\`\`

${userReference ?
                            `**用户提供的参考信息:**
${userReference}

请基于用户提供的参考信息，结合该站点的具体要求生成数据。确保生成的JSON完全符合该站点的schema约束。`
                            : `请基于提供的schema约束，为该站点生成一个完整且有效的示例JSON对象。`
                        }

**生成要求:**
1. 严格遵守该站点的JSON Schema约束和数据类型要求
2. 使用该站点的主要语言生成文本内容
3. 采用该站点常用的计量单位（如需要单位转换，请自动处理）
4. 考虑该地区的文化偏好和购物习惯
5. 确保生成的数据适合该站点的Amazon marketplace
6. 如果schema中有枚举值(enum)，优先从枚举列表中选择最合适的值
7. 对于必填字段(required)，确保提供有效数据
8. 跳过\`marketplace_id\`和\`language_tag\`属性（如果存在且非必填）

请生成符合${site}站点要求的JSON数据：`;

                    try {
                        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
                        
                        // Use rate limiter to limit concurrent API calls
                        const response = await rateLimiter.execute(async () => {
                            return await ai.models.generateContent({
                                model: "gemini-2.5-flash-lite-preview-06-17",
                                contents: AMAZON_LISTING_SYSTEM_PROMPT + "\n\n" + sitePrompt,
                                config: {
                                    responseMimeType: "application/json",
                                    temperature: 0.1,
                                    maxOutputTokens: 4096,
                                    thinkingConfig: {
                                        thinkingBudget: 0,
                                    }
                                }
                            });
                        });

                        const responseText = response.text ?? '';
                        if (!responseText) {
                            throw new Error("AI response is empty or undefined");
                        }
                        let jsonStr = responseText.trim();

                        // Remove code fences if present
                        const fenceRegex = /^```(\w*)?\s*\n?(.*?)\n?\s*```$/s;
                        const match = jsonStr.match(fenceRegex);
                        if (match && match[2]) {
                            jsonStr = match[2].trim();
                        }

                        try {
                            // Validate that the response is valid JSON
                            JSON.parse(jsonStr);
                            regionResults[site] = jsonStr;
                        } catch (e) {
                            const error = e instanceof Error ? e : new Error(String(e));
                            throw new Error(`AI response is not valid JSON: ${error.message}`);
                        }

                    } catch (err: any) {
                        console.error(`Failed to generate JSON for site ${site}:`, err.message);
                        regionResults[site] = `Error: ${err.message}`;
                    }

                    // Add a small delay between site requests to avoid overwhelming the API
                    await new Promise(resolve => setTimeout(resolve, 100));
                }

                results[region] = regionResults;
            }

            return results;
        } catch (error: any) {
            throw new Error(`Region-based generation failed: ${error.message}`);
        }
    }
};
