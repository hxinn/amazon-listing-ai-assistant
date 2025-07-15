import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { amazonApi } from '../services/api';
import { aiService } from '../services/ai';
import { PropertyTemplateAttrResponse, JsonSchema } from '../types/amazon';
import { verificationStorage, StorageStats } from '../services/storage';
import { validateData, parseSchemaProperties } from '../utils/valida.js';
import { removeMarketplaceIdRecursively as utilRemoveMarketplaceId } from '../utils/dataCleaners';

// Interface for task result
interface TaskResult {
    property: string;
    site: string;
    productType: string;
    aiGeneratedData: string;
    status: 'pending' | 'processing' | 'completed' | 'failed';
    error?: string;
}

// Interface for property reference
interface PropertyReference {
    property: string;
    references: PropertyTemplateAttrResponse[];
}

// Cache for schemas
const schemaCache: Record<string, JsonSchema> = {};

const AutomatedPropertyVerification: React.FC = () => {
    // Navigation hook
    const navigate = useNavigate();
    // Reference to the log container for auto-scrolling
    const logContainerRef = useRef<HTMLDivElement>(null);
    // Reference to track processing state
    const processingRef = useRef<boolean>(false);
    // State for task progress
    const [taskProgress, setTaskProgress] = useState<number>(0);
    const [totalTasks, setTotalTasks] = useState<number>(0);
    const [currentProperty, setCurrentProperty] = useState<string>("");
    const [isProcessing, setIsProcessing] = useState<boolean>(false);
    const [isLoading, setIsLoading] = useState<boolean>(false);

    const [adapterProperties, setAdapterProperties] = useState<string[]>([]);
    const [propertyReferences, setPropertyReferences] = useState<PropertyReference[]>([]);
    const [taskResults, setTaskResults] = useState<TaskResult[]>([]);
    const [logMessages, setLogMessages] = useState<Array<{
        timestamp: string;
        type: 'info' | 'success' | 'error' | 'ai';
        message: string;
    }>>([]);
    const [storageStats, setStorageStats] = useState<StorageStats>({
        totalResults: 0,
        completedResults: 0,
        failedResults: 0,
        lastUpdated: 0
    });
    const [skippedCount, setSkippedCount] = useState<number>(0);

    // Data cleaning state
    const [isDataCleaning, setIsDataCleaning] = useState<boolean>(false);
    const [cleaningProgress, setCleaningProgress] = useState<number>(0);
    const [totalCleaningTasks, setTotalCleaningTasks] = useState<number>(0);

    // Retry failed results state
    const [isRetryingFailed, setIsRetryingFailed] = useState<boolean>(false);
    const [retryProgress, setRetryProgress] = useState<number>(0);
    const [totalRetryTasks, setTotalRetryTasks] = useState<number>(0);

    // Cache for adapter properties
    const adapterPropertiesCache = useRef<string[]>([]);

    // Initialize storage and load stats
    const initializeStorage = async () => {
        try {
            await verificationStorage.initDB();
            const stats = await verificationStorage.getStorageStats();
            setStorageStats(stats);
            addLogMessage('info', `已加载存储统计: 总计 ${stats.totalResults} 个结果, 成功 ${stats.completedResults} 个, 失败 ${stats.failedResults} 个`);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            addLogMessage('error', `初始化存储失败: ${errorMessage}`);
        }
    };

    // Fetch adapter properties from API with retry mechanism
    const fetchAdapterProperties = async (retryCount = 0, maxRetries = 3) => {
        try {
            // Check cache first
            if (adapterPropertiesCache.current.length > 0) {
                addLogMessage('info', 'Using cached adapter properties...');
                setAdapterProperties(adapterPropertiesCache.current);
                setTotalTasks(adapterPropertiesCache.current.length);

                if (adapterPropertiesCache.current.length > 0) {
                    setCurrentProperty(adapterPropertiesCache.current[0]);
                    addLogMessage('info', `Current property set to '${adapterPropertiesCache.current[0]}'.`);
                }

                return;
            }

            setIsLoading(true);
            const properties = await amazonApi.getAdapterProperties();

            // Update cache and state
            adapterPropertiesCache.current = properties;
            setAdapterProperties(properties);
            setTotalTasks(properties.length);

            // If properties are available, set the current property to the first one
            if (properties.length > 0) {
                setCurrentProperty(properties[0]);
                addLogMessage('info', `Current property set to '${properties[0]}'.`);
            }
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            addLogMessage('error', `Failed to fetch adapter properties: ${errorMessage}`);

            // Retry logic
            if (retryCount < maxRetries) {
                const delay = Math.pow(2, retryCount) * 1000; // Exponential backoff
                addLogMessage('info', `Retrying in ${delay / 1000} seconds... (Attempt ${retryCount + 1}/${maxRetries})`);

                setTimeout(() => {
                    fetchAdapterProperties(retryCount + 1, maxRetries);
                }, delay);
            }
        } finally {
            setIsLoading(false);
        }
    };

    // Initialize log messages and fetch adapter properties
    useEffect(() => {
        const initialLogs: Array<{
            timestamp: string;
            type: 'info' | 'success' | 'error' | 'ai';
            message: string;
        }> = [];
        setLogMessages(initialLogs);

        // Fetch adapter properties when component mounts
        fetchAdapterProperties();

        // Initialize storage and load stats
        initializeStorage();
    }, []);

    // Auto-scroll log container to bottom when new messages are added
    useEffect(() => {
        if (logContainerRef.current) {
            logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
        }
    }, [logMessages]);

    // Get reference properties for a specific attribute
    const getReferenceProperties = async (attributeName: string, retryCount = 0, maxRetries = 3) => {
        try {
            const references = await amazonApi.searchProductTypeTemplateJsonAttr(attributeName);
            return references;
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            addLogMessage('error', `Failed to fetch reference properties: ${errorMessage}`);

            // Retry logic
            if (retryCount < maxRetries) {
                const delay = Math.pow(2, retryCount) * 1000; // Exponential backoff
                addLogMessage('info', `Retrying in ${delay / 1000} seconds... (Attempt ${retryCount + 1}/${maxRetries})`);

                return new Promise<PropertyTemplateAttrResponse[]>((resolve) => {
                    setTimeout(async () => {
                        const result = await getReferenceProperties(attributeName, retryCount + 1, maxRetries);
                        resolve(result);
                    }, delay);
                });
            }

            return [];
        }
    };

    // Find product types for a specific property
    const findProductTypes = async (property: string, retryCount = 0, maxRetries = 3) => {
        try {
            const productTypes = await amazonApi.findProductTypesByProperty(property);
            return productTypes;
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            addLogMessage('error', `Failed to find product types: ${errorMessage}`);

            // Retry logic
            if (retryCount < maxRetries) {
                const delay = Math.pow(2, retryCount) * 1000; // Exponential backoff
                addLogMessage('info', `Retrying in ${delay / 1000} seconds... (Attempt ${retryCount + 1}/${maxRetries})`);

                return new Promise<Record<string, string>>((resolve) => {
                    setTimeout(async () => {
                        const result = await findProductTypes(property, retryCount + 1, maxRetries);
                        resolve(result);
                    }, delay);
                });
            }

            return {};
        }
    };

    // Get schema for a specific site and product type
    const getSchema = async (site: string, productType: string, retryCount = 0, maxRetries = 3) => {
        const cacheKey = `${site}-${productType}`;

        // Check cache first
        if (schemaCache[cacheKey]) {
            return schemaCache[cacheKey];
        }

        try {
            const schemaUrl = await amazonApi.getSchemaUrl(site, productType);

            const schema = await amazonApi.fetchSchema(schemaUrl);

            // Cache the schema
            schemaCache[cacheKey] = schema;

            return schema;
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            addLogMessage('error', `Failed to get schema: ${errorMessage}`);

            // Retry logic
            if (retryCount < maxRetries) {
                const delay = Math.pow(2, retryCount) * 1000; // Exponential backoff
                addLogMessage('info', `Retrying in ${delay / 1000} seconds... (Attempt ${retryCount + 1}/${maxRetries})`);

                return new Promise<JsonSchema>((resolve) => {
                    setTimeout(async () => {
                        const result = await getSchema(site, productType, retryCount + 1, maxRetries);
                        resolve(result);
                    }, delay);
                });
            }

            throw new Error(`Failed to get schema after ${maxRetries} attempts`);
        }
    };

    // Process a single property
    const processProperty = async (property: string, index: number) => {
        try {
            setCurrentProperty(property);
            addLogMessage('info', `[Task ${index + 1}/${adapterProperties.length}] Processing property '${property}'...`);

            // Step 1: Get reference properties
            const references = await getReferenceProperties(property);
            setPropertyReferences(prev => [...prev, { property, references }]);

            // Step 2: Find sites and product types
            const siteProductTypes = await findProductTypes(property);
            const sites = Object.keys(siteProductTypes);

            if (sites.length === 0) {
                addLogMessage('error', `No sites found for property '${property}'.`);
                return;
            }

            // Step 3: Check for existing results and create subtasks for each site and product type
            const subtasks: Promise<TaskResult>[] = [];
            let skippedSubtasks = 0;

            for (const site of sites) {
                const productType = siteProductTypes[site];

                // Check if valid result already exists for this site+property combination
                const hasValidResult = await verificationStorage.hasResultBySiteProperty(site, property);

                if (hasValidResult) {
                    skippedSubtasks++;

                    // Try to load existing result for this specific site-productType-property
                    const storedResult = await verificationStorage.getResult(site, productType, property);
                    if (storedResult) {
                        const taskResult: TaskResult = {
                            property: storedResult.property,
                            site: storedResult.site,
                            productType: storedResult.productType,
                            aiGeneratedData: storedResult.aiGeneratedData,
                            status: storedResult.status,
                            error: storedResult.error
                        };
                        setTaskResults(prev => [...prev, taskResult]);
                    } else {
                        // If specific combination doesn't exist, get any completed result for this site+property
                        const sitePropertyResults = await verificationStorage.getResultsBySiteProperty(site, property);
                        const completedResult = sitePropertyResults.find(r => r.status === 'completed');
                        if (completedResult) {
                            const taskResult: TaskResult = {
                                property: completedResult.property,
                                site: completedResult.site,
                                productType: productType, // Use current productType but show the completed result
                                aiGeneratedData: completedResult.aiGeneratedData,
                                status: completedResult.status,
                                error: completedResult.error
                            };
                            setTaskResults(prev => [...prev, taskResult]);
                        }
                    }
                    continue;
                }

                // Check if there are any failed results that need to be retried
                const hasAnyResult = await verificationStorage.hasAnyResultBySiteProperty(site, property);
                if (hasAnyResult) {
                   await verificationStorage.getResultsBySiteProperty(site, property);
                }

                subtasks.push((async () => {
                    try {

                        // Get schema
                        const schema = await getSchema(site, productType);

                        // Validate property exists in schema
                        if (!schema.properties[property]) {
                            addLogMessage('error', `Property '${property}' not found in schema for ${site}-${productType}.`);
                            return {
                                property,
                                site,
                                productType,
                                aiGeneratedData: '',
                                status: 'failed' as const,
                                error: `Property not found in schema`
                            };
                        }

                        // Get property schema
                        const propertySchema = schema.properties[property];
                        const preferredMarkets = ['us', 'uk'];
                        const reference = references.find(ref =>
                            ref?.site && preferredMarkets.some(market =>
                                ref.site.toLowerCase().includes(market))
                        ) || references[0];


                        const referenceValue = reference ? reference.attributeValue : '';

                        // Generate AI data
                        const language_tag = schema.$defs.language_tag.default;
                        const marketplace_id = schema.$defs.marketplace_id.default;

                        const aiData = await aiService.generateJson(
                            property,
                            propertySchema,
                            referenceValue,
                            language_tag,
                            marketplace_id
                        );
                        addLogMessage('success', `AI data generated for ${site}-${productType}-${property}.\n ${aiData}`);

                        // 使用Ajv验证AI生成的数据
                         let taskResult: TaskResult;

                        try {
                            // 解析模式以处理 $ref 引用
                            const processedSchema = parseSchemaProperties({
                                type: 'object',
                                properties: { [property]: propertySchema },
                                $defs: schema.$defs
                            });

                            // 创建验证数据对象
                            const aiDataArray = JSON.parse(aiData);
                            const dataToValidate = { [property]: aiDataArray };
                            // 验证AI数据
                            const validationErrors = validateData(dataToValidate, processedSchema);

                            if (validationErrors && validationErrors.length > 0) {
                                // 验证失败，记录错误详情
                                const errorDetails = validationErrors.map(error =>
                                    `${error.instancePath || 'root'}: ${error.message} (keyword: ${error.keyword})`
                                ).join('; ');

                                const errorMessage = `AI数据验证失败: ${errorDetails}`;
                                addLogMessage('error', `${site}-${productType}-${property} 验证失败: ${errorMessage}`);

                                taskResult = {
                                    property,
                                    site,
                                    productType,
                                    aiGeneratedData: JSON.stringify(aiData),
                                    status: 'failed' as const,
                                    error: errorMessage
                                };
                            } else {
                                // 验证成功

                                taskResult = {
                                    property,
                                    site,
                                    productType,
                                    aiGeneratedData: JSON.stringify(aiData),
                                    status: 'completed' as const
                                };
                            }
                        } catch (validationError) {
                            // 验证过程中出现异常
                            const validationErrorMessage = validationError instanceof Error ? validationError.message : 'Unknown validation error';
                            const errorMessage = `验证过程异常: ${validationErrorMessage}`;
                            addLogMessage('error', `${site}-${productType}-${property} 验证异常: ${errorMessage}`);

                            taskResult = {
                                property,
                                site,
                                productType,
                                aiGeneratedData: JSON.stringify(aiData),
                                status: 'failed' as const,
                                error: errorMessage
                            };
                        }

                        // Save to storage
                        try {
                            // 确保状态值是存储服务支持的类型
                            const storageStatus: 'completed' | 'failed' =
                                taskResult.status === 'completed' ? 'completed' : 'failed';

                            await verificationStorage.saveResult({
                                property,
                                site,
                                productType,
                                aiGeneratedData: taskResult.aiGeneratedData,
                                status: storageStatus,
                                error: taskResult.error,
                                language_tag,
                                marketplace_id
                            });
                        } catch (storageError) {
                            const storageErrorMessage = storageError instanceof Error ? storageError.message : 'Unknown storage error';
                            addLogMessage('error', `保存验证结果失败: ${storageErrorMessage}`);
                        }

                        return taskResult;
                    } catch (error) {
                        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                        addLogMessage('error', `Subtask failed for ${site}-${productType}-${property}: ${errorMessage}`);

                        const failedResult: TaskResult = {
                            property,
                            site,
                            productType,
                            aiGeneratedData: '',
                            status: 'failed' as const,
                            error: errorMessage
                        };

                        // Save failed result to storage
                        try {
                            await verificationStorage.saveResult({
                                property,
                                site,
                                productType,
                                aiGeneratedData: '',
                                status: 'failed',
                                error: errorMessage
                            });
                        } catch (storageError) {
                            const storageErrorMessage = storageError instanceof Error ? storageError.message : 'Unknown storage error';
                            addLogMessage('error', `保存失败结果失败: ${storageErrorMessage}`);
                        }

                        return failedResult;
                    }
                })());
            }

            // Process subtasks with concurrency limit
            const concurrencyLimit = 3;
            const results: TaskResult[] = [];

            for (let i = 0; i < subtasks.length; i += concurrencyLimit) {
                const batch = subtasks.slice(i, i + concurrencyLimit);
                const batchResults = await Promise.all(batch);
                results.push(...batchResults);

                // Update task results
                setTaskResults(prev => [...prev, ...batchResults]);

                // Check if processing should continue
                if (!processingRef.current) {
                    addLogMessage('info', `Task processing paused during subtasks for '${property}'.`);
                    return false;
                }
            }

            // Update skipped count
            setSkippedCount(prev => prev + skippedSubtasks);

            // Update storage stats
            try {
                const updatedStats = await verificationStorage.getStorageStats();
                setStorageStats(updatedStats);
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                addLogMessage('error', `更新存储统计失败: ${errorMessage}`);
            }

            addLogMessage('success', `[Task ${index + 1}/${adapterProperties.length}] Property '${property}' processed with ${results.length} subtasks (${skippedSubtasks} skipped).`);
            return true;
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            addLogMessage('error', `Failed to process property '${property}': ${errorMessage}`);
            return false;
        }
    };

    // Handle start task
    const handleStartTask = async () => {
        if (adapterProperties.length === 0) {
            addLogMessage('error', 'No adapter properties available to process.');
            return;
        }

        setIsProcessing(true);
        processingRef.current = true;
        setTaskProgress(0);
        setTaskResults([]);
        setPropertyReferences([]);
        setSkippedCount(0);
        addLogMessage('info', 'Starting task processing...');

        // Process properties one by one
        let currentIndex = 0;

        while (currentIndex < adapterProperties.length && processingRef.current) {
            const property = adapterProperties[currentIndex];
            const success = await processProperty(property, currentIndex);

            if (success) {
                setTaskProgress(currentIndex + 1);
                currentIndex++;
            } else if (processingRef.current) {
                // If processing failed but we're still running, try the next property
                addLogMessage('info', `Skipping to next property after failure...`);
                setTaskProgress(currentIndex + 1);
                currentIndex++;
            } else {
                // If processing was paused, break the loop
                break;
            }
        }

        if (processingRef.current) {
            setIsProcessing(false);
            processingRef.current = false;

            // 统计验证结果
            const completedCount = taskResults.filter(task => task.status === 'completed').length;
            const failedCount = taskResults.filter(task => task.status === 'failed').length;

            addLogMessage('success', `所有验证任务已完成！总计处理 ${taskResults.length} 个任务，验证通过 ${completedCount} 个，验证失败 ${failedCount} 个，跳过 ${skippedCount} 个`);
        }
    };

    // Handle pause task
    const handlePauseTask = () => {
        setIsProcessing(false);
        processingRef.current = false;
        addLogMessage('info', 'Task processing paused.');
    };
    // 包装工具函数，添加组件特定的日志记录
    const removeMarketplaceIdRecursively = (data: any): { cleaned: any; removed: boolean } => {
        // 创建一个监听器来捕获控制台日志
        const originalConsoleInfo = console.info;
        let logMessages: string[] = [];

        console.info = (message: string) => {
            logMessages.push(message);
        };

        try {
            // 调用工具函数
            const result = utilRemoveMarketplaceId(data);

            // 将捕获的日志添加到组件的日志中
            logMessages.forEach(message => {
                addLogMessage('info', message);
            });

            return result;
        } finally {
            // 恢复原始的控制台函数
            console.info = originalConsoleInfo;
        }
    };

    // Enhanced JSON compression function that handles all cases with array validation
    const ensureCompressedJson = (jsonString: string): {
        compressed: string;
        wasModified: boolean;
        hadMarketplaceId: boolean;
        processingMethod: 'json_parsed' | 'string_processed' | 'already_compressed';
        isValidArray: boolean;
        validationError?: string;
    } => {
        if (!jsonString || jsonString.trim() === '') {
            return {
                compressed: '',
                wasModified: false,
                hadMarketplaceId: false,
                processingMethod: 'already_compressed',
                isValidArray: false,
                validationError: 'Empty data'
            };
        }

        let finalData;
        let hadMarketplaceId = false;
        let processingMethod: 'json_parsed' | 'string_processed' | 'already_compressed' = 'already_compressed';
        let isValidArray = false;
        let validationError: string | undefined;
        let wasModified = false;

        // 步骤1: 处理转义字符串问题
        let processedString = jsonString.trim();

        // 检查是否是转义的JSON字符串
        const hasEscapedQuotes = processedString.includes('\\"');
        // 特殊情况1: 整个字符串被转义引号包围，如 "\"[{\"value\":\"blower\"}]\""
        if (processedString.startsWith('\\"') && processedString.endsWith('\\"')) {
            // 移除开头和结尾的转义引号，然后反转义内部内容
            processedString = processedString.slice(2, -2); // 移除开头和结尾的 \"
            processedString = processedString.replace(/\\"/g, '"'); // 反转义内部的引号
            wasModified = true;
            addLogMessage('info', '检测到被转义引号包围的JSON字符串，已进行反转义处理');
        }
        // 特殊情况2: 检查是否是纯转义的JSON字符串（如 [{\"value\":\"blower\"}]）
        else if (hasEscapedQuotes) {
            // 统计转义引号和正常引号的数量
            const escapedQuoteCount = (processedString.match(/\\"/g) || []).length;
            // 使用更简单的方法统计正常引号：先替换所有转义引号，然后统计剩余的引号
            const tempString = processedString.replace(/\\"/g, '');
            const normalQuoteCount = (tempString.match(/"/g) || []).length;

            // 如果转义引号数量大于等于正常引号数量，则认为需要反转义
            if (escapedQuoteCount >= normalQuoteCount) {
                const beforeUnescape = processedString;
                processedString = processedString.replace(/\\"/g, '"');
                wasModified = true;
                addLogMessage('info', `检测到转义的JSON字符串，已进行反转义处理 (转义引号:${escapedQuoteCount}, 正常引号:${normalQuoteCount})`);
            }
        }

        // 步骤2: 基础格式清理 - 移除多余空格和换行符
        const originalLength = processedString.length;
        processedString = processedString
            .replace(/\s+/g, ' ')  // 将多个空格替换为单个空格
            .replace(/\s*:\s*/g, ':')  // 移除冒号周围的空格
            .replace(/\s*,\s*/g, ',')  // 移除逗号周围的空格
            .replace(/\s*\[\s*/g, '[')  // 移除数组开始括号后的空格
            .replace(/\s*\]\s*/g, ']')  // 移除数组结束括号前的空格
            .replace(/\s*\{\s*/g, '{')  // 移除对象开始括号后的空格
            .replace(/\s*\}\s*/g, '}')  // 移除对象结束括号前的空格
            .trim();

        if (processedString.length !== originalLength) {
            wasModified = true;
        }

        try {
            // 步骤3: 尝试解析JSON
            let jsonData;

            // 先尝试直接解析
            try {
                jsonData = JSON.parse(processedString);
                processingMethod = 'json_parsed';
            } catch (firstParseError) {
                // 如果直接解析失败，尝试处理可能的多JSON对象问题
                const errorMessage = firstParseError instanceof Error ? firstParseError.message : 'Unknown error';
                // 检查是否是多个JSON对象连在一起的情况
                if (errorMessage.includes('Unexpected non-whitespace character after JSON')) {
                    // 尝试找到第一个完整的JSON对象
                    let bracketCount = 0;
                    let firstJsonEnd = -1;
                    let inString = false;
                    let escapeNext = false;
                    let foundStart = false;

                    // 首先找到第一个有效的JSON开始字符 ([ 或 {)
                    let startPos = 0;
                    for (let i = 0; i < processedString.length; i++) {
                        const char = processedString[i];
                        if (char === '[' || char === '{') {
                            startPos = i;
                            foundStart = true;
                            break;
                        }
                    }

                    if (!foundStart) {
                        throw firstParseError; // 没有找到有效的JSON开始字符
                    }

                    // 从找到的开始位置开始解析
                    for (let i = startPos; i < processedString.length; i++) {
                        const char = processedString[i];

                        if (escapeNext) {
                            escapeNext = false;
                            continue;
                        }

                        if (char === '\\') {
                            escapeNext = true;
                            continue;
                        }

                        if (char === '"') {
                            inString = !inString;
                            continue;
                        }

                        if (!inString) {
                            if (char === '[' || char === '{') {
                                bracketCount++;
                            } else if (char === ']' || char === '}') {
                                bracketCount--;
                                if (bracketCount === 0) {
                                    firstJsonEnd = i;
                                    break;
                                }
                            }
                        }
                    }

                    if (firstJsonEnd > -1) {
                        const firstJsonString = processedString.substring(startPos, firstJsonEnd + 1);
                        addLogMessage('info', `提取第一个JSON对象: ${firstJsonString.substring(0, 100)}...`);

                        try {
                            jsonData = JSON.parse(firstJsonString);
                            processingMethod = 'json_parsed';
                            wasModified = true;
                            addLogMessage('info', '成功解析第一个JSON对象');
                        } catch (extractParseError) {
                            // 尝试直接使用正则表达式匹配有效的JSON数组
                            // 使用非贪婪匹配来避免匹配过多内容
                            const arrayMatch = processedString.match(/\[.*?\]/s);
                            if (arrayMatch && arrayMatch[0]) {
                                try {
                                    jsonData = JSON.parse(arrayMatch[0]);
                                    processingMethod = 'json_parsed';
                                    wasModified = true;
                                    addLogMessage('info', '使用正则表达式成功提取JSON数组');
                                } catch (regexError) {
                                    throw firstParseError; // 如果正则提取的JSON也无法解析，抛出原始错误
                                }
                            } else {
                                throw firstParseError; // 如果提取的JSON也无法解析，抛出原始错误
                            }
                        }
                    } else {
                        // 尝试直接使用正则表达式匹配有效的JSON数组
                        // 使用非贪婪匹配来避免匹配过多内容
                        const arrayMatch = processedString.match(/\[.*?\]/s);
                        if (arrayMatch && arrayMatch[0]) {
                            try {
                                jsonData = JSON.parse(arrayMatch[0]);
                                processingMethod = 'json_parsed';
                                wasModified = true;
                                addLogMessage('info', '使用正则表达式成功提取JSON数组');
                            } catch (regexError) {
                                throw firstParseError; // 如果正则提取的JSON也无法解析，抛出原始错误
                            }
                        } else {
                            throw firstParseError; // 无法找到完整的JSON对象，抛出原始错误
                        }
                    }
                } else {
                    throw firstParseError; // 其他类型的解析错误，直接抛出
                }
            }

            // 检查是否是字符串（可能需要二次解析）
            if (typeof jsonData === 'string') {
                try {
                    jsonData = JSON.parse(jsonData);
                    wasModified = true; // 需要二次解析说明格式不标准
                } catch (secondParseError) {
                    // 二次解析失败，但第一次解析成功，保持为字符串
                    addLogMessage('info', `二次JSON解析失败，保持为字符串: ${secondParseError instanceof Error ? secondParseError.message : 'Unknown error'}`);
                }
            }

            // 步骤4: 验证是否为数组
            if (Array.isArray(jsonData)) {
                isValidArray = true;

                // 步骤5: 移除marketplace_id
                const cleaningResult = removeMarketplaceIdRecursively(jsonData);
                finalData = cleaningResult.cleaned;
                hadMarketplaceId = cleaningResult.removed;

                if (hadMarketplaceId) {
                    wasModified = true;
                }
            } else {
                isValidArray = false;
                validationError = `Expected array but got ${typeof jsonData}: ${Array.isArray(jsonData) ? 'array' : typeof jsonData}`;
                // 对于非数组数据，仍然尝试移除marketplace_id但标记为验证失败
                const cleaningResult = removeMarketplaceIdRecursively(jsonData);
                finalData = cleaningResult.cleaned;
                hadMarketplaceId = cleaningResult.removed;

                if (hadMarketplaceId) {
                    wasModified = true;
                }
            }

        } catch (parseError) {
            // JSON解析失败，尝试字符串级别的处理
            processingMethod = 'string_processed';
            isValidArray = false;
            const errorMessage = parseError instanceof Error ? parseError.message : 'Unknown error';
            validationError = `JSON parse failed: ${errorMessage}`;

            // 添加详细的调试信息
            addLogMessage('error', `JSON解析完全失败: ${errorMessage}`);
            addLogMessage('info', `问题字符串前100字符: ${processedString.substring(0, 100)}...`);
            addLogMessage('info', `字符串长度: ${processedString.length}`);

            // 尝试更多的修复策略
            let fixedString = processedString;

            // 策略1: 如果包含marketplace_id，尝试移除
            if (fixedString.includes('"marketplace_id"')) {
                const beforeRemoval = fixedString;
                fixedString = fixedString
                    .replace(/"marketplace_id"\s*:\s*"[^"]*"\s*,?\s*/g, '')
                    .replace(/,\s*}/g, '}') // 清理可能留下的多余逗号
                    .replace(/{\s*,/g, '{') // 清理开头的多余逗号
                    .replace(/,\s*]/g, ']') // 清理数组中的多余逗号
                    .replace(/\[\s*,/g, '['); // 清理数组开头的多余逗号

                hadMarketplaceId = beforeRemoval !== fixedString;
                if (hadMarketplaceId) {
                    wasModified = true;
                    addLogMessage('info', '字符串级别移除了marketplace_id');
                }
            }

            // 策略2: 尝试修复常见的JSON格式问题
            // 移除可能的BOM字符
            fixedString = fixedString.replace(/^\uFEFF/, '');

            // 移除可能的控制字符
            fixedString = fixedString.replace(/[\x00-\x1F\x7F]/g, '');

            // 尝试修复可能的尾随逗号
            fixedString = fixedString.replace(/,(\s*[}\]])/g, '$1');

            if (fixedString !== processedString) {
                wasModified = true;
                addLogMessage('info', '应用了字符串级别的修复策略');

                // 尝试再次解析修复后的字符串
                try {
                    const repairedJson = JSON.parse(fixedString);
                    addLogMessage('success', '修复后的字符串成功解析为JSON');

                    // 如果成功解析，更新相关变量
                    if (Array.isArray(repairedJson)) {
                        isValidArray = true;
                        validationError = undefined;

                        // 移除marketplace_id
                        const cleaningResult = removeMarketplaceIdRecursively(repairedJson);
                        finalData = cleaningResult.cleaned;
                        if (cleaningResult.removed) {
                            hadMarketplaceId = true;
                            wasModified = true;
                        }
                    } else {
                        finalData = repairedJson;
                        validationError = `Repaired JSON is not an array: ${typeof repairedJson}`;
                    }
                } catch (repairError) {
                    addLogMessage('error', `修复后仍无法解析: ${repairError instanceof Error ? repairError.message : 'Unknown error'}`);
                    finalData = fixedString;
                }
            } else {
                finalData = fixedString;
            }
        }

        // 步骤6: 确保最终结果是压缩的JSON字符串
        let compressed: string;
        if (typeof finalData === 'string') {
            compressed = finalData;
        } else {
            // 使用JSON.stringify确保压缩格式，不添加额外空格
            compressed = JSON.stringify(finalData);
            // 如果原始数据不是字符串，说明进行了JSON处理
            if (typeof finalData !== 'string') {
                wasModified = true;
            }
        }

        // 最终检查是否有变化
        if (compressed !== jsonString) {
            wasModified = true;
        }

        return {
            compressed,
            wasModified,
            hadMarketplaceId,
            processingMethod,
            isValidArray,
            validationError
        };
    };

    // Data cleaning functions
    const handleDataCleaning = async () => {
        setIsDataCleaning(true);
        setCleaningProgress(0);
        setTotalCleaningTasks(0);
        addLogMessage('info', '开始数据清洗任务...');

        try {
            // Step 1: Remove duplicate site+property records (keep the latest one)
            addLogMessage('info', '检查并移除重复的站点+属性记录...');
            const duplicateRemovalResult = await verificationStorage.removeDuplicateSitePropertyRecords();

            if (duplicateRemovalResult.totalDuplicateGroups > 0) {
                addLogMessage('success', `找到 ${duplicateRemovalResult.totalDuplicateGroups} 组重复数据，移除了 ${duplicateRemovalResult.totalRecordsRemoved} 条旧记录`);

                // Log details of what was removed
                duplicateRemovalResult.processedGroups.forEach(group => {
                    const keptRecord = group.kept;
                    const removedIds = group.removed.map(r => r.id).join(', ');
                    addLogMessage('info', `${group.key}: 保留 ${keptRecord.id} (${new Date(keptRecord.timestamp).toLocaleString()}), 移除 ${group.removed.length} 条: ${removedIds}`);
                });
            } else {
                addLogMessage('info', '没有发现重复的站点+属性记录');
            }

            // Step 2: Load all verification results (after duplicate removal)
            addLogMessage('info', '加载存储的验证结果数据...');
            const allResults = await verificationStorage.getAllResults();
            addLogMessage('info', `加载了 ${allResults.length} 个验证结果`);

            // Step 3: 处理所有验证结果数据（不过滤失败数据）
            addLogMessage('info', '准备处理所有验证结果数据...');
            const resultsToProcess = allResults; // 处理所有结果，不过滤失败数据
            addLogMessage('info', `将处理 ${resultsToProcess.length} 个验证结果（包括成功和失败的数据）`);

            if (resultsToProcess.length === 0) {
                addLogMessage('error', '没有找到任何验证结果，清洗任务终止');
                setIsDataCleaning(false);
                return;
            }

            setTotalCleaningTasks(resultsToProcess.length);
            let processedCount = 0;
            let totalCompressed = 0;
            let totalMarketplaceIdRemoved = 0;
            let jsonParsedCount = 0;
            let stringProcessedCount = 0;
            let alreadyCompressedCount = 0;
            let validationFailedCount = 0;
            let markedAsFailedCount = 0;
            let successfulDataProcessedCount = 0;
            let failedDataProcessedCount = 0;
            let statusUpdatedToSuccessCount = 0;

            // Process results in batches
            const batchSize = 10;
            for (let i = 0; i < resultsToProcess.length; i += batchSize) {
                const batch = resultsToProcess.slice(i, i + batchSize);

                await Promise.all(batch.map(async (result) => {
                    try {
                        // 记录原始状态
                        const originalStatus = result.status;
                        if (originalStatus === 'completed') {
                            successfulDataProcessedCount++;
                        } else if (originalStatus === 'failed') {
                            failedDataProcessedCount++;
                        }

                        // Step 4: Get aiGeneratedData value
                        const aiGeneratedData = result.aiGeneratedData;
                        if (!aiGeneratedData) {
                            addLogMessage('error', `${result.id}: aiGeneratedData 为空，跳过 (原状态: ${originalStatus})`);
                            processedCount++;
                            setCleaningProgress(processedCount);
                            return;
                        }



                        const compressionResult = ensureCompressedJson(aiGeneratedData);
                        const { compressed, wasModified, hadMarketplaceId, processingMethod, isValidArray, validationError } = compressionResult;

                        // Update statistics based on processing method
                        switch (processingMethod) {
                            case 'json_parsed':
                                jsonParsedCount++;
                                break;
                            case 'string_processed':
                                stringProcessedCount++;
                                break;
                            case 'already_compressed':
                                alreadyCompressedCount++;
                                break;
                        }

                        if (hadMarketplaceId) {
                            totalMarketplaceIdRemoved++;
                        }

                        // Check if validation failed (not a valid array)
                        if (!isValidArray) {
                            validationFailedCount++;
                            addLogMessage('error', `${result.id}: 数组验证失败 - ${validationError}`);

                            // Mark as failed in storage
                            await verificationStorage.updateResult(
                                result.site,
                                result.productType,
                                result.property,
                                {
                                    status: 'failed',
                                    error: `Array validation failed: ${validationError}`,
                                    aiGeneratedData: compressed // Still save the cleaned data for reference
                                }
                            );
                            markedAsFailedCount++;
                        } else {
                            // Valid array - proceed with normal processing
                            let needsUpdate = wasModified;
                            let updateData: any = {};

                            // 如果数据被修改，添加清洗后的数据
                            if (wasModified) {
                                updateData.aiGeneratedData = compressed;
                                totalCompressed++;
                            }

                            // 如果原始状态不是成功，需要更新状态为成功
                            if (originalStatus !== 'completed') {
                                updateData.status = 'completed';
                                updateData.error = undefined; // 清除错误信息
                                needsUpdate = true;
                                statusUpdatedToSuccessCount++;
                            }

                            // 执行更新
                            if (needsUpdate) {
                                await verificationStorage.updateResult(
                                    result.site,
                                    result.productType,
                                    result.property,
                                    updateData
                                );
                            } 
                        }

                        processedCount++;
                        setCleaningProgress(processedCount);

                    } catch (error) {
                        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                        addLogMessage('error', `${result.id}: 清洗失败 - ${errorMessage}`);
                        processedCount++;
                        setCleaningProgress(processedCount);
                    }
                }));

                // Add a small delay between batches to prevent overwhelming the system
                if (i + batchSize < resultsToProcess.length) {
                    await new Promise(resolve => setTimeout(resolve, 100));
                }
            }

            // Update storage stats
            const updatedStats = await verificationStorage.getStorageStats();
            setStorageStats(updatedStats);

            addLogMessage('success',
                `数据清洗完成！移除了 ${duplicateRemovalResult.totalRecordsRemoved} 条重复记录，` +
                `处理了 ${processedCount} 个结果（成功数据 ${successfulDataProcessedCount} 个，失败数据 ${failedDataProcessedCount} 个），` +
                `标准化了 ${totalCompressed} 个数据，移除marketplace_id ${totalMarketplaceIdRemoved} 次，` +
                `验证失败 ${validationFailedCount} 个（已标记为失败 ${markedAsFailedCount} 个），` +
                `状态更新为成功 ${statusUpdatedToSuccessCount} 个。` +
                `处理方式统计: JSON解析 ${jsonParsedCount}，字符串处理 ${stringProcessedCount}，已标准化 ${alreadyCompressedCount}。` +
                `数据格式已标准化为无转义的压缩JSON字符串。`
            );

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            addLogMessage('error', `数据清洗失败: ${errorMessage}`);
        } finally {
            setIsDataCleaning(false);
        }
    };

    // Retry failed verification results
    const handleRetryFailedResults = async () => {
        setIsRetryingFailed(true);
        setRetryProgress(0);
        setTotalRetryTasks(0);
        addLogMessage('info', '开始重新验证失败的数据...');

        try {
            // Step 1: Get all failed results
            addLogMessage('info', '获取所有失败的验证结果...');
            const failedResults = await verificationStorage.getFailedResults();
            addLogMessage('info', `找到 ${failedResults.length} 个失败的验证结果`);

            if (failedResults.length === 0) {
                addLogMessage('info', '没有找到失败的验证结果，无需重新验证');
                setIsRetryingFailed(false);
                return;
            }

            setTotalRetryTasks(failedResults.length);
            let processedCount = 0;
            let successCount = 0;
            let stillFailedCount = 0;

            // Process failed results in batches
            const batchSize = 3; // Limited concurrency for retries
            for (let i = 0; i < failedResults.length; i += batchSize) {
                const batch = failedResults.slice(i, i + batchSize);

                await Promise.all(batch.map(async (failedResult) => {
                    try {
                        addLogMessage('info', `重新验证: ${failedResult.site}-${failedResult.productType}-${failedResult.property}`);

                        // Get schema for this failed result
                        const schema = await getSchema(failedResult.site, failedResult.productType);

                        // Validate property exists in schema
                        if (!schema.properties[failedResult.property]) {
                            addLogMessage('error', `属性 '${failedResult.property}' 在 ${failedResult.site}-${failedResult.productType} 的架构中不存在`);
                            stillFailedCount++;
                            processedCount++;
                            setRetryProgress(processedCount);
                            return;
                        }

                        // Get property schema
                        const propertySchema = schema.properties[failedResult.property];

                        // Get reference properties for this attribute
                        const references = await getReferenceProperties(failedResult.property);
                        const preferredMarkets = ['us', 'uk'];
                        const reference = references.find(ref =>
                            ref?.site && preferredMarkets.some(market =>
                                ref.site.toLowerCase().includes(market))
                        ) || references[0];

                        const referenceValue = reference ? reference.attributeValue : '';

                        // Generate AI data
                        const language_tag = schema.$defs.language_tag.default;
                        const marketplace_id = schema.$defs.marketplace_id.default;

                        const aiData = await aiService.generateJson(
                            failedResult.property,
                            propertySchema,
                            referenceValue,
                            language_tag,
                            marketplace_id
                        );

                        addLogMessage('success', `AI数据重新生成成功: ${failedResult.site}-${failedResult.productType}-${failedResult.property}: ${JSON.stringify(aiData)}`);

                        let finalStatus: 'completed' | 'failed' = 'completed';
                        let finalError: string | undefined = undefined;

                        try {
                            // 解析模式以处理 $ref 引用
                            const processedSchema = parseSchemaProperties({
                                type: 'object',
                                properties: { [failedResult.property]: propertySchema },
                                $defs: schema.$defs
                            });

                            // 创建验证数据对象
                            const property = failedResult.property;
                            const aiDataArray = JSON.parse(aiData);
                            const dataToValidate = { [property]: aiDataArray };
                            // 验证AI数据
                            const validationErrors = validateData(dataToValidate, processedSchema);

                            if (validationErrors && validationErrors.length > 0) {
                                // 验证失败，记录错误详情
                                const errorDetails = validationErrors.map(error =>
                                    `${error.instancePath || 'root'}: ${error.message} (keyword: ${error.keyword})`
                                ).join('; ');

                                finalError = `重试验证失败: ${errorDetails}`;
                                finalStatus = 'failed';
                                addLogMessage('error', `${failedResult.site}-${failedResult.productType}-${failedResult.property} 重试验证失败: ${finalError}`);
                            } else {
                                // 验证成功
                                addLogMessage('success', `${failedResult.site}-${failedResult.productType}-${failedResult.property} 重试验证通过`);
                            }
                        } catch (validationError) {
                            // 验证过程中出现异常
                            const validationErrorMessage = validationError instanceof Error ? validationError.message : 'Unknown validation error';
                            finalError = `重试验证异常: ${validationErrorMessage}`;
                            finalStatus = 'failed';
                            addLogMessage('error', `${failedResult.site}-${failedResult.productType}-${failedResult.property} 重试验证异常: ${finalError}`);
                        }

                        // Update the result in storage
                        await verificationStorage.updateResult(
                            failedResult.site,
                            failedResult.productType,
                            failedResult.property,
                            {
                                aiGeneratedData: JSON.stringify(aiData),
                                status: finalStatus,
                                error: finalError
                            }
                        );

                        // Update task results in UI
                        setTaskResults(prev => {
                            const updatedResults = prev.map(task => {
                                if (task.site === failedResult.site &&
                                    task.productType === failedResult.productType &&
                                    task.property === failedResult.property) {
                                    return {
                                        ...task,
                                        aiGeneratedData: JSON.stringify(aiData),
                                        status: finalStatus as 'completed' | 'failed' | 'pending' | 'processing',
                                        error: finalError
                                    };
                                }
                                return task;
                            });

                            // If not found in existing results, add it
                            const exists = updatedResults.some(task =>
                                task.site === failedResult.site &&
                                task.productType === failedResult.productType &&
                                task.property === failedResult.property
                            );

                            if (!exists) {
                                updatedResults.push({
                                    property: failedResult.property,
                                    site: failedResult.site,
                                    productType: failedResult.productType,
                                    aiGeneratedData: JSON.stringify(aiData),
                                    status: finalStatus as 'completed' | 'failed' | 'pending' | 'processing',
                                    error: finalError
                                });
                            }

                            return updatedResults;
                        });

                        // 只有验证成功才计入成功计数
                        if (finalStatus === 'completed') {
                            successCount++;
                        }

                    } catch (error) {
                        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                        addLogMessage('error', `重新验证失败: ${failedResult.site}-${failedResult.productType}-${failedResult.property} - ${errorMessage}`);

                        // Update with new error message
                        await verificationStorage.updateResult(
                            failedResult.site,
                            failedResult.productType,
                            failedResult.property,
                            {
                                error: `重试失败: ${errorMessage}`,
                                status: 'failed'
                            }
                        );

                        stillFailedCount++;
                    }

                    processedCount++;
                    setRetryProgress(processedCount);
                }));

                // Add a small delay between batches
                if (i + batchSize < failedResults.length) {
                    await new Promise(resolve => setTimeout(resolve, 500));
                }
            }

            // Update storage stats
            const updatedStats = await verificationStorage.getStorageStats();
            setStorageStats(updatedStats);

            addLogMessage('success', `重新验证完成！处理了 ${processedCount} 个失败结果，验证通过 ${successCount} 个，验证失败 ${stillFailedCount} 个`);

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            addLogMessage('error', `重新验证失败数据时出错: ${errorMessage}`);
        } finally {
            setIsRetryingFailed(false);
        }
    };



    // Add log message with current timestamp
    const addLogMessage = (type: 'info' | 'success' | 'error' | 'ai', message: string) => {
        const now = new Date();
        // Convert to UTC+8 (Beijing time)
        const utc8Time = new Date(now.getTime() + (8 * 60 * 60 * 1000));
        const timestamp = utc8Time.toISOString().replace('T', ' ').substring(0, 19);
        setLogMessages(prev => {
            // Limit log messages to the most recent 500 to prevent memory issues
            const newLogs = [...prev, { timestamp, type, message }];
            if (newLogs.length > 500) {
                return newLogs.slice(-500);
            }
            return newLogs;
        });
    };



    // Export logs to file
    const exportLogs = () => {
        if (logMessages.length === 0) {
            addLogMessage('error', 'No logs available to export.');
            return;
        }

        try {
            // Format logs for export
            const logContent = logMessages.map(log =>
                `[${log.timestamp}] [${log.type.toUpperCase()}] ${log.message}`
            ).join('\n');

            // Create a text blob
            const blob = new Blob([logContent], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);

            // Create a download link
            const link = document.createElement('a');
            link.href = url;
            link.download = `amazon-property-verification-logs-${new Date().toISOString().slice(0, 10)}.txt`;
            link.click();

            addLogMessage('success', 'Logs exported successfully!');
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            addLogMessage('error', `Failed to export logs: ${errorMessage}`);
        }
    };

    return (
        <div className="min-h-screen text-gray-200" style={{ backgroundColor: '#0F172A' }}>
            <div className="min-h-screen flex flex-col items-center justify-center p-4 sm:p-6 lg:p-8">
                <div className="container mx-auto px-6">
                    <header className="text-center mb-8">
                        <div className="flex items-center justify-center gap-2 mb-2">
                            <span className="material-icons text-6xl text-teal-400">rule_folder</span>
                            <h1 className="text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-teal-400 to-teal-300">自动化默认属性适配验证</h1>
                        </div>
                        <p className="text-gray-400">自动适配产品默认属性, 确保数据一致性与准确性。</p>
                    </header>

                    <main className="bg-gray-800/50 backdrop-blur-sm rounded-xl shadow-2xl p-6 md:p-8 space-y-6">
                        <div className="bg-gray-900/60 p-5 rounded-lg">
                            <h2 className="font-semibold text-lg mb-4 flex items-center">
                                <span className="material-icons mr-2 text-blue-400">dashboard</span>控制面板
                            </h2>

                            {/* Storage Statistics */}
                            <div className="mb-4 p-3 bg-gray-800/50 rounded-lg">
                                <h3 className="text-sm font-medium text-gray-300 mb-2 flex items-center">
                                    <span className="material-icons mr-1 text-green-400 text-sm">storage</span>存储统计
                                </h3>
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                                    <div className="text-center">
                                        <div className="text-blue-400 font-bold">{storageStats.totalResults}</div>
                                        <div className="text-gray-400">总计</div>
                                    </div>
                                    <div className="text-center">
                                        <div className="text-green-400 font-bold">{storageStats.completedResults}</div>
                                        <div className="text-gray-400">成功</div>
                                    </div>
                                    <div className="text-center">
                                        <div className="text-red-400 font-bold">{storageStats.failedResults}</div>
                                        <div className="text-gray-400">失败</div>
                                    </div>
                                    <div className="text-center">
                                        <div className="text-yellow-400 font-bold">{skippedCount}</div>
                                        <div className="text-gray-400">跳过</div>
                                    </div>
                                </div>
                            </div>
                            <div className="space-y-4">
                                {/* Unified Progress Bar */}
                                <div>
                                    <div className="flex justify-between items-center mb-1">
                                        <span className="text-sm font-medium text-gray-300">
                                            {isRetryingFailed ? '重新验证进度' :
                                                isDataCleaning ? '数据清洗进度' :
                                                    '验证任务进度'}
                                        </span>
                                        <div className="flex items-center">
                                            <span className={`text-sm font-medium mr-2 ${isRetryingFailed ? 'text-red-400' :
                                                isDataCleaning ? 'text-orange-400' :
                                                    'text-blue-400'
                                                }`}>
                                                {isRetryingFailed ? `${retryProgress}/${totalRetryTasks}` :
                                                    isDataCleaning ? `${cleaningProgress}/${totalCleaningTasks}` :
                                                        `${taskProgress}/${totalTasks}`}
                                            </span>
                                            <button
                                                className="text-gray-400 hover:text-blue-400 transition-colors"
                                                onClick={() => fetchAdapterProperties()}
                                                disabled={isLoading || isProcessing || isDataCleaning || isRetryingFailed}
                                                title="刷新属性列表"
                                            >
                                                <span className={`material-icons text-sm ${isLoading ? 'animate-spin text-blue-400' : ''}`}>refresh</span>
                                            </button>
                                        </div>
                                    </div>
                                    <div className="w-full bg-gray-700 rounded-full h-2.5">
                                        <div
                                            className={`h-2.5 rounded-full transition-all duration-300 ${isRetryingFailed ? 'bg-red-500' :
                                                isDataCleaning ? 'bg-orange-500' :
                                                    'bg-blue-500'
                                                }`}
                                            style={{
                                                width: `${isRetryingFailed ? (totalRetryTasks > 0 ? (retryProgress / totalRetryTasks) * 100 : 0) :
                                                    isDataCleaning ? (totalCleaningTasks > 0 ? (cleaningProgress / totalCleaningTasks) * 100 : 0) :
                                                        (totalTasks > 0 ? (taskProgress / totalTasks) * 100 : 0)
                                                    }%`
                                            }}
                                        ></div>
                                    </div>
                                </div>

                                <div>
                                    <p className="text-sm font-medium text-gray-300 mb-2">当前执行状态</p>
                                    <div className="bg-gray-800 p-3 rounded-md flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <span className={`material-icons ${isRetryingFailed ? 'text-red-400 animate-spin' :
                                                isDataCleaning ? 'text-orange-400 animate-spin' :
                                                    isProcessing ? 'text-yellow-400 animate-spin' :
                                                        isLoading ? 'text-blue-400 animate-spin' :
                                                            'text-green-400'
                                                }`}>
                                                {isRetryingFailed ? 'refresh' :
                                                    isDataCleaning ? 'cleaning_services' : 'autorenew'}
                                            </span>
                                            <span className="font-mono text-sm">
                                                {isRetryingFailed ? '重新验证失败数据中...' :
                                                    isDataCleaning ? '数据清洗中...' :
                                                        isLoading ? '加载中...' :
                                                            currentProperty || '待命中'}
                                            </span>
                                        </div>
                                        <span className="text-xs text-gray-500">
                                            {isRetryingFailed ? '重新处理失败的验证结果' :
                                                isDataCleaning ? '清洗JSON数据' :
                                                    isLoading ? '正在加载属性' :
                                                        'AI分析推荐属性'}
                                        </span>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                                    <button
                                        className={`${isProcessing
                                            ? 'bg-green-600 hover:bg-green-700'
                                            : 'bg-green-500 hover:bg-green-600'} 
                                            text-white font-bold py-2 px-3 rounded-lg flex items-center justify-center gap-1 transition-colors text-sm
                                            ${(isProcessing || isLoading || isDataCleaning || isRetryingFailed) ? 'opacity-50 cursor-not-allowed' : ''}`}
                                        onClick={handleStartTask}
                                        disabled={isProcessing || isLoading || adapterProperties.length === 0 || isDataCleaning || isRetryingFailed}
                                    >
                                        <span className="material-icons text-sm">play_arrow</span>
                                        <span>开始验证</span>
                                    </button>

                                    <button
                                        className={`${!isProcessing
                                            ? 'bg-yellow-600 hover:bg-yellow-700'
                                            : 'bg-yellow-500 hover:bg-yellow-600'} 
                                            text-white font-bold py-2 px-3 rounded-lg flex items-center justify-center gap-1 transition-colors text-sm
                                            ${(!isProcessing || isLoading || isDataCleaning || isRetryingFailed) ? 'opacity-50 cursor-not-allowed' : ''}`}
                                        onClick={handlePauseTask}
                                        disabled={!isProcessing || isLoading || isDataCleaning || isRetryingFailed}
                                    >
                                        <span className="material-icons text-sm">pause</span>
                                        <span>暂停验证</span>
                                    </button>

                                    <button
                                        className={`${isRetryingFailed
                                            ? 'bg-red-600 hover:bg-red-700'
                                            : 'bg-red-500 hover:bg-red-600'} 
                                            text-white font-bold py-2 px-3 rounded-lg flex items-center justify-center gap-1 transition-colors text-sm
                                            ${(isProcessing || isLoading || isDataCleaning || isRetryingFailed) ? 'opacity-50 cursor-not-allowed' : ''}`}
                                        onClick={handleRetryFailedResults}
                                        disabled={isProcessing || isLoading || isDataCleaning || isRetryingFailed}
                                        title="重新验证所有失败的数据"
                                    >
                                        <span className={`material-icons text-sm ${isRetryingFailed ? 'animate-spin' : ''}`}>refresh</span>
                                        <span>重试失败</span>
                                    </button>

                                    <button
                                        className={`${isDataCleaning
                                            ? 'bg-orange-600 hover:bg-orange-700'
                                            : 'bg-orange-500 hover:bg-orange-600'} 
                                            text-white font-bold py-2 px-3 rounded-lg flex items-center justify-center gap-1 transition-colors text-sm
                                            ${(isProcessing || isLoading || isDataCleaning || isRetryingFailed) ? 'opacity-50 cursor-not-allowed' : ''}`}
                                        onClick={handleDataCleaning}
                                        disabled={isProcessing || isLoading || isDataCleaning || isRetryingFailed}
                                        title="清洗验证结果数据，移除marketplace_id并压缩JSON"
                                    >
                                        <span className={`material-icons text-sm ${isDataCleaning ? 'animate-spin' : ''}`}>cleaning_services</span>
                                        <span>数据清洗</span>
                                    </button>

                                    <button
                                        className="bg-purple-500 hover:bg-purple-600 text-white font-bold py-2 px-3 rounded-lg flex items-center justify-center gap-1 transition-colors text-sm"
                                        onClick={() => navigate('/verification-results')}
                                        title="查看验证结果数据"
                                    >
                                        <span className="material-icons text-sm">analytics</span>
                                        <span>查看结果</span>
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div className="relative">
                            <div className="absolute top-2 right-2 z-10">
                                <button
                                    className="bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-md p-1 flex items-center text-xs"
                                    onClick={exportLogs}
                                    title="Export Logs"
                                >
                                    <span className="material-icons text-sm mr-1">description</span>
                                    导出日志
                                </button>
                            </div>
                            <div
                                ref={logContainerRef}
                                className="bg-black rounded-lg p-4 h-64 font-mono text-sm overflow-y-auto"
                            >
                                <p className="text-green-400">&gt; Initializing process...</p>
                                {logMessages.map((log, index) => (
                                    <p key={index}>
                                        <span className="text-gray-500">[{log.timestamp}]</span>{' '}
                                        <span className={`
                                            ${log.type === 'info' ? 'text-blue-400' : ''}
                                            ${log.type === 'success' ? 'text-green-400' : ''}
                                            ${log.type === 'error' ? 'text-red-400' : ''}
                                            ${log.type === 'ai' ? 'text-yellow-400' : ''}
                                        `}>
                                            [{log.type.toUpperCase()}]
                                        </span>{' '}
                                        {log.message}
                                    </p>
                                ))}
                                {isProcessing && (
                                    <p className="text-white animate-pulse">&gt; Processing...</p>
                                )}
                            </div>
                        </div>
                    </main>
                </div>
            </div>
        </div>
    );
};

export default AutomatedPropertyVerification;
