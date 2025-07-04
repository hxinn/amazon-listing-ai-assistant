import React from 'react';
import { Link } from 'react-router-dom';

const HomePage: React.FC = () => {
  return (
    <div className="w-full min-h-screen text-gray-200" style={{ background: '#0f172a' }}>
      {/* Glowing effects */}
      <div className="absolute top-0 left-0 w-[200px] h-[200px] rounded-full bg-blue-500 filter blur-[80px] opacity-30 z-0"></div>
      <div className="absolute bottom-0 right-0 w-[200px] h-[200px] rounded-full bg-purple-500 filter blur-[80px] opacity-30 z-0"></div>

      <main className="container mx-auto px-6 py-20 relative z-10">
        <div className="text-center mb-20">
          <div className="flex items-center justify-center mb-6">
            <span className="material-icons text-6xl text-cyan-400 mr-4 animate-pulse">hub</span>
            <h1 className="text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500">Amazon Listing AI Assistant</h1>
          </div>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-12">
          {/* Intelligent Property Parsing Card */}
          <Link className="group" to="/intelligent-parsing">
            <div className="p-8 rounded-2xl transform hover:-translate-y-2 transition-all duration-300 ease-in-out text-center h-full flex flex-col justify-between"
                 style={{ 
                   background: 'rgba(30, 41, 59, 0.5)', 
                   backdropFilter: 'blur(10px)',
                   border: '1px solid rgba(51, 65, 85, 0.5)'
                 }}>
              <div>
                <div className="flex justify-center items-center mb-6">
                  <span className="material-icons text-8xl text-cyan-400 group-hover:text-cyan-300 transition-colors">schema</span>
                </div>
                <h2 className="text-2xl font-bold text-gray-100 mb-3">智能属性解析</h2>
                <p className="text-gray-400">基于JSON Schema和您的输入，智能生成精准的产品数据。</p>
              </div>
              <div className="mt-6">
                <span className="inline-flex items-center px-4 py-2 text-sm font-medium text-cyan-300 bg-cyan-900/50 rounded-full">核心功能</span>
              </div>
            </div>
          </Link>

          {/* Automated Property Verification Card */}
          <Link className="group" to="/automated-verification">
            <div className="p-8 rounded-2xl transform hover:-translate-y-2 transition-all duration-300 ease-in-out text-center h-full flex flex-col justify-between"
                 style={{ 
                   background: 'rgba(30, 41, 59, 0.5)', 
                   backdropFilter: 'blur(10px)',
                   border: '1px solid rgba(51, 65, 85, 0.5)'
                 }}>
              <div>
                <div className="flex justify-center items-center mb-6">
                  <span className="material-icons text-8xl text-teal-400 group-hover:text-teal-300 transition-colors">rule_folder</span>
                </div>
                <h2 className="text-2xl font-bold text-gray-100 mb-3">自动化默认属性适配验证</h2>
                <p className="text-gray-400">自动验证并适配产品默认属性，确保数据一致性与准确性。</p>
              </div>
              <div className="mt-6">
                <span className="inline-flex items-center px-4 py-2 text-sm font-medium text-teal-300 bg-teal-900/50 rounded-full">效率工具</span>
              </div>
            </div>
          </Link>

          {/* Listing Optimization Card */}
          <Link className="group" to="/listing-optimization">
            <div className="p-8 rounded-2xl transform hover:-translate-y-2 transition-all duration-300 ease-in-out text-center h-full flex flex-col justify-between"
                 style={{ 
                   background: 'rgba(30, 41, 59, 0.5)', 
                   backdropFilter: 'blur(10px)',
                   border: '1px solid rgba(51, 65, 85, 0.5)'
                 }}>
              <div>
                <div className="flex justify-center items-center mb-6">
                  <span className="material-icons text-8xl text-purple-400 group-hover:text-purple-300 transition-colors">insights</span>
                </div>
                <h2 className="text-2xl font-bold text-gray-100 mb-3">Listing 优化建议</h2>
                <p className="text-gray-400">利用AI分析市场数据，为您的产品Listing提供智能优化建议。</p>
              </div>
              <div className="mt-6">
                <span className="inline-flex items-center px-4 py-2 text-sm font-medium text-purple-300 bg-purple-900/50 rounded-full">增长引擎</span>
              </div>
            </div>
          </Link>
        </div>
      </main>
    </div>
  );
};

export default HomePage;
