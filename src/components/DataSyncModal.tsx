import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { verificationStorage } from '../services/storage';
import { syncService, BatchSyncResult } from '../services/sync';

interface DataSyncModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSyncComplete: (results: BatchSyncResult) => void;
    propertyNames: string[];
}

const DataSyncModal: React.FC<DataSyncModalProps> = ({
    isOpen,
    onClose,
    onSyncComplete,
    propertyNames
}) => {
    const [syncMode, setSyncMode] = useState<'single' | 'batch'>('single');
    const [selectedPropertyName, setSelectedPropertyName] = useState<string>('');
    const [propertySearchText, setPropertySearchText] = useState<string>('');
    const [filteredPropertyNames, setFilteredPropertyNames] = useState<string[]>([]);
    const [showPropertyDropdown, setShowPropertyDropdown] = useState<boolean>(false);
    const [isPropertySyncing, setIsPropertySyncing] = useState<boolean>(false);
    const [propertySyncProgress, setPropertySyncProgress] = useState<{ 
        current: number; 
        total: number; 
        currentItem?: string 
    }>({ current: 0, total: 0 });
    
    const inputRef = useRef<HTMLInputElement>(null);
    const inputContainerRef = useRef<HTMLDivElement>(null);
    const [dropdownPosition, setDropdownPosition] = useState<{ 
        top: number; 
        left: number; 
        width: number 
    }>({ top: 0, left: 0, width: 0 });

    // 初始化属性名列表
    useEffect(() => {
        setFilteredPropertyNames(propertyNames);
    }, [propertyNames]);

    // 计算并更新下拉框位置
    const updateDropdownPosition = () => {
        if (inputContainerRef.current) {
            const rect = inputContainerRef.current.getBoundingClientRect();
            setDropdownPosition({
                top: rect.bottom + window.scrollY,
                left: rect.left + window.scrollX,
                width: rect.width
            });
        }
    };

    // 处理属性名搜索
    const handlePropertySearch = (searchText: string) => {
        setPropertySearchText(searchText);
        if (searchText.trim() === '') {
            setFilteredPropertyNames(propertyNames);
        } else {
            const filtered = propertyNames.filter(name => 
                name.toLowerCase().includes(searchText.toLowerCase())
            );
            setFilteredPropertyNames(filtered);
        }
        
        updateDropdownPosition();
        setShowPropertyDropdown(true);
    };

    // 选择属性名
    const handleSelectProperty = (propertyName: string) => {
        setSelectedPropertyName(propertyName);
        setPropertySearchText(propertyName);
        setShowPropertyDropdown(false);
    };

    // 清空属性名选择
    const handleClearPropertySelection = () => {
        setSelectedPropertyName('');
        setPropertySearchText('');
        setFilteredPropertyNames(propertyNames);
        setShowPropertyDropdown(false);
    };



    // 执行单个属性同步
    const handleSinglePropertySync = async () => {
        if (!selectedPropertyName) {
            alert('请选择要同步的属性名');
            return;
        }

        setIsPropertySyncing(true);
        setPropertySyncProgress({ current: 0, total: 0 });

        try {
            const result = await syncService.syncByProperty(
                selectedPropertyName,
                (current, total, currentItem) => {
                    setPropertySyncProgress({
                        current,
                        total,
                        currentItem: `${currentItem.attributeName} (${currentItem.sites.join(', ')})`
                    });
                }
            );

            onSyncComplete(result);
            onClose();

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : '未知错误';
            alert(`按属性名同步失败: ${errorMessage}`);
        } finally {
            setIsPropertySyncing(false);
            setPropertySyncProgress({ current: 0, total: 0 });
        }
    };

    // 执行批量属性同步
    const handleBatchPropertySync = async () => {
        setIsPropertySyncing(true);
        setPropertySyncProgress({ current: 0, total: 0 });

        try {
            const result = await syncService.syncAllByProperty(
                (current, total, currentItem) => {
                    setPropertySyncProgress({
                        current,
                        total,
                        currentItem: currentItem ? `${currentItem.attributeName} (${currentItem.sites.join(', ')})` : undefined
                    });
                }
            );

            onSyncComplete(result);
            onClose();

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : '未知错误';
            alert(`全量按属性名同步失败: ${errorMessage}`);
        } finally {
            setIsPropertySyncing(false);
            setPropertySyncProgress({ current: 0, total: 0 });
        }
    };

    // 关闭模态框
    const handleClose = () => {
        if (isPropertySyncing) return;
        
        setSelectedPropertyName('');
        setPropertySearchText('');
        setShowPropertyDropdown(false);
        setSyncMode('single');
        onClose();
    };

    // 点击外部关闭下拉框
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            const target = event.target as HTMLElement;
            if (!inputRef.current?.contains(target) && 
                !target.closest('[data-dropdown="property-dropdown"]')) {
                setShowPropertyDropdown(false);
            }
        };

        const handleWindowResize = () => {
            if (showPropertyDropdown) {
                updateDropdownPosition();
            }
        };

        const handleScroll = () => {
            if (showPropertyDropdown) {
                updateDropdownPosition();
            }
        };

        if (showPropertyDropdown) {
            document.addEventListener('mousedown', handleClickOutside);
            window.addEventListener('resize', handleWindowResize);
            window.addEventListener('scroll', handleScroll, true);
        }
        
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            window.removeEventListener('resize', handleWindowResize);
            window.removeEventListener('scroll', handleScroll, true);
        };
    }, [showPropertyDropdown]);

    if (!isOpen) return null;

    return (
        <>
            {/* 同步进度模态框 */}
            {isPropertySyncing && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[60]">
                    <div className="bg-gray-800 rounded-xl max-w-lg w-full p-8 shadow-2xl border border-indigo-500/20">
                        <div className="text-center">
                            {/* 动画图标 */}
                            <div className="flex items-center justify-center mb-6">
                                <div className="relative">
                                    <div className="w-16 h-16 bg-indigo-500/20 rounded-full flex items-center justify-center">
                                        <span className="material-icons text-3xl text-indigo-400 animate-spin">sync</span>
                                    </div>
                                    <div className="absolute -top-2 -right-2 w-6 h-6 bg-green-500 rounded-full flex items-center justify-center animate-pulse">
                                        <span className="material-icons text-white text-sm">cloud_upload</span>
                                    </div>
                                </div>
                            </div>
                            
                            {/* 标题 */}
                            <h3 className="text-2xl font-bold text-indigo-400 mb-2">
                                {syncMode === 'single' ? '正在同步属性数据' : '正在全量同步数据'}
                            </h3>
                            <p className="text-gray-400 mb-6">
                                {syncMode === 'single' 
                                    ? '将选定属性的分组数据同步到服务器，请稍候...'
                                    : '将所有属性的分组数据同步到服务器，请稍候...'
                                }
                            </p>
                            
                            {/* 进度信息 */}
                            {propertySyncProgress.total > 0 && (
                                <div className="mb-6">
                                    {/* 进度数字 */}
                                    <div className="flex justify-between items-center mb-3">
                                        <span className="text-sm text-gray-400">
                                            进度: {propertySyncProgress.current} / {propertySyncProgress.total}
                                        </span>
                                        <span className="text-lg font-bold text-indigo-400">
                                            {Math.round((propertySyncProgress.current / propertySyncProgress.total) * 100)}%
                                        </span>
                                    </div>
                                    
                                    {/* 进度条 */}
                                    <div className="w-full bg-gray-700 rounded-full h-3 mb-4 overflow-hidden">
                                        <div 
                                            className="bg-gradient-to-r from-indigo-500 to-purple-500 h-3 rounded-full transition-all duration-500 ease-out relative"
                                            style={{ width: `${(propertySyncProgress.current / propertySyncProgress.total) * 100}%` }}
                                        >
                                            <div className="absolute inset-0 bg-white/20 animate-pulse"></div>
                                        </div>
                                    </div>
                                    
                                    {/* 当前处理项 */}
                                    {propertySyncProgress.currentItem && (
                                        <div className="bg-gray-900/50 rounded-lg p-4 border border-indigo-500/20">
                                            <div className="flex items-center gap-2 mb-2">
                                                <span className="material-icons text-indigo-400 text-sm animate-pulse">sync</span>
                                                <span className="text-sm font-medium text-gray-300">正在处理:</span>
                                            </div>
                                            <p className="text-sm text-indigo-300 font-mono bg-gray-800/50 rounded px-3 py-2">
                                                {propertySyncProgress.currentItem}
                                            </p>
                                        </div>
                                    )}
                                </div>
                            )}
                            
                            {/* 状态提示 */}
                            <div className="flex items-center justify-center gap-2 text-gray-400">
                                <div className="flex space-x-1">
                                    <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce"></div>
                                    <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                                    <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                                </div>
                                <span className="text-sm">数据同步中，请勿关闭页面</span>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* 主同步选择模态框 */}
            {!isPropertySyncing && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-[55]">
                    <div className="bg-gray-800 rounded-xl max-w-5xl w-full max-h-[90vh] overflow-hidden shadow-2xl">
                        {/* 头部 */}
                        <div className="p-6 border-b border-gray-700 bg-gradient-to-r from-indigo-900/30 to-purple-900/30">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-indigo-500/20 rounded-lg">
                                        <span className="material-icons text-indigo-400">sync</span>
                                    </div>
                                    <div>
                                        <h3 className="text-xl font-bold text-indigo-400">数据同步</h3>
                                        <p className="text-sm text-gray-400">选择同步方式并将数据同步到服务器</p>
                                    </div>
                                </div>
                                <button
                                    onClick={handleClose}
                                    className="text-gray-400 hover:text-gray-300 transition-colors p-2 hover:bg-gray-700 rounded-lg"
                                >
                                    <span className="material-icons">close</span>
                                </button>
                            </div>
                        </div>
                        
                        <div className="p-6 overflow-y-auto max-h-[70vh] custom-scrollbar">
                            {/* 同步模式选择 */}
                            <div className="mb-6">
                                <div className="flex items-center gap-2 mb-4">
                                    <span className="material-icons text-indigo-400">tune</span>
                                    <label className="text-sm font-medium text-gray-300">选择同步方式</label>
                                </div>
                                
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {/* 单个属性同步 */}
                                    <div 
                                        className={`p-6 rounded-xl border-2 cursor-pointer transition-all ${
                                            syncMode === 'single' 
                                                ? 'border-indigo-500 bg-indigo-900/20' 
                                                : 'border-gray-600 hover:border-indigo-400 hover:bg-indigo-900/10'
                                        }`}
                                        onClick={() => setSyncMode('single')}
                                    >
                                        <div className="flex items-center gap-3 mb-3">
                                            <div className={`p-2 rounded-lg ${
                                                syncMode === 'single' ? 'bg-indigo-500/20' : 'bg-gray-700'
                                            }`}>
                                                <span className={`material-icons ${
                                                    syncMode === 'single' ? 'text-indigo-400' : 'text-gray-400'
                                                }`}>
                                                    filter_1
                                                </span>
                                            </div>
                                            <div>
                                                <h4 className={`font-bold ${
                                                    syncMode === 'single' ? 'text-indigo-400' : 'text-gray-300'
                                                }`}>
                                                    选择属性名同步
                                                </h4>
                                                <p className="text-sm text-gray-400">同步指定属性的所有数据</p>
                                            </div>
                                        </div>
                                        
                                        <div className="text-sm text-gray-400 space-y-2">
                                            <div className="flex items-center gap-2">
                                                <span className="material-icons text-xs text-green-400">check</span>
                                                <span>精确控制同步范围</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className="material-icons text-xs text-green-400">check</span>
                                                <span>快速同步单个属性</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className="material-icons text-xs text-green-400">check</span>
                                                <span>可预览同步内容</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* 全量属性同步 */}
                                    <div 
                                        className={`p-6 rounded-xl border-2 cursor-pointer transition-all ${
                                            syncMode === 'batch' 
                                                ? 'border-purple-500 bg-purple-900/20' 
                                                : 'border-gray-600 hover:border-purple-400 hover:bg-purple-900/10'
                                        }`}
                                        onClick={() => setSyncMode('batch')}
                                    >
                                        <div className="flex items-center gap-3 mb-3">
                                            <div className={`p-2 rounded-lg ${
                                                syncMode === 'batch' ? 'bg-purple-500/20' : 'bg-gray-700'
                                            }`}>
                                                <span className={`material-icons ${
                                                    syncMode === 'batch' ? 'text-purple-400' : 'text-gray-400'
                                                }`}>
                                                    select_all
                                                </span>
                                            </div>
                                            <div>
                                                <h4 className={`font-bold ${
                                                    syncMode === 'batch' ? 'text-purple-400' : 'text-gray-300'
                                                }`}>
                                                    全量按属性名同步
                                                </h4>
                                                <p className="text-sm text-gray-400">同步所有属性的数据</p>
                                            </div>
                                        </div>
                                        
                                        <div className="text-sm text-gray-400 space-y-2">
                                            <div className="flex items-center gap-2">
                                                <span className="material-icons text-xs text-purple-400">check</span>
                                                <span>一次性同步所有数据</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className="material-icons text-xs text-purple-400">check</span>
                                                <span>自动处理所有属性</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className="material-icons text-xs text-purple-400">check</span>
                                                <span>适合批量操作</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* 单个属性选择区域 */}
                            {syncMode === 'single' && (
                                <div className="mb-6">
                                    <div className="flex items-center gap-2 mb-3">
                                        <span className="material-icons text-indigo-400">search</span>
                                        <label className="text-sm font-medium text-gray-300">
                                            选择要同步的属性名
                                        </label>
                                        <span className="text-xs text-gray-500">
                                            ({propertyNames.length} 个可用属性)
                                        </span>
                                    </div>
                                    
                                    <div className="relative property-dropdown-container" style={{ zIndex: 60 }}>
                                        <div ref={inputContainerRef} className="flex">
                                            <div className="relative flex-1">
                                                <input
                                                    ref={inputRef}
                                                    type="text"
                                                    value={propertySearchText}
                                                    onChange={(e) => handlePropertySearch(e.target.value)}
                                                    onFocus={() => {
                                                        updateDropdownPosition();
                                                        setShowPropertyDropdown(true);
                                                    }}
                                                    placeholder="输入属性名进行搜索..."
                                                    className="w-full p-3 pl-10 bg-gray-700 border border-gray-600 rounded-l-lg text-gray-200 focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                                                />
                                                <span className="material-icons absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 text-sm">
                                                    search
                                                </span>
                                            </div>
                                            {selectedPropertyName && (
                                                <button
                                                    onClick={handleClearPropertySelection}
                                                    className="px-4 bg-gray-600 hover:bg-gray-500 border border-l-0 border-gray-600 text-gray-400 hover:text-gray-200 transition-colors flex items-center gap-2"
                                                    title="清空选择"
                                                >
                                                    <span className="material-icons text-sm">clear</span>
                                                    <span className="text-sm">清空</span>
                                                </button>
                                            )}
                                            <button
                                                onClick={() => {
                                                    if (!showPropertyDropdown) {
                                                        updateDropdownPosition();
                                                    }
                                                    setShowPropertyDropdown(!showPropertyDropdown);
                                                }}
                                                className="px-4 bg-indigo-600 hover:bg-indigo-500 border border-l-0 border-indigo-600 rounded-r-lg text-white transition-colors flex items-center gap-2"
                                                title={showPropertyDropdown ? "收起选项" : "展开选项"}
                                            >
                                                <span className="material-icons text-sm">
                                                    {showPropertyDropdown ? 'expand_less' : 'expand_more'}
                                                </span>
                                            </button>
                                        </div>
                                        
                                        {/* 下拉选项 */}
                                        {showPropertyDropdown && createPortal(
                                            <div 
                                                data-dropdown="property-dropdown"
                                                className="fixed z-[70] bg-gray-700 border border-gray-600 rounded-lg shadow-xl max-h-64 overflow-y-auto custom-scrollbar"
                                                style={{
                                                    top: dropdownPosition.top + 4,
                                                    left: dropdownPosition.left,
                                                    width: dropdownPosition.width,
                                                    minWidth: '400px'
                                                }}
                                            >
                                                {filteredPropertyNames.length > 0 ? (
                                                    <>
                                                        <div className="sticky top-0 bg-gray-800 px-4 py-2 border-b border-gray-600 text-xs text-gray-400">
                                                            找到 {filteredPropertyNames.length} 个属性
                                                        </div>
                                                        {filteredPropertyNames.map(name => (
                                                            <div
                                                                key={name}
                                                                onClick={() => handleSelectProperty(name)}
                                                                className={`px-4 py-3 cursor-pointer hover:bg-gray-600 transition-colors border-l-4 ${
                                                                    selectedPropertyName === name 
                                                                        ? 'bg-indigo-600 text-white border-indigo-400' 
                                                                        : 'text-gray-200 border-transparent hover:border-indigo-500'
                                                                }`}
                                                            >
                                                                <div className="flex items-center justify-between">
                                                                    <div className="font-mono text-sm">{name}</div>
                                                                    {selectedPropertyName === name && (
                                                                        <span className="material-icons text-sm">check</span>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </>
                                                ) : (
                                                    <div className="px-4 py-8 text-gray-400 text-center">
                                                        <span className="material-icons text-4xl mb-2 opacity-50">search_off</span>
                                                        <p>没有找到匹配的属性名</p>
                                                        <p className="text-xs mt-1">请尝试其他搜索词</p>
                                                    </div>
                                                )}
                                            </div>,
                                            document.body
                                        )}
                                    </div>

                                    {/* 单个属性预览信息 */}
                                    {selectedPropertyName && (
                                        <div className="mt-4 p-4 bg-gradient-to-br from-gray-900/60 to-indigo-900/20 rounded-xl border border-indigo-500/20">
                                            <div className="flex items-center gap-3 mb-3">
                                                <div className="p-2 bg-indigo-500/20 rounded-lg">
                                                    <span className="material-icons text-indigo-400">preview</span>
                                                </div>
                                                <h4 className="text-lg font-bold text-indigo-400">同步预览</h4>
                                            </div>
                                            <PropertyPreview propertyName={selectedPropertyName} />
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* 全量同步预览 */}
                            {syncMode === 'batch' && (
                                <div className="mb-6">
                                    <div className="flex items-center gap-2 mb-4">
                                        <span className="material-icons text-purple-400">preview</span>
                                        <h4 className="text-lg font-bold text-purple-400">全量同步预览</h4>
                                    </div>
                                    <BatchSyncPreview />
                                </div>
                            )}
                        </div>
                        
                        {/* 底部操作栏 */}
                        <div className="p-6 border-t border-gray-700 bg-gray-900/50">
                            <div className="flex items-center justify-between">
                                <div className="text-sm text-gray-400">
                                    {syncMode === 'single' ? (
                                        selectedPropertyName ? (
                                            <span className="flex items-center gap-2">
                                                <span className="material-icons text-green-400 text-sm">check_circle</span>
                                                已选择属性: <span className="font-mono text-indigo-400">{selectedPropertyName}</span>
                                            </span>
                                        ) : (
                                            <span className="flex items-center gap-2">
                                                <span className="material-icons text-orange-400 text-sm">warning</span>
                                                请选择要同步的属性名
                                            </span>
                                        )
                                    ) : (
                                        <span className="flex items-center gap-2">
                                            <span className="material-icons text-purple-400 text-sm">select_all</span>
                                            将同步所有属性的数据
                                        </span>
                                    )}
                                </div>
                                <div className="flex gap-3">
                                    <button
                                        onClick={handleClose}
                                        className="px-6 py-2 bg-gray-600 hover:bg-gray-700 text-gray-300 rounded-lg transition-colors flex items-center gap-2"
                                    >
                                        <span className="material-icons text-sm">close</span>
                                        取消
                                    </button>
                                    <button
                                        onClick={syncMode === 'single' ? handleSinglePropertySync : handleBatchPropertySync}
                                        disabled={syncMode === 'single' && !selectedPropertyName}
                                        className={`px-6 py-2 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 ${
                                            syncMode === 'single' 
                                                ? 'bg-indigo-500 hover:bg-indigo-600' 
                                                : 'bg-purple-500 hover:bg-purple-600'
                                        } text-white`}
                                    >
                                        <span className="material-icons text-sm">sync</span>
                                        {syncMode === 'single' ? '开始同步' : '开始全量同步'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

// 属性预览组件
const PropertyPreview: React.FC<{ propertyName: string }> = ({ propertyName }) => {
    const [preview, setPreview] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const loadPreview = async () => {
            try {
                const results = await verificationStorage.getAllResults();
                const propertyResults = results.filter(r => 
                    r.property === propertyName && 
                    r.status === 'completed' && 
                    r.aiGeneratedData
                );
                
                const groupedData = syncService.groupResultsByProperty(propertyName, propertyResults);
                setPreview({
                    totalResults: propertyResults.length,
                    groupCount: groupedData.length,
                    sites: [...new Set(propertyResults.map(r => r.site))],
                    groupedData
                });
            } catch (error) {
                console.error('加载预览失败:', error);
            } finally {
                setLoading(false);
            }
        };

        loadPreview();
    }, [propertyName]);

    if (loading) {
        return (
            <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-400"></div>
            </div>
        );
    }

    if (!preview) return null;

    return (
        <div className="space-y-4">
            {/* 统计卡片 */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-blue-900/30 border border-blue-500/30 rounded-lg p-4 text-center">
                    <div className="text-2xl font-bold text-blue-400 mb-1">{preview.totalResults}</div>
                    <div className="text-sm text-blue-300">总记录数</div>
                </div>
                <div className="bg-green-900/30 border border-green-500/30 rounded-lg p-4 text-center">
                    <div className="text-2xl font-bold text-green-400 mb-1">{preview.groupCount}</div>
                    <div className="text-sm text-green-300">分组数</div>
                </div>
                <div className="bg-purple-900/30 border border-purple-500/30 rounded-lg p-4 text-center">
                    <div className="text-2xl font-bold text-purple-400 mb-1">{preview.sites.length}</div>
                    <div className="text-sm text-purple-300">站点数</div>
                </div>
            </div>
            
            {/* 站点标签 */}
            <div>
                <div className="flex items-center gap-2 mb-2">
                    <span className="material-icons text-indigo-400 text-sm">language</span>
                    <div className="text-sm font-medium text-gray-300">涉及站点</div>
                </div>
                <div className="flex flex-wrap gap-2">
                    {preview.sites.map((site: string) => (
                        <span key={site} className="px-3 py-1 bg-indigo-900/50 text-indigo-300 rounded-full text-sm border border-indigo-500/30">
                            {site}
                        </span>
                    ))}
                </div>
            </div>
        </div>
    );
};

// 批量同步预览组件
const BatchSyncPreview: React.FC = () => {
    const [preview, setPreview] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const loadPreview = async () => {
            try {
                const results = await verificationStorage.getAllResults();
                const completedResults = results.filter(r => r.status === 'completed' && r.aiGeneratedData);
                const properties = [...new Set(completedResults.map(r => r.property))];
                
                let totalGroups = 0;
                const sites = new Set<string>();
                
                for (const property of properties) {
                    const propertyResults = completedResults.filter(r => r.property === property);
                    const groupedData = syncService.groupResultsByProperty(property, propertyResults);
                    totalGroups += groupedData.length;
                    propertyResults.forEach(r => sites.add(r.site));
                }
                
                setPreview({
                    totalResults: completedResults.length,
                    propertyCount: properties.length,
                    groupCount: totalGroups,
                    sites: Array.from(sites),
                    properties: properties.slice(0, 10) // 只显示前10个属性
                });
            } catch (error) {
                console.error('加载预览失败:', error);
            } finally {
                setLoading(false);
            }
        };

        loadPreview();
    }, []);

    if (loading) {
        return (
            <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-400"></div>
            </div>
        );
    }

    if (!preview) return null;

    return (
        <div className="space-y-4">
            {/* 统计卡片 */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-blue-900/30 border border-blue-500/30 rounded-lg p-4 text-center">
                    <div className="text-2xl font-bold text-blue-400 mb-1">{preview.totalResults}</div>
                    <div className="text-sm text-blue-300">总记录数</div>
                </div>
                <div className="bg-green-900/30 border border-green-500/30 rounded-lg p-4 text-center">
                    <div className="text-2xl font-bold text-green-400 mb-1">{preview.propertyCount}</div>
                    <div className="text-sm text-green-300">属性数量</div>
                </div>
                <div className="bg-purple-900/30 border border-purple-500/30 rounded-lg p-4 text-center">
                    <div className="text-2xl font-bold text-purple-400 mb-1">{preview.groupCount}</div>
                    <div className="text-sm text-purple-300">总分组数</div>
                </div>
                <div className="bg-orange-900/30 border border-orange-500/30 rounded-lg p-4 text-center">
                    <div className="text-2xl font-bold text-orange-400 mb-1">{preview.sites.length}</div>
                    <div className="text-sm text-orange-300">站点数</div>
                </div>
            </div>
            
            {/* 属性列表预览 */}
            <div>
                <div className="flex items-center gap-2 mb-2">
                    <span className="material-icons text-purple-400 text-sm">list</span>
                    <div className="text-sm font-medium text-gray-300">
                        属性列表预览 (前10个)
                    </div>
                </div>
                <div className="flex flex-wrap gap-2">
                    {preview.properties.map((property: string) => (
                        <span key={property} className="px-3 py-1 bg-purple-900/50 text-purple-300 rounded-full text-sm border border-purple-500/30 font-mono">
                            {property}
                        </span>
                    ))}
                    {preview.propertyCount > 10 && (
                        <span className="px-3 py-1 bg-gray-700 text-gray-400 rounded-full text-sm">
                            +{preview.propertyCount - 10} 更多...
                        </span>
                    )}
                </div>
            </div>
        </div>
    );
};

export default DataSyncModal; 