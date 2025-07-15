// AI验证结果存储服务
export interface StoredVerificationResult {
  id: string; // 唯一标识：site-productType-property
  property: string;
  site: string;
  productType: string;
  aiGeneratedData: string;
  status: 'completed' | 'failed';
  error?: string;
  timestamp: number;
  language_tag?: string;
  marketplace_id?: string;
  // 同步相关字段
  syncStatus?: 'pending' | 'syncing' | 'synced' | 'sync_failed';
  syncTimestamp?: number;
  syncError?: string;
}

export interface StorageStats {
  totalResults: number;
  completedResults: number;
  failedResults: number;
  lastUpdated: number;
}

class VerificationStorageService {
  private dbName = 'amazon-property-verification';
  private dbVersion = 1;
  private storeName = 'verification-results';
  private db: IDBDatabase | null = null;

  // 初始化数据库
  async initDB(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);

      request.onerror = () => {
        reject(new Error('Failed to open IndexedDB'));
      };

      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        
        // 创建对象存储
        if (!db.objectStoreNames.contains(this.storeName)) {
          const store = db.createObjectStore(this.storeName, { keyPath: 'id' });
          
          // 创建索引
          store.createIndex('property', 'property', { unique: false });
          store.createIndex('site', 'site', { unique: false });
          store.createIndex('productType', 'productType', { unique: false });
          store.createIndex('status', 'status', { unique: false });
          store.createIndex('timestamp', 'timestamp', { unique: false });
          store.createIndex('siteProperty', ['site', 'property'], { unique: false });
        }
      };
    });
  }

  // 生成唯一ID
  private generateId(site: string, productType: string, property: string): string {
    return `${site}-${productType}-${property}`;
  }

  // 确保数据库已初始化
  private async ensureDB(): Promise<void> {
    if (!this.db) {
      await this.initDB();
    }
  }

  // 保存验证结果
  async saveResult(result: Omit<StoredVerificationResult, 'id' | 'timestamp'>): Promise<void> {
    await this.ensureDB();
    
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const transaction = this.db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      
      const storedResult: StoredVerificationResult = {
        ...result,
        id: this.generateId(result.site, result.productType, result.property),
        timestamp: Date.now()
      };

      const request = store.put(storedResult);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(new Error('Failed to save result'));
    });
  }

  // 批量保存验证结果
  async saveResults(results: Array<Omit<StoredVerificationResult, 'id' | 'timestamp'>>): Promise<void> {
    await this.ensureDB();
    
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const transaction = this.db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      
      let completed = 0;
      let hasError = false;

      results.forEach(result => {
        const storedResult: StoredVerificationResult = {
          ...result,
          id: this.generateId(result.site, result.productType, result.property),
          timestamp: Date.now()
        };

        const request = store.put(storedResult);
        
        request.onsuccess = () => {
          completed++;
          if (completed === results.length && !hasError) {
            resolve();
          }
        };

        request.onerror = () => {
          hasError = true;
          reject(new Error('Failed to save results'));
        };
      });

      if (results.length === 0) {
        resolve();
      }
    });
  }

  // 更新验证结果
  async updateResult(site: string, productType: string, property: string, updates: Partial<StoredVerificationResult>): Promise<void> {
    await this.ensureDB();
    
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const transaction = this.db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      
      const id = this.generateId(site, productType, property);
      const getRequest = store.get(id);

      getRequest.onsuccess = () => {
        const existingResult = getRequest.result;
        if (!existingResult) {
          reject(new Error('Result not found'));
          return;
        }

        const updatedResult: StoredVerificationResult = {
          ...existingResult,
          ...updates,
          id, // Ensure ID remains the same
          timestamp: Date.now() // Update timestamp
        };

        const putRequest = store.put(updatedResult);
        
        putRequest.onsuccess = () => resolve();
        putRequest.onerror = () => reject(new Error('Failed to update result'));
      };

      getRequest.onerror = () => reject(new Error('Failed to get existing result'));
    });
  }

  // 检查是否已存在有效的验证结果（只有completed状态才算有效）
  async hasResult(site: string, productType: string, property: string): Promise<boolean> {
    await this.ensureDB();
    
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const transaction = this.db.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      
      const id = this.generateId(site, productType, property);
      const request = store.get(id);

      request.onsuccess = () => {
        const result = request.result;
        // 只有当结果存在且状态为'completed'时才返回true
        resolve(result !== undefined && result.status === 'completed');
      };

      request.onerror = () => reject(new Error('Failed to check result'));
    });
  }

  // 添加新方法：检查是否存在任何记录（不考虑状态）
  async hasAnyResult(site: string, productType: string, property: string): Promise<boolean> {
    await this.ensureDB();
    
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const transaction = this.db.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      
      const id = this.generateId(site, productType, property);
      const request = store.get(id);

      request.onsuccess = () => {
        resolve(request.result !== undefined);
      };

      request.onerror = () => reject(new Error('Failed to check result'));
    });
  }

  // 获取验证结果
  async getResult(site: string, productType: string, property: string): Promise<StoredVerificationResult | null> {
    await this.ensureDB();
    
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const transaction = this.db.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      
      const id = this.generateId(site, productType, property);
      const request = store.get(id);

      request.onsuccess = () => {
        resolve(request.result || null);
      };

      request.onerror = () => reject(new Error('Failed to get result'));
    });
  }

  // 获取所有验证结果
  async getAllResults(): Promise<StoredVerificationResult[]> {
    await this.ensureDB();
    
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const transaction = this.db.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      
      const request = store.getAll();

      request.onsuccess = () => {
        resolve(request.result || []);
      };

      request.onerror = () => reject(new Error('Failed to get all results'));
    });
  }

  // 按属性获取验证结果
  async getResultsByProperty(property: string): Promise<StoredVerificationResult[]> {
    await this.ensureDB();
    
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const transaction = this.db.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      const index = store.index('property');
      
      const request = index.getAll(property);

      request.onsuccess = () => {
        const results = request.result || [];
        // 按时间戳倒序排列
        results.sort((a, b) => b.timestamp - a.timestamp);
        resolve(results);
      };

      request.onerror = () => reject(new Error('Failed to get results by property'));
    });
  }

  // 按站点获取验证结果
  async getResultsBySite(site: string): Promise<StoredVerificationResult[]> {
    await this.ensureDB();
    
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const transaction = this.db.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      const index = store.index('site');
      
      const request = index.getAll(site);

      request.onsuccess = () => {
        resolve(request.result || []);
      };

      request.onerror = () => reject(new Error('Failed to get results by site'));
    });
  }

  // 删除验证结果
  async deleteResult(site: string, productType: string, property: string): Promise<void> {
    await this.ensureDB();
    
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const transaction = this.db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      
      const id = this.generateId(site, productType, property);
      const request = store.delete(id);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(new Error('Failed to delete result'));
    });
  }

  // 清空所有验证结果
  async clearAllResults(): Promise<void> {
    await this.ensureDB();
    
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const transaction = this.db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      
      const request = store.clear();

      request.onsuccess = () => resolve();
      request.onerror = () => reject(new Error('Failed to clear results'));
    });
  }

  // 获取存储统计信息
  async getStorageStats(): Promise<StorageStats> {
    const results = await this.getAllResults();
    
    return {
      totalResults: results.length,
      completedResults: results.filter(r => r.status === 'completed').length,
      failedResults: results.filter(r => r.status === 'failed').length,
      lastUpdated: results.length > 0 ? Math.max(...results.map(r => r.timestamp)) : 0
    };
  }

  // 检查多个站点+属性组合是否已存在
  async checkExistingResults(combinations: Array<{site: string, productType: string, property: string}>): Promise<Array<{site: string, productType: string, property: string, exists: boolean}>> {
    await this.ensureDB();
    
    const results = await Promise.all(
      combinations.map(async (combo) => {
        const exists = await this.hasResult(combo.site, combo.productType, combo.property);
        return { ...combo, exists };
      })
    );

    return results;
  }

  // 获取所有失败的验证结果
  async getFailedResults(): Promise<StoredVerificationResult[]> {
    await this.ensureDB();
    
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const transaction = this.db.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      const index = store.index('status');
      
      const request = index.getAll('failed');

      request.onsuccess = () => {
        resolve(request.result || []);
      };

      request.onerror = () => {
        reject(new Error('Failed to get failed results'));
      };
    });
  }

  // 导出所有数据
  async exportAllData(): Promise<StoredVerificationResult[]> {
    return await this.getAllResults();
  }

  // 导入数据
  async importData(data: StoredVerificationResult[]): Promise<void> {
    await this.ensureDB();
    
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const transaction = this.db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      
      let completed = 0;
      let hasError = false;

      data.forEach(item => {
        const request = store.put(item);
        
        request.onsuccess = () => {
          completed++;
          if (completed === data.length && !hasError) {
            resolve();
          }
        };

        request.onerror = () => {
          hasError = true;
          reject(new Error('Failed to import data'));
        };
      });

      if (data.length === 0) {
        resolve();
      }
    });
  }

  // 检查是否已存在有效的验证结果（只用site+property，只有completed状态才算有效）
  async hasResultBySiteProperty(site: string, property: string): Promise<boolean> {
    await this.ensureDB();
    
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const transaction = this.db.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      const index = store.index('siteProperty');
      
      const request = index.getAll([site, property]);

      request.onsuccess = () => {
        const results = request.result || [];
        // 只有当存在且状态为'completed'的结果时才返回true
        const hasValidResult = results.some(result => result.status === 'completed');
        resolve(hasValidResult);
      };

      request.onerror = () => reject(new Error('Failed to check result by site and property'));
    });
  }

  // 检查是否存在任何记录（只用site+property，不考虑状态）
  async hasAnyResultBySiteProperty(site: string, property: string): Promise<boolean> {
    await this.ensureDB();
    
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const transaction = this.db.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      const index = store.index('siteProperty');
      
      const request = index.getAll([site, property]);

      request.onsuccess = () => {
        const results = request.result || [];
        resolve(results.length > 0);
      };

      request.onerror = () => reject(new Error('Failed to check any result by site and property'));
    });
  }

  // 获取site+property的所有验证结果
  async getResultsBySiteProperty(site: string, property: string): Promise<StoredVerificationResult[]> {
    await this.ensureDB();
    
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const transaction = this.db.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      const index = store.index('siteProperty');
      
      const request = index.getAll([site, property]);

      request.onsuccess = () => {
        resolve(request.result || []);
      };

      request.onerror = () => reject(new Error('Failed to get results by site and property'));
    });
  }

  // 删除指定ID的记录
  async deleteResultById(id: string): Promise<void> {
    await this.ensureDB();
    
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const transaction = this.db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      
      const request = store.delete(id);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(new Error('Failed to delete result by ID'));
    });
  }

  // 查找所有重复的站点+属性组合（相同site和property的多条记录）
  async findDuplicateSitePropertyRecords(): Promise<{[key: string]: StoredVerificationResult[]}> {
    await this.ensureDB();
    
    const allResults = await this.getAllResults();
    const duplicateGroups: {[key: string]: StoredVerificationResult[]} = {};
    
    // 按site-property分组
    const grouped: {[key: string]: StoredVerificationResult[]} = {};
    
    allResults.forEach(result => {
      const key = `${result.site}-${result.property}`;
      if (!grouped[key]) {
        grouped[key] = [];
      }
      grouped[key].push(result);
    });
    
    // 筛选出有多条记录的组合
    Object.keys(grouped).forEach(key => {
      if (grouped[key].length > 1) {
        duplicateGroups[key] = grouped[key];
      }
    });
    
    return duplicateGroups;
  }

  // 删除重复的站点+属性记录，保留最新的一条
  async removeDuplicateSitePropertyRecords(): Promise<{
    totalDuplicateGroups: number;
    totalRecordsRemoved: number;
    processedGroups: Array<{key: string, kept: StoredVerificationResult, removed: StoredVerificationResult[]}>
  }> {
    await this.ensureDB();
    
    const duplicateGroups = await this.findDuplicateSitePropertyRecords();
    const processedGroups: Array<{key: string, kept: StoredVerificationResult, removed: StoredVerificationResult[]}> = [];
    let totalRecordsRemoved = 0;
    
    for (const [key, records] of Object.entries(duplicateGroups)) {
      // 按时间戳排序，最新的在前
      const sortedRecords = records.sort((a, b) => b.timestamp - a.timestamp);
      
      // 保留第一条（最新的），删除其余的
      const toKeep = sortedRecords[0];
      const toRemove = sortedRecords.slice(1);
      
      // 删除旧记录
      for (const record of toRemove) {
        await this.deleteResultById(record.id);
        totalRecordsRemoved++;
      }
      
      processedGroups.push({
        key,
        kept: toKeep,
        removed: toRemove
      });
    }
    
    return {
      totalDuplicateGroups: Object.keys(duplicateGroups).length,
      totalRecordsRemoved,
      processedGroups
    };
  }

  // 更新同步状态
  async updateSyncStatus(id: string, syncStatus: 'pending' | 'syncing' | 'synced' | 'sync_failed', syncError?: string): Promise<void> {
    await this.ensureDB();
    
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const transaction = this.db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      
      const getRequest = store.get(id);

      getRequest.onsuccess = () => {
        const existingResult = getRequest.result;
        if (!existingResult) {
          reject(new Error('Result not found'));
          return;
        }

        const updatedResult: StoredVerificationResult = {
          ...existingResult,
          syncStatus,
          syncTimestamp: Date.now(),
          syncError: syncError || undefined
        };

        const putRequest = store.put(updatedResult);
        
        putRequest.onsuccess = () => resolve();
        putRequest.onerror = () => reject(new Error('Failed to update sync status'));
      };

      getRequest.onerror = () => reject(new Error('Failed to get existing result'));
    });
  }

  // 获取待同步的结果
  async getPendingSyncResults(): Promise<StoredVerificationResult[]> {
    await this.ensureDB();
    
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const transaction = this.db.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      const request = store.getAll();

      request.onsuccess = () => {
        const results = request.result || [];
        // 过滤出状态为completed且同步状态为pending或未设置的结果
        const pendingResults = results.filter(result => 
          result.status === 'completed' && 
          (!result.syncStatus || result.syncStatus === 'pending')
        );
        resolve(pendingResults);
      };

      request.onerror = () => reject(new Error('Failed to get pending sync results'));
    });
  }

  // 获取已同步的结果
  async getSyncedResults(): Promise<StoredVerificationResult[]> {
    await this.ensureDB();
    
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const transaction = this.db.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      const request = store.getAll();

      request.onsuccess = () => {
        const results = request.result || [];
        const syncedResults = results.filter(result => result.syncStatus === 'synced');
        resolve(syncedResults);
      };

      request.onerror = () => reject(new Error('Failed to get synced results'));
    });
  }

  // 获取同步失败的结果
  async getSyncFailedResults(): Promise<StoredVerificationResult[]> {
    await this.ensureDB();
    
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const transaction = this.db.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      const request = store.getAll();

      request.onsuccess = () => {
        const results = request.result || [];
        const failedResults = results.filter(result => result.syncStatus === 'sync_failed');
        resolve(failedResults);
      };

      request.onerror = () => reject(new Error('Failed to get sync failed results'));
    });
  }

  // 重置同步状态
  async resetSyncStatus(id: string): Promise<void> {
    await this.updateSyncStatus(id, 'pending');
  }

  // 批量重置同步状态
  async resetAllSyncStatus(): Promise<void> {
    const allResults = await this.getAllResults();
    const completedResults = allResults.filter(result => result.status === 'completed');
    
    for (const result of completedResults) {
      await this.resetSyncStatus(result.id);
    }
  }



  // 获取所有唯一的属性名
  async getAllPropertyNames(): Promise<string[]> {
    await this.ensureDB();
    
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const transaction = this.db.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      const request = store.getAll();

      request.onsuccess = () => {
        const results = request.result || [];
        const propertyNames = [...new Set(results.map(result => result.property))];
        propertyNames.sort();
        resolve(propertyNames);
      };

      request.onerror = () => reject(new Error('Failed to get property names'));
    });
  }
}

// 导出单例实例
export const verificationStorage = new VerificationStorageService(); 