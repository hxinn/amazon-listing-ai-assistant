import React, { useState, useEffect, useRef } from 'react';
import { verificationStorage, StoredVerificationResult } from '../services/storage';
import { syncService, BatchSyncResult, GroupedSyncData } from '../services/sync';
import DataSyncModal from '../components/DataSyncModal';
import SyncResultsModal from '../components/SyncResultsModal';

// 分组数据结构
interface PropertyGroup {
    propertyName: string;
    valueGroups: ValueGroup[];
    totalCount: number;
    successCount: number;
    failedCount: number;
    syncedCount: number;
}

interface ValueGroup {
    value: string;
    sites: SiteInfo[];
    totalCount: number;
    successCount: number;
    failedCount: number;
    syncedCount: number;
}

interface SiteInfo {
    site: string;
    productType: string;
    results: StoredVerificationResult[];
    successCount: number;
    failedCount: number;
    syncedCount: number;
}

interface VerificationResultsProps {}

const VerificationResults: React.FC<VerificationResultsProps> = () => {
    const [results, setResults] = useState<StoredVerificationResult[]>([]);
    const [filteredResults, setFilteredResults] = useState<StoredVerificationResult[]>([]);
    const [groupedData, setGroupedData] = useState<PropertyGroup[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [searchProperty, setSearchProperty] = useState<string>('');
    const [statusFilter, setStatusFilter] = useState<string>('all');
    const [selectedResult, setSelectedResult] = useState<StoredVerificationResult | null>(null);
    const [isEditing, setIsEditing] = useState<boolean>(false);
    const [editedData, setEditedData] = useState<string>('');
    const [currentPage, setCurrentPage] = useState<number>(1);
    const [itemsPerPage] = useState<number>(10);
    const [isExporting, setIsExporting] = useState<boolean>(false);
    const [expandedProperties, setExpandedProperties] = useState<Set<string>>(new Set());
    
    const [syncResults, setSyncResults] = useState<BatchSyncResult | null>(null);
    const [showSyncResultsModal, setShowSyncResultsModal] = useState<boolean>(false);
    
    // 数据同步相关状态
    const [propertyNames, setPropertyNames] = useState<string[]>([]);
    const [showDataSyncModal, setShowDataSyncModal] = useState<boolean>(false);
    


    // 按属性名和属性值分组数据
    const groupResultsByPropertyAndValue = (results: StoredVerificationResult[]): PropertyGroup[] => {
        const propertyMap = new Map<string, Map<string, Map<string, StoredVerificationResult[]>>>();
        
        // 按属性名 -> 属性值 -> 站点分组
        results.forEach(result => {
            if (!result.aiGeneratedData || result.status !== 'completed') return;
            
            try {
                const data = JSON.parse(result.aiGeneratedData);
                
                // 改进的属性值提取逻辑
                let value: string = '未知值';
                
                // 如果数据是数组，取第一个元素
                const firstItem = Array.isArray(data) ? data[0] : data;
                
                if (firstItem && typeof firstItem === 'object') {
                    // 尝试多种可能的属性值字段
                    const rawValue: any = firstItem.attribute_value || 
                                         firstItem.value || 
                                         firstItem.attributeValue ||
                                         firstItem.val ||
                                         firstItem.content ||
                                         firstItem.text;
                    
                    // 如果值是对象，尝试提取其中的 value 字段
                    if (rawValue && typeof rawValue === 'object') {
                        if (Array.isArray(rawValue) && rawValue.length > 0) {
                            // 如果是数组，取第一个元素
                            const firstValue = rawValue[0];
                            if (firstValue && typeof firstValue === 'object') {
                                value = firstValue.value || firstValue.content || firstValue.text || JSON.stringify(firstValue);
                            } else {
                                value = String(firstValue);
                            }
                        } else if (rawValue.value !== undefined) {
                            value = String(rawValue.value);
                        } else if (rawValue.content !== undefined) {
                            value = String(rawValue.content);
                        } else if (rawValue.text !== undefined) {
                            value = String(rawValue.text);
                        } else {
                            value = JSON.stringify(rawValue);
                        }
                    } else if (rawValue !== undefined && rawValue !== null) {
                        value = String(rawValue);
                    }
                    
                    // 如果仍然没有找到值，尝试使用整个对象的字符串表示
                    if (!value || value === '未知值') {
                        // 排除一些系统字段后，尝试找到实际的内容
                        const excludeFields = ['language_tag', 'marketplace_id', 'timestamp', 'id'];
                        const contentFields = Object.keys(firstItem).filter(key => !excludeFields.includes(key));
                        
                        if (contentFields.length > 0) {
                            const contentField = contentFields[0];
                            const contentValue = (firstItem as any)[contentField];
                            
                            if (typeof contentValue === 'string') {
                                value = contentValue;
                            } else if (contentValue && typeof contentValue === 'object') {
                                value = JSON.stringify(contentValue);
                            } else {
                                value = String(contentValue);
                            }
                        }
                    }
                } else if (typeof firstItem === 'string') {
                    value = firstItem;
                } else if (firstItem !== null && firstItem !== undefined) {
                    value = String(firstItem);
                }
                
                // 确保值不为空
                if (!value || value === 'undefined' || value === 'null') {
                    value = '未知值';
                }
                
                // 限制值的长度，避免过长的显示
                if (value.length > 200) {
                    value = value.substring(0, 200) + '...';
                }
                
                if (!propertyMap.has(result.property)) {
                    propertyMap.set(result.property, new Map());
                }
                
                const valueMap = propertyMap.get(result.property)!;
                if (!valueMap.has(value)) {
                    valueMap.set(value, new Map());
                }
                
                const siteMap = valueMap.get(value)!;
                const siteKey = `${result.site}_${result.productType}`;
                
                if (!siteMap.has(siteKey)) {
                    siteMap.set(siteKey, []);
                }
                
                siteMap.get(siteKey)!.push(result);
            } catch (error) {
                console.warn('解析AI数据失败:', error, 'Raw data:', result.aiGeneratedData);
            }
        });
        
        // 转换为展示格式
        const propertyGroups: PropertyGroup[] = [];
        
        propertyMap.forEach((valueMap, propertyName) => {
            const valueGroups: ValueGroup[] = [];
            let totalCount = 0;
            let successCount = 0;
            let failedCount = 0;
            let syncedCount = 0;
            
            valueMap.forEach((siteMap, value) => {
                const sites: SiteInfo[] = [];
                let valueTotal = 0;
                let valueSuccess = 0;
                let valueFailed = 0;
                let valueSynced = 0;
                
                siteMap.forEach((siteResults, siteKey) => {
                    const [site, productType] = siteKey.split('_');
                    const siteSuccess = siteResults.filter(r => r.status === 'completed').length;
                    const siteFailed = siteResults.filter(r => r.status === 'failed').length;
                    const siteSynced = siteResults.filter(r => r.syncStatus === 'synced').length;
                    
                    sites.push({
                        site,
                        productType,
                        results: siteResults,
                        successCount: siteSuccess,
                        failedCount: siteFailed,
                        syncedCount: siteSynced
                    });
                    
                    valueTotal += siteResults.length;
                    valueSuccess += siteSuccess;
                    valueFailed += siteFailed;
                    valueSynced += siteSynced;
                });
                
                valueGroups.push({
                    value,
                    sites: sites.sort((a, b) => a.site.localeCompare(b.site)),
                    totalCount: valueTotal,
                    successCount: valueSuccess,
                    failedCount: valueFailed,
                    syncedCount: valueSynced
                });
                
                totalCount += valueTotal;
                successCount += valueSuccess;
                failedCount += valueFailed;
                syncedCount += valueSynced;
            });
            
            propertyGroups.push({
                propertyName,
                valueGroups: valueGroups.sort((a, b) => b.totalCount - a.totalCount),
                totalCount,
                successCount,
                failedCount,
                syncedCount
            });
        });
        
        return propertyGroups.sort((a, b) => b.totalCount - a.totalCount);
    };

    // 加载所有验证结果
    const loadResults = async () => {
        try {
            setLoading(true);
            await verificationStorage.initDB();
            const allResults = await verificationStorage.getAllResults();
            // 按时间戳倒序排列，最新的在前面
            const sortedResults = allResults.sort((a, b) => b.timestamp - a.timestamp);
            setResults(sortedResults);
            setFilteredResults(sortedResults);
            
            // 生成分组数据
            const grouped = groupResultsByPropertyAndValue(sortedResults);
            setGroupedData(grouped);
            
            // 加载属性名列表
            const names = await verificationStorage.getAllPropertyNames();
            setPropertyNames(names);
        } catch (error) {
            console.error('加载验证结果失败:', error);
        } finally {
            setLoading(false);
        }
    };

    // 应用筛选条件
    const applyFilters = (searchValue: string = searchProperty, statusValue: string = statusFilter) => {
        setCurrentPage(1);
        
        let filtered = results;
        
        // 按属性名搜索
        if (searchValue.trim()) {
            filtered = filtered.filter(result => 
                result.property.toLowerCase().includes(searchValue.toLowerCase())
            );
        }
        
        // 按状态筛选
        if (statusValue !== 'all') {
            filtered = filtered.filter(result => result.status === statusValue);
        }
        
        setFilteredResults(filtered);
        
        // 重新生成分组数据
        const grouped = groupResultsByPropertyAndValue(filtered);
        setGroupedData(grouped);
    };

    // 切换属性展开状态
    const togglePropertyExpansion = (propertyName: string) => {
        const newExpanded = new Set(expandedProperties);
        if (newExpanded.has(propertyName)) {
            newExpanded.delete(propertyName);
        } else {
            newExpanded.add(propertyName);
        }
        setExpandedProperties(newExpanded);
    };





    // 按属性名搜索
    const handleSearch = (value: string) => {
        setSearchProperty(value);
        applyFilters(value, statusFilter);
    };

    // 按状态筛选
    const handleStatusFilter = (value: string) => {
        setStatusFilter(value);
        applyFilters(searchProperty, value);
    };

    // 格式化时间戳
    const formatTimestamp = (timestamp: number) => {
        return new Date(timestamp).toLocaleString('zh-CN');
    };

    // 格式化AI生成的数据（美化JSON）
    const formatAIData = (data: string) => {
        try {
            const parsed = JSON.parse(data);
            return JSON.stringify(parsed, null, 2);
        } catch {
            return data;
        }
    };

    // 打开编辑模态框
    const openEditModal = (result: StoredVerificationResult) => {
        setSelectedResult(result);
        setEditedData(formatAIData(result.aiGeneratedData));
        setIsEditing(true);
    };

    // 保存编辑结果
    const saveEdit = async () => {
        if (!selectedResult) return;

        try {
            // 验证JSON格式
            JSON.parse(editedData);
            
            const updatedResult: StoredVerificationResult = {
                ...selectedResult,
                aiGeneratedData: editedData,
                timestamp: Date.now()
            };

            await verificationStorage.saveResult(updatedResult);
            
            // 更新本地状态
            const updatedResults = results.map(r => 
                r.id === selectedResult.id ? updatedResult : r
            );
            setResults(updatedResults);
            
                    // 重新应用筛选条件
        applyFilters();
            
            setIsEditing(false);
            setSelectedResult(null);
        } catch (error) {
            alert('数据格式错误，请检查JSON格式是否正确');
        }
    };

    // 关闭模态框
    const closeModal = () => {
        setIsEditing(false);
        setSelectedResult(null);
        setEditedData('');
    };

    // 导出结果
    const handleExportResults = async () => {
        try {
            setIsExporting(true);

            if (results.length === 0) {
                alert('无可导出的验证结果数据');
                return;
            }

            // 格式化导出数据
            const jsonResults = results.map(result => {
                let parsedData = null;
                if (result.aiGeneratedData) {
                    try {
                        // 验证AI生成的数据是否为有效JSON
                        parsedData = JSON.parse(result.aiGeneratedData);
                    } catch (e) {
                        return {
                            property: result.property,
                            site: result.site,
                            productType: result.productType,
                            status: 'failed',
                            aiGeneratedData: null,
                            error: `无效JSON: ${e instanceof Error ? e.message : '未知解析错误'}`
                        };
                    }
                }

                return {
                    property: result.property,
                    site: result.site,
                    productType: result.productType,
                    status: result.status,
                    aiGeneratedData: parsedData,
                    error: result.error || null,
                    timestamp: result.timestamp,
                    language_tag: result.language_tag,
                    marketplace_id: result.marketplace_id
                };
            });

            // 创建JSON文件
            const jsonBlob = new Blob([JSON.stringify(jsonResults, null, 2)], { type: 'application/json' });
            const jsonUrl = URL.createObjectURL(jsonBlob);
            const jsonLink = document.createElement('a');
            jsonLink.href = jsonUrl;
            jsonLink.download = `amazon-property-verification-results-${new Date().toISOString().slice(0, 10)}.json`;

            // 创建CSV内容
            const csvHeader = 'Property,Site,ProductType,Status,Error,AIGeneratedData,Timestamp,LanguageTag,MarketplaceId\n';
            const csvRows = jsonResults.map(result => {
                const aiDataStr = result.aiGeneratedData ? JSON.stringify(result.aiGeneratedData).replace(/"/g, '""') : '';
                const timestamp = new Date(result.timestamp || 0).toISOString();
                return `"${result.property}","${result.site}","${result.productType}","${result.status}","${result.error || ''}","${aiDataStr}","${timestamp}","${result.language_tag || ''}","${result.marketplace_id || ''}"`;
            }).join('\n');
            const csvContent = csvHeader + csvRows;

            // 创建CSV文件
            const csvBlob = new Blob([csvContent], { type: 'text/csv' });
            const csvUrl = URL.createObjectURL(csvBlob);
            const csvLink = document.createElement('a');
            csvLink.href = csvUrl;
            csvLink.download = `amazon-property-verification-results-${new Date().toISOString().slice(0, 10)}.csv`;

            // 显示导出选项
            const choice = confirm('选择导出格式:\n确定 = JSON\n取消 = CSV');
            if (choice) {
                jsonLink.click();
                alert('JSON文件导出成功！');
            } else {
                csvLink.click();
                alert('CSV文件导出成功！');
            }

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : '未知错误';
            alert(`导出失败: ${errorMessage}`);
        } finally {
            setIsExporting(false);
        }
    };

    // 清空存储
    const handleClearStorage = async () => {
        if (!confirm('确定要清空所有存储的验证结果吗？此操作不可撤销。')) {
            return;
        }

        try {
            await verificationStorage.clearAllResults();
            await loadResults(); // 重新加载结果
            alert('所有存储的验证结果已清空');
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : '未知错误';
            alert(`清空存储失败: ${errorMessage}`);
        }
    };

    // 查看详情
    const viewDetails = (result: StoredVerificationResult) => {
        setSelectedResult(result);
        setEditedData(formatAIData(result.aiGeneratedData));
        setIsEditing(false);
    };

    // 关闭同步结果模态框
    const closeSyncResultsModal = () => {
        setShowSyncResultsModal(false);
        setSyncResults(null);
    };

    // 打开数据同步模态框
    const handleOpenDataSync = () => {
        setShowDataSyncModal(true);
    };

    // 关闭数据同步模态框
    const handleCloseDataSync = () => {
        setShowDataSyncModal(false);
    };

    // 处理同步完成
    const handleSyncComplete = (result: BatchSyncResult) => {
        setSyncResults(result);
        setShowSyncResultsModal(true);
    };

    // 分页逻辑 - 对分组数据进行分页
    const totalPages = Math.ceil(groupedData.length / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const currentGroups = groupedData.slice(startIndex, endIndex);

    useEffect(() => {
        loadResults();
    }, []);





    // 当results更新时重新应用筛选条件
    useEffect(() => {
        if (results.length > 0) {
            applyFilters();
        }
    }, [results]);

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center text-gray-200 custom-scrollbar" style={{ backgroundColor: '#0F172A' }}>
                <div className="flex flex-col items-center">
                    <div className="spinner"></div>
                    <p className="mt-4 text-gray-400">加载验证结果中...</p>
                </div>
            </div>
        );
    }

            return (
            <div className="min-h-screen text-gray-200 custom-scrollbar" style={{ backgroundColor: '#0F172A' }}>
            <div className="container mx-auto px-6 py-8">
                <header className="text-center mb-8">
                    <div className="flex items-center justify-center gap-2 mb-2">
                        <span className="material-icons text-6xl text-purple-400">analytics</span>
                        <h1 className="text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-blue-500">
                            AI验证结果数据
                        </h1>
                    </div>
                    <p className="text-gray-400">查看、搜索和编辑AI验证结果数据</p>
                </header>

                <main className="bg-gray-800/50 backdrop-blur-sm rounded-xl shadow-2xl p-6 md:p-8">
                    {/* 搜索栏 */}
                    <div className="mb-6">
                        <div className="flex items-end gap-4 mb-4">
                            <div className="flex-1">
                                <label className="block text-sm font-medium text-gray-300 mb-2">
                                    <span className="material-icons mr-1 text-purple-400 text-sm">search</span>
                                    按属性名搜索
                                </label>
                                <input
                                    type="text"
                                    value={searchProperty}
                                    onChange={(e) => handleSearch(e.target.value)}
                                    placeholder="输入属性名进行搜索..."
                                    className="w-full p-3 bg-gray-700 border border-gray-600 rounded-lg text-gray-200 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                                />
                            </div>
                            <div className="w-48">
                                <label className="block text-sm font-medium text-gray-300 mb-2">
                                    <span className="material-icons mr-1 text-purple-400 text-sm">filter_list</span>
                                    状态筛选
                                </label>
                                <select
                                    value={statusFilter}
                                    onChange={(e) => handleStatusFilter(e.target.value)}
                                    className="w-full p-3 bg-gray-700 border border-gray-600 rounded-lg text-gray-200 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                                >
                                    <option value="all">全部状态</option>
                                    <option value="completed">成功</option>
                                    <option value="failed">失败</option>
                                </select>
                            </div>
                            <div className="flex gap-2">
                                <button
                                    onClick={loadResults}
                                    className="bg-purple-500 hover:bg-purple-600 text-white px-4 py-3 rounded-lg transition-colors flex items-center gap-2"
                                >
                                    <span className="material-icons">refresh</span>
                                    刷新
                                </button>
                                <button
                                    onClick={handleExportResults}
                                    disabled={isExporting || results.length === 0}
                                    className={`${isExporting 
                                        ? 'bg-blue-600 hover:bg-blue-700' 
                                        : 'bg-blue-500 hover:bg-blue-600'} 
                                        text-white px-4 py-3 rounded-lg transition-colors flex items-center gap-2
                                        ${(isExporting || results.length === 0) ? 'opacity-50 cursor-not-allowed' : ''}`}
                                >
                                    <span className={`material-icons ${isExporting ? 'animate-spin' : ''}`}>
                                        {isExporting ? 'autorenew' : 'download'}
                                    </span>
                                    {isExporting ? '导出中...' : '导出结果'}
                                </button>

                                <button
                                    onClick={handleOpenDataSync}
                                    disabled={propertyNames.length === 0}
                                    className="bg-indigo-500 hover:bg-indigo-600 text-white px-4 py-3 rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <span className="material-icons">sync</span>
                                    数据同步
                                </button>
                                <button
                                    onClick={handleClearStorage}
                                    disabled={loading || results.length === 0}
                                    className="bg-red-500 hover:bg-red-600 text-white px-4 py-3 rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <span className="material-icons">delete_sweep</span>
                                    清空存储
                                </button>
                            </div>
                        </div>
                        
                        {/* 分组操作栏 */}
                        <div className="flex items-center justify-between p-4 bg-gray-900/60 rounded-lg">
                            <div className="flex items-center gap-2">
                                <span className="material-icons text-purple-400">view_module</span>
                                <span className="text-sm text-gray-300">分组视图</span>
                                <span className="text-xs text-gray-500">
                                    ({groupedData.length} 个属性分组)
                                </span>
                            </div>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => {
                                        if (expandedProperties.size === groupedData.length) {
                                            setExpandedProperties(new Set());
                                        } else {
                                            setExpandedProperties(new Set(groupedData.map(g => g.propertyName)));
                                        }
                                    }}
                                    className="text-sm bg-gray-700 hover:bg-gray-600 text-gray-300 px-3 py-1 rounded transition-colors flex items-center gap-1"
                                >
                                    <span className="material-icons text-sm">
                                        {expandedProperties.size === groupedData.length ? 'unfold_less' : 'unfold_more'}
                                    </span>
                                    {expandedProperties.size === groupedData.length ? '折叠全部' : '展开全部'}
                                </button>

                            </div>
                        </div>
                        
                        {/* 统计信息 */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-4 p-4 bg-gray-900/60 rounded-lg">
                            <div className="text-center">
                                <div className="text-2xl font-bold text-blue-400">{results.length}</div>
                                <div className="text-sm text-gray-400">总记录数</div>
                            </div>
                            <div className="text-center">
                                <div className="text-2xl font-bold text-purple-400">{groupedData.length}</div>
                                <div className="text-sm text-gray-400">属性分组</div>
                            </div>
                            <div className="text-center">
                                <div className="text-2xl font-bold text-indigo-400">
                                    {groupedData.reduce((sum, g) => sum + g.valueGroups.length, 0)}
                                </div>
                                <div className="text-sm text-gray-400">属性值组</div>
                            </div>
                            <div className="text-center">
                                <div className="text-2xl font-bold text-green-400">
                                    {results.filter(r => r.status === 'completed').length}
                                </div>
                                <div className="text-sm text-gray-400">成功记录</div>
                            </div>
                            <div className="text-center">
                                <div className="text-2xl font-bold text-red-400">
                                    {results.filter(r => r.status === 'failed').length}
                                </div>
                                <div className="text-sm text-gray-400">失败记录</div>
                            </div>
                            <div className="text-center">
                                <div className="text-2xl font-bold text-emerald-400">
                                    {results.filter(r => r.syncStatus === 'synced').length}
                                </div>
                                <div className="text-sm text-gray-400">已同步</div>
                            </div>
                            <div className="text-center">
                                <div className="text-2xl font-bold text-orange-400">
                                    {results.filter(r => r.syncStatus === 'sync_failed').length}
                                </div>
                                <div className="text-sm text-gray-400">同步失败</div>
                            </div>
                            <div className="text-center">
                                <div className="text-2xl font-bold text-cyan-400">{filteredResults.length}</div>
                                <div className="text-sm text-gray-400">当前显示</div>
                            </div>
                        </div>
                    </div>

                    {/* 分组数据展示 */}
                    <div className="space-y-3 custom-scrollbar">
                        {currentGroups.map((propertyGroup) => (
                            <div key={propertyGroup.propertyName} className="bg-gray-900/40 rounded-lg overflow-hidden">
                                {/* 属性名头部 */}
                                <div 
                                    className="px-4 py-3 bg-gray-800 border-b border-gray-700 cursor-pointer hover:bg-gray-750 transition-colors"
                                    onClick={() => togglePropertyExpansion(propertyGroup.propertyName)}
                                >
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <span className="material-icons text-purple-400 text-lg">
                                                {expandedProperties.has(propertyGroup.propertyName) ? 'expand_less' : 'expand_more'}
                                            </span>
                                            <div>
                                                <h3 className="text-lg font-bold text-blue-400 font-mono">
                                                    {propertyGroup.propertyName}
                                                </h3>
                                                <p className="text-sm text-gray-400">
                                                    {propertyGroup.valueGroups.length} 个不同值，共 {propertyGroup.totalCount} 条记录
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-4">
                                            <div className="flex items-center gap-2">
                                                <span className="w-3 h-3 bg-green-500 rounded-full"></span>
                                                <span className="text-sm text-gray-400">成功 {propertyGroup.successCount}</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className="w-3 h-3 bg-red-500 rounded-full"></span>
                                                <span className="text-sm text-gray-400">失败 {propertyGroup.failedCount}</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className="w-3 h-3 bg-emerald-500 rounded-full"></span>
                                                <span className="text-sm text-gray-400">已同步 {propertyGroup.syncedCount}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* 站点列表 */}
                                {expandedProperties.has(propertyGroup.propertyName) && (
                                    <div className="p-4">
                                        <div className="flex items-center gap-2 mb-4">
                                            <span className="material-icons text-sm text-blue-400">public</span>
                                            <span className="text-sm font-medium text-gray-300">站点列表</span>
                                        </div>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                                            {propertyGroup.valueGroups.flatMap(valueGroup => 
                                                valueGroup.sites.map((siteInfo) => (
                                                    <div 
                                                        key={`${siteInfo.site}_${siteInfo.productType}_${valueGroup.value}`} 
                                                        className="bg-gray-700/50 hover:bg-gray-700 rounded-lg p-3 cursor-pointer transition-all duration-200 border border-gray-600/30 hover:border-blue-500/50"
                                                        onClick={() => {
                                                            if (siteInfo.results.length > 0) {
                                                                openEditModal(siteInfo.results[0]);
                                                            }
                                                        }}
                                                    >
                                                        {/* 站点信息 */}
                                                        <div className="flex items-center justify-between mb-2">
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-sm font-medium text-blue-300">{siteInfo.site}</span>
                                                                <span className="text-xs text-gray-400 bg-gray-600 px-2 py-0.5 rounded-full">
                                                                    {siteInfo.productType}
                                                                </span>
                                                            </div>
                                                            <span className="material-icons text-sm text-gray-400 hover:text-blue-400 transition-colors">
                                                                edit
                                                            </span>
                                                        </div>
                                                        
                                                        {/* 属性值展示 */}
                                                        <div className="mb-3">
                                                            <div className="flex items-center gap-2 mb-1">
                                                                <span className="material-icons text-xs text-indigo-400">label</span>
                                                                <span className="text-xs font-medium text-indigo-300">属性值:</span>
                                                            </div>
                                                            <div className="bg-gray-900/50 rounded p-2 border border-gray-600/30">
                                                                <pre className="text-xs text-gray-300 font-mono whitespace-pre-wrap overflow-auto max-h-16 custom-scrollbar">
                                                                    {(() => {
                                                                        // 格式化显示属性值
                                                                        const value = valueGroup.value;
                                                                        
                                                                        // 如果值看起来像JSON，尝试格式化
                                                                        if (value.startsWith('{') || value.startsWith('[')) {
                                                                            try {
                                                                                const parsed = JSON.parse(value);
                                                                                return JSON.stringify(parsed, null, 2);
                                                                            } catch {
                                                                                return value;
                                                                            }
                                                                        }
                                                                        
                                                                        return value;
                                                                    })()}
                                                                </pre>
                                                            </div>
                                                        </div>
                                                        
                                                        {/* 统计信息 */}
                                                        <div className="flex items-center gap-2 text-xs">
                                                            <div className="flex items-center gap-1">
                                                                <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                                                                <span className="text-gray-400">{siteInfo.results.length}</span>
                                                            </div>
                                                            {siteInfo.successCount > 0 && (
                                                                <div className="flex items-center gap-1">
                                                                    <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                                                                    <span className="text-green-400">{siteInfo.successCount}</span>
                                                                </div>
                                                            )}
                                                            {siteInfo.failedCount > 0 && (
                                                                <div className="flex items-center gap-1">
                                                                    <span className="w-2 h-2 bg-red-500 rounded-full"></span>
                                                                    <span className="text-red-400">{siteInfo.failedCount}</span>
                                                                </div>
                                                            )}
                                                            {siteInfo.syncedCount > 0 && (
                                                                <div className="flex items-center gap-1">
                                                                    <span className="w-2 h-2 bg-emerald-500 rounded-full"></span>
                                                                    <span className="text-emerald-400">{siteInfo.syncedCount}</span>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                ))
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}

                        {currentGroups.length === 0 && (
                            <div className="text-center py-12 text-gray-400">
                                <span className="material-icons text-6xl mb-4 opacity-50">inbox</span>
                                <p className="text-lg">
                                    {searchProperty ? '未找到匹配的验证结果' : '暂无验证结果数据'}
                                </p>
                            </div>
                        )}
                    </div>

                    {/* 分页 */}
                    {totalPages > 1 && (
                        <div className="mt-6 flex justify-center items-center gap-4">
                            <button
                                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                                disabled={currentPage === 1}
                                className="px-4 py-2 bg-gray-700 text-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-600 transition-colors"
                            >
                                上一页
                            </button>
                            
                            <span className="text-gray-300">
                                第 {currentPage} 页，共 {totalPages} 页
                            </span>
                            
                            <button
                                onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                                disabled={currentPage === totalPages}
                                className="px-4 py-2 bg-gray-700 text-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-600 transition-colors"
                            >
                                下一页
                            </button>
                        </div>
                    )}
                </main>
            </div>







            {/* 数据同步组件 */}
            <DataSyncModal
                isOpen={showDataSyncModal}
                onClose={handleCloseDataSync}
                onSyncComplete={handleSyncComplete}
                propertyNames={propertyNames}
            />

            {/* 同步结果模态框 */}
            <SyncResultsModal
                isOpen={showSyncResultsModal}
                syncResults={syncResults}
                onClose={closeSyncResultsModal}
            />





            {/* 详情/编辑模态框 */}
            {selectedResult && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                    <div className="bg-gray-800 rounded-xl max-w-4xl w-full max-h-[80vh] overflow-hidden">
                        <div className="p-6 border-b border-gray-700">
                            <div className="flex items-center justify-between">
                                <h3 className="text-xl font-bold text-purple-400">
                                    {isEditing ? '编辑验证结果' : '验证结果详情'}
                                </h3>
                                <button
                                    onClick={closeModal}
                                    className="text-gray-400 hover:text-gray-300 transition-colors"
                                >
                                    <span className="material-icons">close</span>
                                </button>
                            </div>
                        </div>
                        
                        <div className="p-6 overflow-y-auto max-h-[60vh] custom-scrollbar">
                            {/* 基本信息 */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                                <div>
                                    <label className="block text-sm font-medium text-gray-400 mb-1">属性名</label>
                                    <div className="p-2 bg-gray-700 rounded text-blue-400 font-mono">
                                        {selectedResult.property}
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-400 mb-1">站点</label>
                                    <div className="p-2 bg-gray-700 rounded text-gray-300">
                                        {selectedResult.site}
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-400 mb-1">产品类型</label>
                                    <div className="p-2 bg-gray-700 rounded text-gray-300">
                                        {selectedResult.productType}
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                                <div>
                                    <label className="block text-sm font-medium text-gray-400 mb-1">状态</label>
                                    <div className="p-2 bg-gray-700 rounded">
                                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                            selectedResult.status === 'completed' 
                                                ? 'bg-green-900/50 text-green-400 border border-green-500/30'
                                                : 'bg-red-900/50 text-red-400 border border-red-500/30'
                                        }`}>
                                            {selectedResult.status === 'completed' ? '成功' : '失败'}
                                        </span>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-400 mb-1">同步状态</label>
                                    <div className="p-2 bg-gray-700 rounded">
                                        {selectedResult.syncStatus ? (
                                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                                selectedResult.syncStatus === 'synced' 
                                                    ? 'bg-green-900/50 text-green-400 border border-green-500/30'
                                                    : selectedResult.syncStatus === 'syncing'
                                                    ? 'bg-yellow-900/50 text-yellow-400 border border-yellow-500/30'
                                                    : selectedResult.syncStatus === 'sync_failed'
                                                    ? 'bg-red-900/50 text-red-400 border border-red-500/30'
                                                    : 'bg-gray-900/50 text-gray-400 border border-gray-500/30'
                                            }`}>
                                                {selectedResult.syncStatus === 'synced' ? '已同步' : 
                                                 selectedResult.syncStatus === 'syncing' ? '同步中' :
                                                 selectedResult.syncStatus === 'sync_failed' ? '同步失败' : '待同步'}
                                            </span>
                                        ) : (
                                            <span className="px-2 py-1 rounded-full text-xs font-medium bg-gray-900/50 text-gray-400 border border-gray-500/30">
                                                未同步
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-400 mb-1">更新时间</label>
                                    <div className="p-2 bg-gray-700 rounded text-gray-300">
                                        {formatTimestamp(selectedResult.timestamp)}
                                    </div>
                                </div>
                            </div>

                            {/* 同步时间和错误信息 */}
                            {selectedResult.syncTimestamp && (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-400 mb-1">同步时间</label>
                                        <div className="p-2 bg-gray-700 rounded text-gray-300">
                                            {formatTimestamp(selectedResult.syncTimestamp)}
                                        </div>
                                    </div>
                                    {selectedResult.syncError && (
                                        <div>
                                            <label className="block text-sm font-medium text-gray-400 mb-1">同步错误</label>
                                            <div className="p-2 bg-red-900/30 border border-red-500/30 rounded text-red-400">
                                                {selectedResult.syncError}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* 错误信息 */}
                            {selectedResult.error && (
                                <div className="mb-6">
                                    <label className="block text-sm font-medium text-gray-400 mb-1">错误信息</label>
                                    <div className="p-3 bg-red-900/30 border border-red-500/30 rounded text-red-400">
                                        {selectedResult.error}
                                    </div>
                                </div>
                            )}

                            {/* AI生成的数据 */}
                            <div>
                                <label className="block text-sm font-medium text-gray-400 mb-1">
                                    AI生成的数据 {isEditing && <span className="text-yellow-400">(可编辑)</span>}
                                </label>
                                {isEditing ? (
                                    <textarea
                                        value={editedData}
                                        onChange={(e) => setEditedData(e.target.value)}
                                        className="w-full h-64 p-3 bg-gray-900 border border-gray-600 rounded font-mono text-sm text-gray-300 focus:ring-2 focus:ring-purple-500 focus:border-transparent custom-scrollbar"
                                        placeholder="请输入有效的JSON数据..."
                                    />
                                ) : (
                                    <pre className="w-full h-64 p-3 bg-gray-900 border border-gray-600 rounded font-mono text-sm text-gray-300 overflow-auto custom-scrollbar">
                                        {editedData}
                                    </pre>
                                )}
                            </div>
                        </div>
                        
                        <div className="p-6 border-t border-gray-700 flex justify-end gap-4">
                            {isEditing ? (
                                <>
                                    <button
                                        onClick={closeModal}
                                        className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-gray-300 rounded-lg transition-colors"
                                    >
                                        取消
                                    </button>
                                    <button
                                        onClick={saveEdit}
                                        className="px-4 py-2 bg-purple-500 hover:bg-purple-600 text-white rounded-lg transition-colors"
                                    >
                                        保存
                                    </button>
                                </>
                            ) : (
                                <>
                                    <button
                                        onClick={closeModal}
                                        className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-gray-300 rounded-lg transition-colors"
                                    >
                                        关闭
                                    </button>
                                    <button
                                        onClick={() => {
                                            setIsEditing(true);
                                        }}
                                        className="px-4 py-2 bg-yellow-500 hover:bg-yellow-600 text-white rounded-lg transition-colors"
                                    >
                                        编辑
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}


        </div>
    );
};

export default VerificationResults; 