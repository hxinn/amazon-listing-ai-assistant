/**
 * Utility functions for cleaning and transforming data
 */

/**
 * Recursively removes marketplace_id fields from an object or array
 * @param data - The data to clean
 * @returns An object containing the cleaned data and a flag indicating if any fields were removed
 */
export const removeMarketplaceIdRecursively = (data: any): { cleaned: any; removed: boolean } => {
    let wasModified = false;

    // 深度克隆并清洗数据的函数
    const deepCleanAndRemove = (obj: any): any => {
        // 处理数组
        if (Array.isArray(obj)) {
            return obj.map(item => deepCleanAndRemove(item));
        }

        // 处理对象
        if (obj !== null && typeof obj === 'object') {
            const cleaned: any = {};

            for (const key in obj) {
                if (obj.hasOwnProperty(key)) {
                    // 跳过 marketplace_id
                    if (key === 'marketplace_id') {
                        wasModified = true;
                        console.info(`移除了 marketplace_id: ${obj[key]}`);
                        continue; // 不复制这个属性
                    }

                    // 递归处理其他属性
                    cleaned[key] = deepCleanAndRemove(obj[key]);
                }
            }

            return cleaned;
        }

        // 返回基本类型值
        return obj;
    };

    const result = deepCleanAndRemove(data);

    return {
        cleaned: result,
        removed: wasModified
    };
};