import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Navigation from './components/Navigation';
import HomePage from './pages/HomePage';
import IntelligentPropertyParsing from './pages/IntelligentPropertyParsing';
import AutomatedPropertyVerification from './pages/AutomatedPropertyVerification';

const App: React.FC = () => {
    return (
        <Router>
            <div className="min-h-screen">
                <Routes>
                    <Route path="/" element={<HomePage />} />
                    <Route path="/intelligent-parsing" element={
                        <div className="min-h-screen" style={{ background: '#0f172a' }}>
                            <Navigation />
                            <div className="w-full">
                                <IntelligentPropertyParsing />
                            </div>
                        </div>
                    } />
                    <Route path="/automated-verification" element={
                        <div className="min-h-screen" style={{ background: '#0f172a' }}>
                            <Navigation />
                            <div className="w-full">
                                <AutomatedPropertyVerification />
                            </div>
                        </div>
                    } />
                    <Route path="/listing-optimization" element={
                        <div className="min-h-screen" style={{ background: '#0f172a' }}>
                            <Navigation />
                            <div className="w-full">
                                <div className="w-[90%] mx-auto p-8 relative z-10">
                                    <div className="text-center p-12 rounded-2xl" style={{ background: 'rgba(30, 41, 59, 0.5)', backdropFilter: 'blur(10px)', border: '1px solid rgba(51, 65, 85, 0.5)' }}>
                                        <div className="flex items-center justify-center mb-6">
                                            <span className="material-icons text-6xl text-purple-400 mr-4 animate-pulse">insights</span>
                                            <h1 className="text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-blue-500">Listing 优化建议</h1>
                                        </div>
                                        <p className="text-xl text-gray-400">此功能正在积极开发中，敬请期待！</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    } />
                </Routes>
            </div>
        </Router>
    );
};

export default App;
