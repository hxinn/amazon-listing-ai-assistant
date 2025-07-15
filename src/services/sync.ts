import axios from 'axios';
import { config } from '../config';
import { StoredVerificationResult, verificationStorage } from './storage';

/**
 * 同步请求参数接口
 */
export interface SyncRequestParams {
  site: string;
  attributeName: string;
  attributeValue: string;
  type: number;
  codeAdapter: boolean;
  applicableAttributeType: number;
}

/**
 * 同步结果接口
 */
export interface SyncResult {
  success: boolean;
  message: string;
  data?: any;
  error?: string;
}

/**
 * 批量同步结果接口
 */
export interface BatchSyncResult {
  total: number;
  success: number;
  failed: number;
  results: Array<{
    property: string;
    site: string;
    productType: string;
    success: boolean;
    message: string;
    error?: string;
  }>;
}

/**
 * 同步状态枚举
 */
export enum SyncStatus {
  PENDING = 'pending',
  SYNCING = 'syncing',
  SUCCESS = 'success',
  FAILED = 'failed'
}

/**
 * 分组同步数据接口
 */
export interface GroupedSyncData {
  type: number;
  sites: string[];
  attributeName: string;
  attributeValue: string;
  codeAdapter: boolean;
  applicableAttributeType: number;
}

/**
 * 数据同步服务
 */
export class SyncService {
  private static instance: SyncService;
  private syncQueue: StoredVerificationResult[] = [];
  private isSyncing: boolean = false;

  private constructor() {}

  /**
   * 获取同步服务实例
   */
  static getInstance(): SyncService {
    if (!SyncService.instance) {
      SyncService.instance = new SyncService();
    }
    return SyncService.instance;
  }

  /**
   * 同步单个验证结果到服务器
   * @param result 验证结果数据
   * @returns 同步结果
   */
  async syncSingleResult(result: StoredVerificationResult): Promise<SyncResult> {
    try {
      // 更新同步状态为正在同步
      await verificationStorage.updateSyncStatus(result.id, 'syncing');

      // 解析AI生成的数据
      let aiData: any = {};
      if (result.aiGeneratedData) {
        try {
          aiData = JSON.parse(result.aiGeneratedData);
        } catch (error) {
          const errorMsg = `无法解析AI生成的数据: ${error instanceof Error ? error.message : '未知错误'}`;
          await verificationStorage.updateSyncStatus(result.id, 'sync_failed', errorMsg);
          return {
            success: false,
            message: '数据格式错误',
            error: errorMsg
          };
        }
      }

      // 构建同步请求参数
      const syncParams: SyncRequestParams = {
        site: result.site,
        attributeName: result.property,
        attributeValue: JSON.stringify(aiData),
        type: 2, // 默认类型
        codeAdapter: false,
        applicableAttributeType: 3 // 默认适用属性类型
      };

      // 发送同步请求
      const response = await axios.post(
        `${config.API_BASE_URL}/productTypeTemplateJsonAttr/saveOrUpdate`,
        syncParams,
        {
          headers: {
            'Content-Type': 'application/json',
            'Accept': '*/*'
          }
        }
      );

      // 检查响应结果
      if (response.status === 200) {
        // 更新同步状态为成功
        await verificationStorage.updateSyncStatus(result.id, 'synced');
        return {
          success: true,
          message: '同步成功',
          data: response.data
        };
      } else {
        const errorMsg = `服务器返回状态码: ${response.status}`;
        await verificationStorage.updateSyncStatus(result.id, 'sync_failed', errorMsg);
        return {
          success: false,
          message: '同步失败',
          error: errorMsg
        };
      }

    } catch (error: any) {
      const errorMsg = error.response?.data?.message || error.message || '未知错误';
      await verificationStorage.updateSyncStatus(result.id, 'sync_failed', errorMsg);
      return {
        success: false,
        message: '同步失败',
        error: errorMsg
      };
    }
  }

  /**
   * 批量同步验证结果
   * @param results 验证结果数组
   * @param onProgress 进度回调函数
   * @returns 批量同步结果
   */
  async syncBatchResults(
    results: StoredVerificationResult[],
    onProgress?: (current: number, total: number, currentItem: StoredVerificationResult) => void
  ): Promise<BatchSyncResult> {
    const batchResult: BatchSyncResult = {
      total: results.length,
      success: 0,
      failed: 0,
      results: []
    };

    this.isSyncing = true;

    try {
      for (let i = 0; i < results.length; i++) {
        const result = results[i];
        
        // 调用进度回调
        if (onProgress) {
          onProgress(i + 1, results.length, result);
        }

        // 只同步成功的验证结果
        if (result.status !== 'completed') {
          batchResult.results.push({
            property: result.property,
            site: result.site,
            productType: result.productType,
            success: false,
            message: '跳过失败的验证结果',
            error: '验证状态不是完成状态'
          });
          batchResult.failed++;
          continue;
        }

        // 执行同步
        const syncResult = await this.syncSingleResult(result);
        
        batchResult.results.push({
          property: result.property,
          site: result.site,
          productType: result.productType,
          success: syncResult.success,
          message: syncResult.message,
          error: syncResult.error
        });

        if (syncResult.success) {
          batchResult.success++;
        } else {
          batchResult.failed++;
        }

        // 添加延迟以避免过于频繁的请求
        if (i < results.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }
    } finally {
      this.isSyncing = false;
    }

    return batchResult;
  }

  /**
   * 同步选中的验证结果
   * @param selectedResults 选中的验证结果
   * @param onProgress 进度回调
   * @returns 同步结果
   */
  async syncSelectedResults(
    selectedResults: StoredVerificationResult[],
    onProgress?: (current: number, total: number, currentItem: StoredVerificationResult) => void
  ): Promise<BatchSyncResult> {
    // 过滤出成功的验证结果
    const validResults = selectedResults.filter(result => result.status === 'completed');
    
    if (validResults.length === 0) {
      return {
        total: selectedResults.length,
        success: 0,
        failed: selectedResults.length,
        results: selectedResults.map(result => ({
          property: result.property,
          site: result.site,
          productType: result.productType,
          success: false,
          message: '无有效的验证结果可同步',
          error: '验证状态不是完成状态'
        }))
      };
    }

    return this.syncBatchResults(validResults, onProgress);
  }

  /**
   * 检查是否正在同步
   */
  isCurrentlySyncing(): boolean {
    return this.isSyncing;
  }

  /**
   * 验证同步数据格式
   * @param result 验证结果
   * @returns 验证结果
   */
  validateSyncData(result: StoredVerificationResult): { valid: boolean; error?: string } {
    // 检查必要字段
    if (!result.property) {
      return { valid: false, error: '缺少属性名' };
    }

    if (!result.site) {
      return { valid: false, error: '缺少站点信息' };
    }

    if (result.status !== 'completed') {
      return { valid: false, error: '验证状态不是完成状态' };
    }

    // 检查AI生成的数据
    if (!result.aiGeneratedData) {
      return { valid: false, error: '缺少AI生成的数据' };
    }

    try {
      JSON.parse(result.aiGeneratedData);
    } catch (error) {
      return { valid: false, error: 'AI生成的数据格式无效' };
    }

    return { valid: true };
  }

  /**
   * 获取可同步的验证结果
   * @param results 所有验证结果
   * @returns 可同步的验证结果
   */
  getValidSyncResults(results: StoredVerificationResult[]): StoredVerificationResult[] {
    return results.filter(result => {
      const validation = this.validateSyncData(result);
      return validation.valid;
    });
  }

  /**
   * 按属性名和AI生成数据分组验证结果
   * @param propertyName 属性名
   * @param results 验证结果数组
   * @returns 分组后的同步数据
   */
  groupResultsByProperty(propertyName: string, results: StoredVerificationResult[]): GroupedSyncData[] {
    // 只处理成功的验证结果
    const validResults = results.filter(result => 
      result.status === 'completed' && 
      result.property === propertyName &&
      result.aiGeneratedData
    );

    // 按AI生成的数据分组
    const groupedByAiData = new Map<string, StoredVerificationResult[]>();
    
    validResults.forEach(result => {
      const aiDataKey = result.aiGeneratedData;
      if (!groupedByAiData.has(aiDataKey)) {
        groupedByAiData.set(aiDataKey, []);
      }
      groupedByAiData.get(aiDataKey)!.push(result);
    });

    // 转换为分组同步数据格式
    const groupedSyncData: GroupedSyncData[] = [];
    
    groupedByAiData.forEach((groupResults, aiDataKey) => {
      // 收集该组的所有站点
      const sites = [...new Set(groupResults.map(result => result.site))];
      
      groupedSyncData.push({
        type: 2,
        sites: sites,
        attributeName: propertyName,
        attributeValue: aiDataKey,
        codeAdapter: false,
        applicableAttributeType: 3
      });
    });

    return groupedSyncData;
  }

  /**
   * 同步分组数据到服务器
   * @param groupedData 分组同步数据
   * @param onProgress 进度回调
   * @returns 同步结果
   */
  async syncGroupedData(
    groupedData: GroupedSyncData[],
    onProgress?: (current: number, total: number, currentItem: GroupedSyncData) => void
  ): Promise<BatchSyncResult> {
    const batchResult: BatchSyncResult = {
      total: groupedData.length,
      success: 0,
      failed: 0,
      results: []
    };

    this.isSyncing = true;

    try {
      for (let i = 0; i < groupedData.length; i++) {
        const groupData = groupedData[i];
        
        // 调用进度回调
        if (onProgress) {
          onProgress(i + 1, groupedData.length, groupData);
        }

        try {
          // 发送同步请求
          const response = await axios.post(
            `${config.API_BASE_URL}/productTypeTemplateJsonAttr/saveOrUpdate`,
            groupData,
            {
              headers: {
                'Content-Type': 'application/json',
                'Accept': '*/*'
              }
            }
          );

          if (response.status === 200) {
            batchResult.results.push({
              property: groupData.attributeName,
              site: groupData.sites.join(', '),
              productType: '', // 分组数据没有具体的产品类型
              success: true,
              message: '同步成功'
            });
            batchResult.success++;
          } else {
            const errorMsg = `服务器返回状态码: ${response.status}`;
            batchResult.results.push({
              property: groupData.attributeName,
              site: groupData.sites.join(', '),
              productType: '',
              success: false,
              message: '同步失败',
              error: errorMsg
            });
            batchResult.failed++;
          }

        } catch (error: any) {
          const errorMsg = error.response?.data?.message || error.message || '未知错误';
          batchResult.results.push({
            property: groupData.attributeName,
            site: groupData.sites.join(', '),
            productType: '',
            success: false,
            message: '同步失败',
            error: errorMsg
          });
          batchResult.failed++;
        }

        // 添加延迟以避免过于频繁的请求
        if (i < groupedData.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }
    } finally {
      this.isSyncing = false;
    }

    return batchResult;
  }

  /**
   * 按属性名同步数据
   * @param propertyName 属性名
   * @param onProgress 进度回调
   * @returns 同步结果
   */
  async syncByProperty(
    propertyName: string,
    onProgress?: (current: number, total: number, currentItem: GroupedSyncData) => void
  ): Promise<BatchSyncResult> {
    try {
      // 从存储中获取该属性的所有数据
      const results = await verificationStorage.getResultsByProperty(propertyName);
      
      // 按AI生成数据分组
      const groupedData = this.groupResultsByProperty(propertyName, results);
      
      if (groupedData.length === 0) {
        return {
          total: 0,
          success: 0,
          failed: 0,
          results: [{
            property: propertyName,
            site: '',
            productType: '',
            success: false,
            message: '没有可同步的数据',
            error: '未找到有效的验证结果'
          }]
        };
      }

      // 同步分组数据
      return await this.syncGroupedData(groupedData, onProgress);
      
    } catch (error: any) {
      return {
        total: 0,
        success: 0,
        failed: 1,
        results: [{
          property: propertyName,
          site: '',
          productType: '',
          success: false,
          message: '同步失败',
          error: error.message || '未知错误'
        }]
      };
    }
  }

  /**
   * 全量按属性名同步数据
   * 获取所有属性名，并逐个进行同步
   */
  async syncAllByProperty(
    onProgress?: (current: number, total: number, currentItem?: GroupedSyncData) => void
  ): Promise<BatchSyncResult> {
    try {
      // 获取所有属性名
      const propertyNames = await verificationStorage.getAllPropertyNames();
      
      if (propertyNames.length === 0) {
        return {
          total: 0,
          success: 0,
          failed: 0,
          results: [{
            property: '',
            site: '',
            productType: '',
            success: false,
            message: '没有可同步的属性',
            error: '未找到任何属性数据'
          }]
        };
      }

      // 收集所有需要同步的分组数据
      const allGroupedData: GroupedSyncData[] = [];
      
      for (const propertyName of propertyNames) {
        const results = await verificationStorage.getResultsByProperty(propertyName);
        const groupedData = this.groupResultsByProperty(propertyName, results);
        allGroupedData.push(...groupedData);
      }

      if (allGroupedData.length === 0) {
        return {
          total: 0,
          success: 0,
          failed: 0,
          results: [{
            property: '',
            site: '',
            productType: '',
            success: false,
            message: '没有可同步的数据',
            error: '未找到有效的验证结果'
          }]
        };
      }

      // 同步所有分组数据
      return await this.syncGroupedData(allGroupedData, onProgress);
      
    } catch (error: any) {
      return {
        total: 0,
        success: 0,
        failed: 1,
        results: [{
          property: '',
          site: '',
          productType: '',
          success: false,
          message: '全量同步失败',
          error: error.message || '未知错误'
        }]
      };
    }
  }
}

/**
 * 导出同步服务实例
 */
export const syncService = SyncService.getInstance(); 