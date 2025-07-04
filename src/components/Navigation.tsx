import React from 'react';
import { Link, useLocation } from 'react-router-dom';

const Navigation: React.FC = () => {
    const location = useLocation();

    // Define navigation items
    const navItems = [
        { path: '/intelligent-parsing', label: '智能属性解析' },
        { path: '/automated-verification', label: '自动化默认属性适配验证' },
        { path: '/listing-optimization', label: 'Listing 优化建议' }
    ];

    return (
        <nav className="text-gray-200 p-4" style={{ background: 'rgba(15, 23, 42, 0.95)', backdropFilter: 'blur(10px)', borderBottom: '1px solid rgba(51, 65, 85, 0.5)' }}>
            <div className="container mx-auto">
                <div className="flex flex-col md:flex-row items-center justify-between">
                    <Link to="/" className="text-xl font-bold mb-4 md:mb-0 hover:text-cyan-400 transition-colors text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500">
                        Amazon Listing AI Assistant
                    </Link>
                    <div className="flex space-x-8">
                        {navItems.map((item) => (
                            <Link
                                key={item.path}
                                to={item.path}
                                className={`px-1 py-3 text-base font-medium transition-all relative ${
                                    location.pathname === item.path
                                        ? 'text-cyan-400 font-semibold'
                                        : 'text-gray-300 hover:text-cyan-400'
                                }`}
                            >
                                {item.label}
                                {location.pathname === item.path && (
                                    <span className="absolute bottom-0 left-0 w-full h-1 bg-cyan-400 rounded-t-md"></span>
                                )}
                            </Link>
                        ))}
                    </div>
                </div>
            </div>
        </nav>
    );
};

export default Navigation;
