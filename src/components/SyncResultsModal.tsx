import React from 'react';
import { BatchSyncResult } from '../services/sync';

interface SyncResultsModalProps {
    isOpen: boolean;
    syncResults: BatchSyncResult | null;
    onClose: () => void;
}

const SyncResultsModal: React.FC<SyncResultsModalProps> = ({
    isOpen,
    syncResults,
    onClose
}) => {
    if (!isOpen || !syncResults) return null;

    const handleExportResults = () => {
        const jsonData = JSON.stringify(syncResults, null, 2);
        const blob = new Blob([jsonData], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `sync-results-${new Date().toISOString().slice(0, 10)}.json`;
        link.click();
        URL.revokeObjectURL(url);
    };

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-gray-800 rounded-xl max-w-5xl w-full max-h-[85vh] overflow-hidden shadow-2xl">
                {/* 头部 */}
                <div className="p-6 border-b border-gray-700 bg-gradient-to-r from-purple-900/30 to-indigo-900/30">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-purple-500/20 rounded-lg">
                                <span className="material-icons text-purple-400">analytics</span>
                            </div>
                            <div>
                                <h3 className="text-xl font-bold text-purple-400">同步结果报告</h3>
                                <p className="text-sm text-gray-400">数据同步的详细结果</p>
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className="text-gray-400 hover:text-gray-300 transition-colors p-2 hover:bg-gray-700 rounded-lg"
                        >
                            <span className="material-icons">close</span>
                        </button>
                    </div>
                </div>
                
                <div className="p-6 overflow-y-auto max-h-[65vh] custom-scrollbar">
                    {/* 统计信息 */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                        <div className="bg-blue-900/30 border border-blue-500/30 rounded-xl p-6 text-center">
                            <div className="flex items-center justify-center mb-3">
                                <div className="p-2 bg-blue-500/20 rounded-lg">
                                    <span className="material-icons text-blue-400">assessment</span>
                                </div>
                            </div>
                            <div className="text-3xl font-bold text-blue-400 mb-1">{syncResults.total}</div>
                            <div className="text-sm text-blue-300">总数</div>
                            <div className="text-xs text-gray-400 mt-1">处理的数据总量</div>
                        </div>
                        <div className="bg-green-900/30 border border-green-500/30 rounded-xl p-6 text-center">
                            <div className="flex items-center justify-center mb-3">
                                <div className="p-2 bg-green-500/20 rounded-lg">
                                    <span className="material-icons text-green-400">check_circle</span>
                                </div>
                            </div>
                            <div className="text-3xl font-bold text-green-400 mb-1">{syncResults.success}</div>
                            <div className="text-sm text-green-300">成功</div>
                            <div className="text-xs text-gray-400 mt-1">
                                成功率: {syncResults.total > 0 ? Math.round((syncResults.success / syncResults.total) * 100) : 0}%
                            </div>
                        </div>
                        <div className="bg-red-900/30 border border-red-500/30 rounded-xl p-6 text-center">
                            <div className="flex items-center justify-center mb-3">
                                <div className="p-2 bg-red-500/20 rounded-lg">
                                    <span className="material-icons text-red-400">error</span>
                                </div>
                            </div>
                            <div className="text-3xl font-bold text-red-400 mb-1">{syncResults.failed}</div>
                            <div className="text-sm text-red-300">失败</div>
                            <div className="text-xs text-gray-400 mt-1">
                                失败率: {syncResults.total > 0 ? Math.round((syncResults.failed / syncResults.total) * 100) : 0}%
                            </div>
                        </div>
                    </div>

                    {/* 进度条 */}
                    {syncResults.total > 0 && (
                        <div className="mb-6 p-4 bg-gray-900/50 rounded-lg">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-sm text-gray-400">整体进度</span>
                                <span className="text-sm text-gray-400">
                                    {syncResults.success + syncResults.failed} / {syncResults.total}
                                </span>
                            </div>
                            <div className="w-full bg-gray-700 rounded-full h-2 overflow-hidden">
                                <div className="h-2 rounded-full flex">
                                    <div 
                                        className="bg-green-500 transition-all duration-500"
                                        style={{ width: `${(syncResults.success / syncResults.total) * 100}%` }}
                                    ></div>
                                    <div 
                                        className="bg-red-500 transition-all duration-500"
                                        style={{ width: `${(syncResults.failed / syncResults.total) * 100}%` }}
                                    ></div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* 详细结果 */}
                    <div className="space-y-3">
                        <div className="flex items-center gap-2 mb-4">
                            <span className="material-icons text-purple-400">list</span>
                            <h4 className="text-lg font-medium text-gray-300">详细结果</h4>
                            <span className="text-sm text-gray-500">({syncResults.results.length} 项)</span>
                        </div>
                        
                        {syncResults.results.map((result, index) => (
                            <div 
                                key={index}
                                className={`p-4 rounded-lg border transition-all hover:shadow-lg ${
                                    result.success 
                                        ? 'bg-green-900/20 border-green-500/30 hover:bg-green-900/30' 
                                        : 'bg-red-900/20 border-red-500/30 hover:bg-red-900/30'
                                }`}
                            >
                                <div className="flex items-center justify-between mb-3">
                                    <div className="flex items-center gap-3">
                                        <div className={`p-2 rounded-lg ${
                                            result.success 
                                                ? 'bg-green-500/20' 
                                                : 'bg-red-500/20'
                                        }`}>
                                            <span className={`material-icons text-sm ${
                                                result.success ? 'text-green-400' : 'text-red-400'
                                            }`}>
                                                {result.success ? 'check_circle' : 'error'}
                                            </span>
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <span className="font-mono text-sm text-blue-400">
                                                    {result.property}
                                                </span>
                                                <span className="text-xs text-gray-500">
                                                    #{index + 1}
                                                </span>
                                            </div>
                                            <div className="text-xs text-gray-400 mt-1">
                                                {result.site} - {result.productType}
                                            </div>
                                        </div>
                                    </div>
                                    <span className={`text-xs px-3 py-1 rounded-full font-medium ${
                                        result.success 
                                            ? 'bg-green-900/50 text-green-400 border border-green-500/30' 
                                            : 'bg-red-900/50 text-red-400 border border-red-500/30'
                                    }`}>
                                        {result.success ? '同步成功' : '同步失败'}
                                    </span>
                                </div>
                                
                                <div className="bg-gray-800/50 rounded-lg p-3">
                                    <p className="text-sm text-gray-300">{result.message}</p>
                                    {result.error && (
                                        <div className="mt-2 p-2 bg-red-900/30 border border-red-500/30 rounded">
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="material-icons text-red-400 text-sm">error_outline</span>
                                                <span className="text-xs text-red-300 font-medium">错误详情</span>
                                            </div>
                                            <p className="text-sm text-red-400 font-mono">{result.error}</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
                
                {/* 底部操作栏 */}
                <div className="p-6 border-t border-gray-700 bg-gray-900/50">
                    <div className="flex items-center justify-between">
                        <div className="text-sm text-gray-400">
                            <span className="flex items-center gap-2">
                                <span className="material-icons text-purple-400 text-sm">schedule</span>
                                同步完成时间: {new Date().toLocaleString('zh-CN')}
                            </span>
                        </div>
                        <div className="flex gap-3">
                            <button
                                onClick={handleExportResults}
                                className="px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg transition-colors flex items-center gap-2"
                            >
                                <span className="material-icons text-sm">download</span>
                                导出结果
                            </button>
                            <button
                                onClick={onClose}
                                className="px-6 py-2 bg-purple-500 hover:bg-purple-600 text-white rounded-lg transition-colors flex items-center gap-2"
                            >
                                <span className="material-icons text-sm">close</span>
                                关闭
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SyncResultsModal; 