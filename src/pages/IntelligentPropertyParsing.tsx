import React, { useState, useCallback, ChangeEvent, useEffect, useRef } from 'react';
import { amazonApi } from '../services/api';
import { aiService } from '../services/ai';
import { JsonSchema } from '../types/amazon';
import { validateData, parseSchemaProperties } from '../utils/valida.js';
import { MarketplaceUtils } from '../utils/MarketplaceUtils';

// Add custom styles for scrollbar hiding and spinner
const scrollbarHideStyles = `
.scrollbar-hide::-webkit-scrollbar {
    display: none;
}
.scrollbar-hide {
    -ms-overflow-style: none;  /* IE and Edge */
    scrollbar-width: none;  /* Firefox */
}
.spinner {
    border: 2px solid #f3f3f3;
    border-top: 2px solid #3498db;
    border-radius: 50%;
    width: 16px;
    height: 16px;
    animation: spin 1s linear infinite;
}
@keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
}
`;

const IntelligentPropertyParsing: React.FC = () => {
    const [schema, setSchema] = useState<JsonSchema | null>(null);
    const [properties, setProperties] = useState<string[]>([]);
    const [selectedProperty, setSelectedProperty] = useState<string>('');
    const [searchTerm, setSearchTerm] = useState<string>('');
    const [filteredProperties, setFilteredProperties] = useState<string[]>([]);
    const [isDropdownOpen, setIsDropdownOpen] = useState<boolean>(false);
    const [focusedIndex, setFocusedIndex] = useState<number>(-1);
    const [userReference, setUserReference] = useState<string>('');
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [isCopied, setIsCopied] = useState<boolean>(false);

    // 验证相关状态
    const [validationErrors, setValidationErrors] = useState<any[]>([]);
    const [isValidationValid, setIsValidationValid] = useState<boolean | null>(null);
    const [isValidating, setIsValidating] = useState<boolean>(false);

    // Multi-site state variables
    const [sites, setSites] = useState<Record<string, string[]>>({});
    const [siteList, setSiteList] = useState<string[]>([]);
    const [filteredSiteList, setFilteredSiteList] = useState<string[]>([]);
    const [siteSearchTerm, setSiteSearchTerm] = useState<string>('');
    const [selectedSites, setSelectedSites] = useState<string[]>([]);
    const [productTypes, setProductTypes] = useState<string[]>([]);
    const [filteredProductTypes, setFilteredProductTypes] = useState<string[]>([]);
    const [productTypeSearchTerm, setProductTypeSearchTerm] = useState<string>('');
    const [selectedProductType, setSelectedProductType] = useState<string>('');
    const [isSiteDropdownOpen, setIsSiteDropdownOpen] = useState<boolean>(false);
    const [isProductTypeDropdownOpen, setIsProductTypeDropdownOpen] = useState<boolean>(false);
    const [siteFocusedIndex, setSiteFocusedIndex] = useState<number>(-1);
    const [productTypeFocusedIndex, setProductTypeFocusedIndex] = useState<number>(-1);

    // Multi-site generation states
    const [multiSiteResults, setMultiSiteResults] = useState<Record<string, string>>({});
    const [isMultiSiteLoading, setIsMultiSiteLoading] = useState<boolean>(false);
    const [multiSiteSchemas, setMultiSiteSchemas] = useState<Record<string, JsonSchema>>({});

    const dropdownRef = useRef<HTMLDivElement>(null);
    const searchInputRef = useRef<HTMLInputElement>(null);
    const siteDropdownRef = useRef<HTMLDivElement>(null);
    const siteSearchInputRef = useRef<HTMLInputElement>(null);
    const productTypeDropdownRef = useRef<HTMLDivElement>(null);
    const productTypeSearchInputRef = useRef<HTMLInputElement>(null);

    // Filter properties based on search term
    useEffect(() => {
        if (searchTerm.trim() === '') {
            setFilteredProperties(properties);
        } else {
            const filtered = properties.filter(prop =>
                prop.toLowerCase().includes(searchTerm.toLowerCase())
            );
            setFilteredProperties(filtered);
        }
        setFocusedIndex(-1);
    }, [searchTerm, properties]);

    // Filter sites based on search term
    useEffect(() => {
        if (siteSearchTerm.trim() === '') {
            setFilteredSiteList(siteList);
        } else {
            const filtered = siteList.filter(site =>
                site.toLowerCase().includes(siteSearchTerm.toLowerCase())
            );
            setFilteredSiteList(filtered);
        }
        setSiteFocusedIndex(-1);
    }, [siteSearchTerm, siteList]);

    // Filter product types based on search term
    useEffect(() => {
        if (productTypeSearchTerm.trim() === '') {
            setFilteredProductTypes(productTypes);
        } else {
            const filtered = productTypes.filter(productType =>
                productType.toLowerCase().includes(productTypeSearchTerm.toLowerCase())
            );
            setFilteredProductTypes(filtered);
        }
        setProductTypeFocusedIndex(-1);
    }, [productTypeSearchTerm, productTypes]);

    // Fetch sites and product types on component mount
    useEffect(() => {
        fetchSitesAndProductTypes();
    }, []);

    // Handle clicks outside the dropdowns to close them
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsDropdownOpen(false);
            }
            if (siteDropdownRef.current && !siteDropdownRef.current.contains(event.target as Node)) {
                setIsSiteDropdownOpen(false);
            }
            if (productTypeDropdownRef.current && !productTypeDropdownRef.current.contains(event.target as Node)) {
                setIsProductTypeDropdownOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    // Fetch sites and product types
    const fetchSitesAndProductTypes = async () => {
        try {
            setIsLoading(true);
            setError(null);

            const sitesData = await amazonApi.getSitesAndProductTypes();
            setSites(sitesData);
            const siteNames = Object.keys(sitesData);
            setSiteList(siteNames);
            setFilteredSiteList(siteNames);

            if (siteNames.length > 0) {
                // 默认选择所有站点
                setSelectedSites(siteNames);

                // 获取所有站点的产品类型的交集
                const allProductTypes = new Set<string>();
                siteNames.forEach(site => {
                    const siteProductTypes = sitesData[site] || [];
                    siteProductTypes.forEach(pt => allProductTypes.add(pt));
                });

                const productTypesList = Array.from(allProductTypes);
                setProductTypes(productTypesList);
                setFilteredProductTypes(productTypesList);

                if (productTypesList.length > 0) {
                    setSelectedProductType(productTypesList[0]);
                }
            }
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    };

    // Handle site selection (multi-select)
    const handleSiteToggle = (site: string) => {
        setSelectedSites(prev => {
            const newSelection = prev.includes(site)
                ? prev.filter(s => s !== site)
                : [...prev, site];

            // Update product types based on selected sites
            updateProductTypesForSelectedSites(newSelection);

            return newSelection;
        });
    };

    // Handle select all sites
    const handleSelectAllSites = () => {
        const allSelected = selectedSites.length === siteList.length;
        const newSelection = allSelected ? [] : [...siteList];
        setSelectedSites(newSelection);
        updateProductTypesForSelectedSites(newSelection);
    };

    // Update product types based on selected sites
    const updateProductTypesForSelectedSites = (selectedSitesList: string[]) => {
        if (selectedSitesList.length === 0) {
            setProductTypes([]);
            setFilteredProductTypes([]);
            setSelectedProductType('');
            return;
        }

        // Get intersection of product types from all selected sites
        let commonProductTypes = new Set<string>();
        selectedSitesList.forEach((site, index) => {
            const siteProductTypes = sites[site] || [];
            if (index === 0) {
                // Initialize with first site's product types
                commonProductTypes = new Set(siteProductTypes);
            } else {
                // Keep only common product types
                const currentSet = new Set(siteProductTypes);
                commonProductTypes = new Set([...commonProductTypes].filter(pt => currentSet.has(pt)));
            }
        });

        const productTypesList = Array.from(commonProductTypes);
        setProductTypes(productTypesList);
        setFilteredProductTypes(productTypesList);

        // Reset selected product type if it's not in the new list
        if (!productTypesList.includes(selectedProductType)) {
            setSelectedProductType(productTypesList.length > 0 ? productTypesList[0] : '');
        }

        // Reset schemas and properties
        setSchema(null);
        setMultiSiteSchemas({});
        setProperties([]);
        setSelectedProperty('');
        setFilteredProperties([]);
        setMultiSiteResults({});
    };

    // Handle product type selection
    const handleProductTypeSelect = (productType: string) => {
        setSelectedProductType(productType);
        setIsProductTypeDropdownOpen(false);
        setProductTypeSearchTerm('');

        // Reset schema
        setSchema(null);
        setMultiSiteSchemas({});
        setProperties([]);
        setSelectedProperty('');
        setFilteredProperties([]);
        setMultiSiteResults({});
    };

    // Fetch schemas for all selected sites
    const fetchMultiSiteSchemas = async () => {
        if (selectedSites.length === 0 || !selectedProductType) {
            setError("Please select at least one site and a product type");
            return;
        }

        try {
            setIsLoading(true);
            setError(null);

            const schemas: Record<string, JsonSchema> = {};
            const allProperties = new Set<string>();

            // Fetch schema for each selected site
            for (const site of selectedSites) {
                try {
                    const url = await amazonApi.getSchemaUrl(site, selectedProductType);
                    const parsedSchema = await amazonApi.fetchSchema(url);
                    schemas[site] = parsedSchema;

                    // Collect all properties
                    Object.keys(parsedSchema.properties).forEach(prop => allProperties.add(prop));
                } catch (err: any) {
                    console.warn(`Failed to fetch schema for ${site}:`, err.message);
                }
            }

            setMultiSiteSchemas(schemas);

            // Use the first site's schema as the main schema for compatibility
            const firstSite = selectedSites[0];
            if (schemas[firstSite]) {
                setSchema(schemas[firstSite]);
            }

            const propKeys = Array.from(allProperties);
            setProperties(propKeys);
            setFilteredProperties(propKeys);

            if (propKeys.length > 0) {
                setSelectedProperty(propKeys[0]);
            }
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    };

    // Load schema based on selected sites and product type
    const loadSchema = useCallback(async () => {
        if (selectedSites.length === 0 || !selectedProductType) {
            setError("Please select at least one site and a product type");
            return;
        }

        try {
            await fetchMultiSiteSchemas();
        } catch (err: any) {
            setError(`Error loading schema: ${err.message}`);
        }
    }, [selectedSites, selectedProductType]);

    // Handle keyboard navigation for site dropdown
    const handleSiteKeyDown = (e: React.KeyboardEvent) => {
        if (!isSiteDropdownOpen) return;

        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                setSiteFocusedIndex(prevIndex => {
                    const newIndex = prevIndex < filteredSiteList.length - 1 ? prevIndex + 1 : 0;
                    return newIndex;
                });
                break;
            case 'ArrowUp':
                e.preventDefault();
                setSiteFocusedIndex(prevIndex => {
                    const newIndex = prevIndex > 0 ? prevIndex - 1 : filteredSiteList.length - 1;
                    return newIndex;
                });
                break;
            case 'Enter':
                e.preventDefault();
                if (siteFocusedIndex >= 0 && siteFocusedIndex < filteredSiteList.length) {
                    handleSiteToggle(filteredSiteList[siteFocusedIndex]);
                }
                break;
            case 'Escape':
                e.preventDefault();
                setIsSiteDropdownOpen(false);
                break;
            default:
                break;
        }
    };

    // Handle keyboard navigation for product type dropdown
    const handleProductTypeKeyDown = (e: React.KeyboardEvent) => {
        if (!isProductTypeDropdownOpen) return;

        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                setProductTypeFocusedIndex(prevIndex => {
                    const newIndex = prevIndex < filteredProductTypes.length - 1 ? prevIndex + 1 : 0;
                    return newIndex;
                });
                break;
            case 'ArrowUp':
                e.preventDefault();
                setProductTypeFocusedIndex(prevIndex => {
                    const newIndex = prevIndex > 0 ? prevIndex - 1 : filteredProductTypes.length - 1;
                    return newIndex;
                });
                break;
            case 'Enter':
                e.preventDefault();
                if (productTypeFocusedIndex >= 0 && productTypeFocusedIndex < filteredProductTypes.length) {
                    handleProductTypeSelect(filteredProductTypes[productTypeFocusedIndex]);
                }
                break;
            case 'Escape':
                e.preventDefault();
                setIsProductTypeDropdownOpen(false);
                break;
            default:
                break;
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (!isDropdownOpen) return;

        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                setFocusedIndex(prevIndex => {
                    const newIndex = prevIndex < filteredProperties.length - 1 ? prevIndex + 1 : 0;
                    return newIndex;
                });
                break;
            case 'ArrowUp':
                e.preventDefault();
                setFocusedIndex(prevIndex => {
                    const newIndex = prevIndex > 0 ? prevIndex - 1 : filteredProperties.length - 1;
                    return newIndex;
                });
                break;
            case 'Enter':
                e.preventDefault();
                if (focusedIndex >= 0 && focusedIndex < filteredProperties.length) {
                    handlePropertySelect(filteredProperties[focusedIndex]);
                }
                break;
            case 'Escape':
                e.preventDefault();
                setIsDropdownOpen(false);
                break;
            default:
                break;
        }
    };

    const handlePropertySelect = (property: string) => {
        setSelectedProperty(property);
        setSearchTerm('');
        setIsDropdownOpen(false);

        // 重置验证状态
        setValidationErrors([]);
        setIsValidationValid(null);
        setMultiSiteResults({});
    };

    // Focus search input when dropdown is opened and reset when closed
    useEffect(() => {
        if (isDropdownOpen && searchInputRef.current) {
            searchInputRef.current.focus();
        } else if (!isDropdownOpen) {
            setSearchTerm('');
            setFocusedIndex(-1);
            setFilteredProperties(properties);
        }
    }, [isDropdownOpen, properties]);

    // Focus site search input when site dropdown is opened and reset when closed
    useEffect(() => {
        if (isSiteDropdownOpen && siteSearchInputRef.current) {
            siteSearchInputRef.current.focus();
        } else if (!isSiteDropdownOpen) {
            setSiteSearchTerm('');
            setSiteFocusedIndex(-1);
            setFilteredSiteList(siteList);
        }
    }, [isSiteDropdownOpen, siteList]);

    // Focus product type search input when product type dropdown is opened and reset when closed
    useEffect(() => {
        if (isProductTypeDropdownOpen && productTypeSearchInputRef.current) {
            productTypeSearchInputRef.current.focus();
        } else if (!isProductTypeDropdownOpen) {
            setProductTypeSearchTerm('');
            setProductTypeFocusedIndex(-1);
            setFilteredProductTypes(productTypes);
        }
    }, [isProductTypeDropdownOpen, productTypes]);

    // Scroll to focused item
    useEffect(() => {
        if (focusedIndex >= 0 && isDropdownOpen) {
            const listItems = dropdownRef.current?.querySelectorAll('li');
            if (listItems && listItems[focusedIndex]) {
                listItems[focusedIndex].scrollIntoView({ block: 'nearest' });
            }
        }
    }, [focusedIndex, isDropdownOpen]);

    // Scroll to focused site item
    useEffect(() => {
        if (siteFocusedIndex >= 0 && isSiteDropdownOpen) {
            const listItems = siteDropdownRef.current?.querySelectorAll('li');
            if (listItems && listItems[siteFocusedIndex]) {
                listItems[siteFocusedIndex].scrollIntoView({ block: 'nearest' });
            }
        }
    }, [siteFocusedIndex, isSiteDropdownOpen]);

    // Scroll to focused product type item
    useEffect(() => {
        if (productTypeFocusedIndex >= 0 && isProductTypeDropdownOpen) {
            const listItems = productTypeDropdownRef.current?.querySelectorAll('li');
            if (listItems && listItems[productTypeFocusedIndex]) {
                listItems[productTypeFocusedIndex].scrollIntoView({ block: 'nearest' });
            }
        }
    }, [productTypeFocusedIndex, isProductTypeDropdownOpen]);

    // Group sites by region using MarketplaceUtils
    const groupSitesByRegion = () => {
        const regionGroups: Record<string, { schemas: Record<string, JsonSchema>, sites: string[] }> = {};

        selectedSites.forEach(site => {
            // Find marketplace info for this site using country code
            const marketplaceInfo = MarketplaceUtils.getByCountryCode(site);
            const region = marketplaceInfo?.region || 'Unknown';

            if (!regionGroups[region]) {
                regionGroups[region] = {
                    schemas: {},
                    sites: []
                };
            }

            regionGroups[region].sites.push(site);
            if (multiSiteSchemas[site]) {
                regionGroups[region].schemas[site] = multiSiteSchemas[site];
            }
        });

        return regionGroups;
    };

    // Generate JSON for multiple sites grouped by region
    const handleMultiSiteGenerate = async () => {
        if (!selectedProperty || selectedSites.length === 0) {
            setError("Please select a property and at least one site.");
            return;
        }

        setIsMultiSiteLoading(true);
        setError(null);
        setMultiSiteResults({});
        setIsCopied(false);

        // 重置验证状态
        setValidationErrors([]);
        setIsValidationValid(null);

        try {
            // Group sites by region
            const regionGroups = groupSitesByRegion();

            // Use the new region-based AI service method
            const regionResults = await aiService.generateJsonByRegion(
                selectedProperty,
                regionGroups,
                userReference
            );

            // Flatten the results from region-based to site-based
            const flatResults: Record<string, string> = {};
            Object.values(regionResults).forEach(regionSiteResults => {
                Object.assign(flatResults, regionSiteResults);
            });

            setMultiSiteResults(flatResults);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsMultiSiteLoading(false);
        }
    };

    const handleGenerate = async () => {
        await handleMultiSiteGenerate();
    };

    const handleCopy = useCallback((content: string) => {
        if (content) {
            navigator.clipboard.writeText(content).then(() => {
                setIsCopied(true);
                setTimeout(() => setIsCopied(false), 2000);
            }).catch(err => {
                setError(`Failed to copy: ${err.message}`);
            });
        }
    }, []);

    return (
        <div className="w-full min-h-screen text-gray-200" style={{ background: '#0f172a' }}>
            {/* Add scrollbar-hide styles */}
            <style dangerouslySetInnerHTML={{ __html: scrollbarHideStyles }} />
            {/* Glowing effects */}
            <div className="absolute top-0 left-0 w-[200px] h-[200px] rounded-full bg-blue-500 filter blur-[80px] opacity-30 z-0"></div>
            <div className="absolute bottom-0 right-0 w-[200px] h-[200px] rounded-full bg-purple-500 filter blur-[80px] opacity-30 z-0"></div>
            <div className="w-[90%] mx-auto p-8 flex flex-col gap-6 relative z-10">
                <div className="text-center">
                    <div className="flex items-center justify-center mb-6">
                        <span className="material-icons text-6xl text-cyan-400 mr-4 animate-pulse">schema</span>
                        <h1 className="text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500">智能属性解析</h1>
                    </div>
                    <p className="text-xl text-gray-400">支持多站点同时生成，直观对比不同站点的属性差异</p>
                </div>

                <div className="flex flex-col gap-6">
                    {/* Step 1: Select Template */}
                    <div className="p-8 rounded-2xl" style={{ background: 'rgba(30, 41, 59, 0.5)', backdropFilter: 'blur(10px)', border: '1px solid rgba(51, 65, 85, 0.5)' }}>
                        <div className="flex flex-col gap-5">
                            {/* Site and Product Type Selection Row */}
                            <div className="flex flex-row gap-4">
                                {/* Multi-Site Selection Dropdown */}
                                <div className="flex flex-col gap-2 w-1/2">
                                    <label htmlFor="site-select" className="font-medium text-gray-200">
                                        选择站点 ({selectedSites.length}/{siteList.length} 已选择)
                                    </label>
                                    <div className="relative" ref={siteDropdownRef}>
                                        <div
                                            className="w-full p-3 text-base border border-gray-700 rounded-md bg-gray-800/50 text-gray-200 transition-colors focus:outline-none focus:border-cyan-500 focus:ring-3 focus:ring-cyan-500/25 cursor-pointer flex justify-between items-center"
                                            onClick={() => setIsSiteDropdownOpen(!isSiteDropdownOpen)}
                                            tabIndex={0}
                                            role="combobox"
                                            aria-expanded={isSiteDropdownOpen}
                                            aria-haspopup="listbox"
                                            aria-controls="site-listbox"
                                            aria-label="Select sites"
                                        >
                                            <span>
                                                {selectedSites.length === 0
                                                    ? '请选择站点'
                                                    : selectedSites.length === siteList.length
                                                        ? '全部站点'
                                                        : `${selectedSites.length} 个站点已选择`
                                                }
                                            </span>
                                            <svg
                                                className={`w-4 h-4 transition-transform ${isSiteDropdownOpen ? 'transform rotate-180' : ''}`}
                                                fill="none"
                                                stroke="currentColor"
                                                viewBox="0 0 24 24"
                                                xmlns="http://www.w3.org/2000/svg"
                                            >
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                                                    d="M19 9l-7 7-7-7"></path>
                                            </svg>
                                        </div>

                                        {isSiteDropdownOpen && (
                                            <div
                                                className="absolute z-50 w-full mt-1 bg-gray-800 border border-gray-700 rounded-md shadow-lg max-h-60 overflow-y-auto scrollbar-hide"
                                                id="site-listbox"
                                                role="listbox"
                                                aria-label="Sites"
                                                onKeyDown={handleSiteKeyDown}
                                                style={{ zIndex: 1000 }}
                                            >
                                                <div className="sticky top-0 bg-gray-800 p-2 border-b border-gray-700">
                                                    <input
                                                        id="site-search"
                                                        ref={siteSearchInputRef}
                                                        type="text"
                                                        className="w-full p-2 text-base border border-gray-700 rounded-md bg-gray-800/50 text-gray-200 transition-colors focus:outline-none focus:border-cyan-500 focus:ring-3 focus:ring-cyan-500/25"
                                                        placeholder="搜索站点..."
                                                        value={siteSearchTerm}
                                                        onChange={(e) => setSiteSearchTerm(e.target.value)}
                                                        onClick={(e) => e.stopPropagation()}
                                                        onKeyDown={handleSiteKeyDown}
                                                        aria-label="Search sites"
                                                        aria-autocomplete="list"
                                                    />
                                                </div>

                                                {/* Select All Option */}
                                                <div className="px-3 py-2 border-b border-gray-700">
                                                    <div
                                                        className="flex items-center cursor-pointer hover:bg-gray-700 p-1 rounded"
                                                        onClick={handleSelectAllSites}
                                                    >
                                                        <input
                                                            type="checkbox"
                                                            checked={selectedSites.length === siteList.length}
                                                            onChange={handleSelectAllSites}
                                                            className="mr-2"
                                                        />
                                                        <span className="font-medium text-cyan-400">全选/取消全选</span>
                                                    </div>
                                                </div>

                                                {filteredSiteList.length > 0 ? (
                                                    <ul className="py-1 m-0" role="presentation">
                                                        {filteredSiteList.map((site, index) => (
                                                            <li
                                                                key={site}
                                                                className={`px-3 py-2 cursor-pointer hover:bg-gray-700 hover:text-gray-200 ${siteFocusedIndex === index ? 'bg-gray-700 text-gray-200' : ''
                                                                    }`}
                                                                onClick={() => handleSiteToggle(site)}
                                                                onMouseEnter={() => setSiteFocusedIndex(index)}
                                                                onMouseLeave={() => setSiteFocusedIndex(-1)}
                                                                role="option"
                                                                aria-selected={selectedSites.includes(site)}
                                                                id={`site-option-${index}`}
                                                            >
                                                                <div className="flex items-center">
                                                                    <input
                                                                        type="checkbox"
                                                                        checked={selectedSites.includes(site)}
                                                                        onChange={() => handleSiteToggle(site)}
                                                                        className="mr-2"
                                                                    />
                                                                    <span className={selectedSites.includes(site) ? 'font-medium text-cyan-400' : ''}>{site}</span>
                                                                </div>
                                                            </li>
                                                        ))}
                                                    </ul>
                                                ) : (
                                                    <div className="px-3 py-2 text-gray-500" role="status">No sites found</div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Product Type Selection Dropdown */}
                                <div className="flex flex-col gap-2 w-1/2">
                                    <label htmlFor="product-type-select" className="font-medium text-gray-200">选择分类类型</label>
                                    <div className="relative" ref={productTypeDropdownRef}>
                                        <div
                                            className="w-full p-3 text-base border border-gray-700 rounded-md bg-gray-800/50 text-gray-200 transition-colors focus:outline-none focus:border-cyan-500 focus:ring-3 focus:ring-cyan-500/25 cursor-pointer flex justify-between items-center"
                                            onClick={() => setIsProductTypeDropdownOpen(!isProductTypeDropdownOpen)}
                                            tabIndex={0}
                                            role="combobox"
                                            aria-expanded={isProductTypeDropdownOpen}
                                            aria-haspopup="listbox"
                                            aria-controls="product-type-listbox"
                                            aria-label="Select a product type"
                                        >
                                            <span>{selectedProductType || '请选择分类类型'}</span>
                                            <svg
                                                className={`w-4 h-4 transition-transform ${isProductTypeDropdownOpen ? 'transform rotate-180' : ''}`}
                                                fill="none"
                                                stroke="currentColor"
                                                viewBox="0 0 24 24"
                                                xmlns="http://www.w3.org/2000/svg"
                                            >
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                                                    d="M19 9l-7 7-7-7"></path>
                                            </svg>
                                        </div>

                                        {isProductTypeDropdownOpen && (
                                            <div
                                                className="absolute z-50 w-full mt-1 bg-gray-800 border border-gray-700 rounded-md shadow-lg max-h-60 overflow-y-auto scrollbar-hide"
                                                id="product-type-listbox"
                                                role="listbox"
                                                aria-label="Product Types"
                                                onKeyDown={handleProductTypeKeyDown}
                                                style={{ zIndex: 1000 }}
                                            >
                                                <div className="sticky top-0 bg-gray-800 p-2 border-b border-gray-700">
                                                    <input
                                                        id="product-type-search"
                                                        ref={productTypeSearchInputRef}
                                                        type="text"
                                                        className="w-full p-2 text-base border border-gray-700 rounded-md bg-gray-800/50 text-gray-200 transition-colors focus:outline-none focus:border-cyan-500 focus:ring-3 focus:ring-cyan-500/25"
                                                        placeholder="搜索分类类型..."
                                                        value={productTypeSearchTerm}
                                                        onChange={(e) => setProductTypeSearchTerm(e.target.value)}
                                                        onClick={(e) => e.stopPropagation()}
                                                        onKeyDown={handleProductTypeKeyDown}
                                                        aria-label="Search product types"
                                                        aria-autocomplete="list"
                                                    />
                                                </div>

                                                {filteredProductTypes.length > 0 ? (
                                                    <ul className="py-1 m-0" role="presentation">
                                                        {filteredProductTypes.map((productType, index) => (
                                                            <li
                                                                key={productType}
                                                                className={`px-3 py-2 cursor-pointer hover:bg-gray-700 hover:text-gray-200 ${selectedProductType === productType
                                                                    ? 'bg-primary/10 text-primary font-medium'
                                                                    : productTypeFocusedIndex === index
                                                                        ? 'bg-gray-700 text-gray-200'
                                                                        : ''
                                                                    }`}
                                                                onClick={() => handleProductTypeSelect(productType)}
                                                                onMouseEnter={() => setProductTypeFocusedIndex(index)}
                                                                onMouseLeave={() => setProductTypeFocusedIndex(-1)}
                                                                role="option"
                                                                aria-selected={selectedProductType === productType}
                                                                id={`product-type-option-${index}`}
                                                            >
                                                                {productType}
                                                            </li>
                                                        ))}
                                                    </ul>
                                                ) : (
                                                    <div className="px-3 py-2 text-gray-500" role="status">No product types found</div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Load Schema Button */}
                            <button
                                className="inline-flex items-center justify-center gap-2 px-6 py-3 text-base font-semibold text-white bg-gradient-to-r from-cyan-400 to-blue-500 border-none rounded-md cursor-pointer transition-all hover:opacity-90 disabled:bg-gray-600 disabled:cursor-not-allowed disabled:opacity-70"
                                onClick={loadSchema}
                                disabled={isLoading || selectedSites.length === 0 || !selectedProductType}
                            >
                                {isLoading ? (
                                    <>
                                        <div className="spinner"></div>
                                        <span>Loading...</span>
                                    </>
                                ) : (
                                    <span>加载 Schema</span>
                                )}
                            </button>
                        </div>
                    </div>
                </div>

                {schema && (
                    <div className="p-8 rounded-2xl mt-4" style={{ background: 'rgba(30, 41, 59, 0.5)', backdropFilter: 'blur(10px)', border: '1px solid rgba(51, 65, 85, 0.5)' }}>
                        <div className="flex flex-col gap-5">
                            <div className="flex flex-col gap-3">
                                <label htmlFor="property-search" className="font-medium text-gray-200">选择属性</label>
                                <div className="relative" ref={dropdownRef} onKeyDown={handleKeyDown}>
                                    <div
                                        className="w-full p-3 text-base border border-gray-700 rounded-md bg-gray-800/50 text-gray-200 transition-colors focus:outline-none focus:border-cyan-500 focus:ring-3 focus:ring-cyan-500/25 cursor-pointer flex justify-between items-center"
                                        onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
                                                e.preventDefault();
                                                setIsDropdownOpen(true);
                                            }
                                        }}
                                        tabIndex={0}
                                        role="combobox"
                                        aria-expanded={isDropdownOpen}
                                        aria-haspopup="listbox"
                                        aria-controls="property-listbox"
                                        aria-label="Select a property"
                                        aria-activedescendant={focusedIndex >= 0 ? `property-option-${focusedIndex}` : undefined}
                                    >
                                        <span>{selectedProperty || '请选择属性'}</span>
                                        <svg
                                            className={`w-4 h-4 transition-transform ${isDropdownOpen ? 'transform rotate-180' : ''}`}
                                            fill="none"
                                            stroke="currentColor"
                                            viewBox="0 0 24 24"
                                            xmlns="http://www.w3.org/2000/svg"
                                        >
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                                                d="M19 9l-7 7-7-7"></path>
                                        </svg>
                                    </div>

                                    {isDropdownOpen && (
                                        <div
                                            className="absolute z-40 w-full mt-1 bg-gray-800 border border-gray-700 rounded-md shadow-lg max-h-60 overflow-y-auto scrollbar-hide"
                                            id="property-listbox"
                                            role="listbox"
                                            aria-label="Properties"
                                        >
                                            <div className="sticky top-0 bg-gray-800 p-2 border-b border-gray-700">
                                                <input
                                                    id="property-search"
                                                    ref={searchInputRef}
                                                    type="text"
                                                    className="w-full p-2 text-base border border-gray-700 rounded-md bg-gray-800/50 text-gray-200 transition-colors focus:outline-none focus:border-cyan-500 focus:ring-3 focus:ring-cyan-500/25"
                                                    placeholder="搜索属性..."
                                                    value={searchTerm}
                                                    onChange={(e) => setSearchTerm(e.target.value)}
                                                    onClick={(e) => e.stopPropagation()}
                                                    onKeyDown={handleKeyDown}
                                                    aria-label="Search properties"
                                                    aria-autocomplete="list"
                                                />
                                            </div>

                                            {filteredProperties.length > 0 ? (
                                                <ul className="py-1 m-0" role="presentation">
                                                    {filteredProperties.map((prop, index) => (
                                                        <li
                                                            key={prop}
                                                            className={`px-3 py-2 cursor-pointer hover:bg-gray-700 hover:text-gray-200 ${selectedProperty === prop
                                                                ? 'bg-primary/10 text-primary font-medium'
                                                                : focusedIndex === index
                                                                    ? 'bg-gray-700 text-gray-200'
                                                                    : ''
                                                                }`}
                                                            onClick={() => handlePropertySelect(prop)}
                                                            onMouseEnter={() => setFocusedIndex(index)}
                                                            onMouseLeave={() => setFocusedIndex(-1)}
                                                            role="option"
                                                            aria-selected={selectedProperty === prop}
                                                            id={`property-option-${index}`}
                                                        >
                                                            {prop}
                                                        </li>
                                                    ))}
                                                </ul>
                                            ) : (
                                                <div className="px-3 py-2 text-gray-500" role="status">No properties found</div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="flex flex-col gap-3">
                                <label htmlFor="user-reference" className="font-medium text-gray-200">参考信息 (可选)</label>
                                <textarea
                                    id="user-reference"
                                    className="w-full p-3 text-base border border-gray-700 rounded-md bg-gray-800/50 text-gray-200 min-h-20 resize-y transition-colors focus:outline-none focus:border-cyan-500 focus:ring-3 focus:ring-cyan-500/25 font-inherit"
                                    placeholder="例如: '男士红色棉质T恤' 或部分JSON对象"
                                    value={userReference}
                                    onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setUserReference(e.target.value)}
                                />
                            </div>

                            <button
                                className="inline-flex items-center justify-center gap-2 px-6 py-3 text-base font-semibold text-white bg-gradient-to-r from-cyan-400 to-blue-500 border-none rounded-md cursor-pointer transition-all hover:opacity-90 disabled:bg-gray-600 disabled:cursor-not-allowed disabled:opacity-70"
                                onClick={handleGenerate}
                                disabled={isMultiSiteLoading || !selectedProperty}
                            >
                                {isMultiSiteLoading ? (
                                    <>
                                        <div className="spinner"></div>
                                        <span>生成中...</span>
                                    </>
                                ) : (
                                    <span>生成多站点数据</span>
                                )}
                            </button>
                        </div>
                    </div>
                )}

                {/* Multi-site Results Display */}
                {Object.keys(multiSiteResults).length > 0 && (
                    <div className="mt-6">
                        <div className="rounded-2xl overflow-hidden" style={{ background: 'rgba(30, 41, 59, 0.5)', backdropFilter: 'blur(10px)', border: '1px solid rgba(51, 65, 85, 0.5)' }}>
                            <div className="px-6 py-4 border-b border-gray-700">
                                <h3 className="text-lg font-semibold text-gray-200">多站点生成结果对比 (按区域分组)</h3>
                                <p className="text-sm text-gray-400 mt-1">属性: {selectedProperty}</p>
                                <p className="text-xs text-gray-500 mt-1">相同区域的站点使用统一的AI请求生成，提高效率并保持区域一致性</p>
                            </div>

                            {(() => {
                                // Group results by region for display
                                const regionGroups = groupSitesByRegion();
                                const regionEntries = Object.entries(regionGroups);

                                return (
                                    <div className="p-6 space-y-6">
                                        {regionEntries.map(([region, regionData]) => (
                                            <div key={region} className="border border-gray-600 rounded-lg overflow-hidden">
                                                <div className="px-4 py-2 bg-gray-700/50 border-b border-gray-600">
                                                    <h4 className="font-semibold text-purple-400">{region} 区域</h4>
                                                    <p className="text-xs text-gray-400">站点: {regionData.sites.join(', ')}</p>
                                                </div>
                                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4">
                                                    {regionData.sites.map(site => (
                                                        <div key={site} className="border border-gray-700 rounded-lg overflow-hidden">
                                                            <div className="px-4 py-3 bg-gray-800/70 border-b border-gray-700 flex justify-between items-center">
                                                                <div className="flex flex-col">
                                                                    <h5 className="font-semibold text-cyan-400">{site}</h5>
                                                                    <span className="text-xs text-gray-500">{MarketplaceUtils.getByCountry(site)?.countryCode || 'N/A'}</span>
                                                                </div>
                                                                <button
                                                                    className="px-3 py-1 text-sm font-medium text-white bg-gradient-to-r from-cyan-400 to-blue-500 border-none rounded cursor-pointer transition-all hover:opacity-90"
                                                                    onClick={() => handleCopy(multiSiteResults[site] || '')}
                                                                >
                                                                    复制
                                                                </button>
                                                            </div>
                                                            <div className="bg-[#1a202c] text-[#e2e8f0] p-4 max-h-[400px] overflow-y-auto">
                                                                <pre className="m-0 w-full font-mono text-xs whitespace-pre-wrap break-words leading-relaxed">
                                                                    <code>{multiSiteResults[site] || 'No result'}</code>
                                                                </pre>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                );
                            })()}
                        </div>
                    </div>
                )}

                {/* Error Display */}
                {error && (
                    <div className="mt-4 p-4 bg-red-900/30 border border-red-700 rounded-md">
                        <p className="text-red-200">{error}</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default IntelligentPropertyParsing;