import React, {useState, useCallback, ChangeEvent, useEffect, useRef} from 'react';
import {amazonApi} from '../services/api';
import {aiService} from '../services/ai';
import {JsonSchema} from '../types/amazon';
import {validateData, parseSchemaProperties} from '../utils/valida.js';

// Add custom styles for scrollbar hiding
const scrollbarHideStyles = `
.scrollbar-hide::-webkit-scrollbar {
    display: none;
}
.scrollbar-hide {
    -ms-overflow-style: none;  /* IE and Edge */
    scrollbar-width: none;  /* Firefox */
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
    const [generatedJson, setGeneratedJson] = useState<string>('');
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [isCopied, setIsCopied] = useState<boolean>(false);
    
    // 验证相关状态
    const [validationErrors, setValidationErrors] = useState<any[]>([]);
    const [isValidationValid, setIsValidationValid] = useState<boolean | null>(null);
    const [isValidating, setIsValidating] = useState<boolean>(false);

    // State variables for API integration
    const [sites, setSites] = useState<Record<string, string[]>>({});
    const [siteList, setSiteList] = useState<string[]>([]);
    const [filteredSiteList, setFilteredSiteList] = useState<string[]>([]);
    const [siteSearchTerm, setSiteSearchTerm] = useState<string>('');
    const [selectedSite, setSelectedSite] = useState<string>('');
    const [productTypes, setProductTypes] = useState<string[]>([]);
    const [filteredProductTypes, setFilteredProductTypes] = useState<string[]>([]);
    const [productTypeSearchTerm, setProductTypeSearchTerm] = useState<string>('');
    const [selectedProductType, setSelectedProductType] = useState<string>('');
    const [isSiteDropdownOpen, setIsSiteDropdownOpen] = useState<boolean>(false);
    const [isProductTypeDropdownOpen, setIsProductTypeDropdownOpen] = useState<boolean>(false);
    const [siteFocusedIndex, setSiteFocusedIndex] = useState<number>(-1);
    const [productTypeFocusedIndex, setProductTypeFocusedIndex] = useState<number>(-1);
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
        // Reset focused index when filtered properties change
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
        // Reset focused index when filtered sites change
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
        // Reset focused index when filtered product types change
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
                setSelectedSite(siteNames[0]);
                const productTypesList = sitesData[siteNames[0]] || [];
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

    // Fetch schema URL based on selected site and product type
    const fetchSchemaUrl = async () => {
        if (!selectedSite || !selectedProductType) {
            setError("Please select a site and product type");
            return;
        }

        try {
            setIsLoading(true);
            setError(null);

            const url = await amazonApi.getSchemaUrl(selectedSite, selectedProductType);
            await fetchSchema(url);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    };

    // Fetch schema from URL
    const fetchSchema = async (url: string) => {
        try {
            setIsLoading(true);
            setError(null);

            const parsedSchema = await amazonApi.fetchSchema(url);
            const propKeys = Object.keys(parsedSchema.properties);
            setSchema(parsedSchema);
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

    // Focus search input when dropdown is opened and reset when closed
    useEffect(() => {
        if (isDropdownOpen && searchInputRef.current) {
            searchInputRef.current.focus();
        } else if (!isDropdownOpen) {
            // Reset search term, focused index, and filtered properties when dropdown is closed
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
            // Reset search term, focused index, and filtered sites when dropdown is closed
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
            // Reset search term, focused index, and filtered product types when dropdown is closed
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
                listItems[focusedIndex].scrollIntoView({block: 'nearest'});
            }
        }
    }, [focusedIndex, isDropdownOpen]);

    // Scroll to focused site item
    useEffect(() => {
        if (siteFocusedIndex >= 0 && isSiteDropdownOpen) {
            const listItems = siteDropdownRef.current?.querySelectorAll('li');
            if (listItems && listItems[siteFocusedIndex]) {
                listItems[siteFocusedIndex].scrollIntoView({block: 'nearest'});
            }
        }
    }, [siteFocusedIndex, isSiteDropdownOpen]);

    // Scroll to focused product type item
    useEffect(() => {
        if (productTypeFocusedIndex >= 0 && isProductTypeDropdownOpen) {
            const listItems = productTypeDropdownRef.current?.querySelectorAll('li');
            if (listItems && listItems[productTypeFocusedIndex]) {
                listItems[productTypeFocusedIndex].scrollIntoView({block: 'nearest'});
            }
        }
    }, [productTypeFocusedIndex, isProductTypeDropdownOpen]);

    const handlePropertySelect = (property: string) => {
        setSelectedProperty(property);
        setSearchTerm('');
        setIsDropdownOpen(false);
        
        // 重置验证状态
        setValidationErrors([]);
        setIsValidationValid(null);
        setGeneratedJson('');
    };

    // Handle site selection
    const handleSiteSelect = (site: string) => {
        setSelectedSite(site);
        setIsSiteDropdownOpen(false);
        setSiteSearchTerm('');

        // Update product types based on selected site
        const productTypesList = sites[site] || [];
        setProductTypes(productTypesList);
        setFilteredProductTypes(productTypesList);

        // Reset selected product type
        if (productTypesList.length > 0) {
            setSelectedProductType(productTypesList[0]);
        } else {
            setSelectedProductType('');
        }

        // Reset schema
        setSchema(null);
        setProperties([]);
        setSelectedProperty('');
        setFilteredProperties([]);
    };

    // Handle product type selection
    const handleProductTypeSelect = (productType: string) => {
        setSelectedProductType(productType);
        setIsProductTypeDropdownOpen(false);
        setProductTypeSearchTerm('');

        // Reset schema
        setSchema(null);
        setProperties([]);
        setSelectedProperty('');
        setFilteredProperties([]);
    };

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
                    handleSiteSelect(filteredSiteList[siteFocusedIndex]);
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

    // Load schema based on selected site and product type
    const loadSchema = useCallback(async () => {
        if (!selectedSite || !selectedProductType) {
            setError("Please select a site and product type");
            return;
        }

        try {
            await fetchSchemaUrl();
        } catch (err: any) {
            setError(`Error loading schema: ${err.message}`);
        }
    }, [selectedSite, selectedProductType]);

    // 验证生成的 JSON
    const validateGeneratedJson = async (jsonStr: string) => {
        if (!selectedProperty || !schema) {
            return;
        }

        setIsValidating(true);
        setValidationErrors([]);
        setIsValidationValid(null);

        try {
            // 解析生成的 JSON
            const generatedData = JSON.parse(jsonStr);
            
            // 获取当前属性的子模式
            const subSchema = schema.properties[selectedProperty];
            
            // 解析模式以处理 $ref 引用
            const processedSchema = parseSchemaProperties({ 
                type: 'object',
                properties: { [selectedProperty]: subSchema },
                $defs: schema.$defs
            });

            // 创建验证数据对象
            const dataToValidate = { [selectedProperty]: generatedData };
            
            // 执行验证
            const errors = validateData(dataToValidate, processedSchema);
            
            if (errors && errors.length > 0) {
                setValidationErrors(errors);
                setIsValidationValid(false);
            } else {
                setValidationErrors([]);
                setIsValidationValid(true);
            }
        } catch (err: any) {
            console.error('验证过程中出现错误:', err);
            setValidationErrors([{
                keyword: 'parse_error',
                message: `JSON 解析失败: ${err.message}`,
                instancePath: '',
                schemaPath: ''
            }]);
            setIsValidationValid(false);
        } finally {
            setIsValidating(false);
        }
    };

    const handleGenerate = async () => {
        if (!selectedProperty || !schema) {
            setError("Please select a property and ensure a schema is loaded.");
            return;
        }

        setIsLoading(true);
        setError(null);
        setGeneratedJson('');
        setIsCopied(false);
        
        // 重置验证状态
        setValidationErrors([]);
        setIsValidationValid(null);

        const subSchema = schema.properties[selectedProperty];
        // $defs.marketplace_id.default
        const language_tag = schema.$defs.language_tag.default;
        const marketplace_id = schema.$defs.marketplace_id.default;

        try {
            const jsonStr = await aiService.generateJsonWithGeminiHttp(selectedProperty, subSchema, userReference, language_tag, marketplace_id);
            setGeneratedJson(jsonStr);
            
            // 生成完成后立即进行验证
            await validateGeneratedJson(jsonStr);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    };

    const handleCopy = useCallback(() => {
        if (generatedJson) {
            navigator.clipboard.writeText(generatedJson).then(() => {
                setIsCopied(true);
                setTimeout(() => setIsCopied(false), 2000);
            }).catch(err => {
                setError(`Failed to copy: ${err.message}`);
            });
        }
    }, [generatedJson]);

    const renderPropertyDetails = () => {
        const selectedPropertySchema = schema?.properties?.[selectedProperty];
        if (!selectedPropertySchema) {
            return null;
        }

        // Parse the generated JSON to extract values if available
        let generatedValues: any = {};
        if (generatedJson) {
            try {
                generatedValues = JSON.parse(generatedJson);
            } catch (e) {
                // If parsing fails, continue without values
                console.error("Failed to parse generated JSON:", e);
            }
        }

        // Helper function to extract actual value from objects with language_tag
        const extractValue = (val: any) => {
            if (val && typeof val === 'object') {
                // If it's an array of objects with language_tag and value properties
                if (Array.isArray(val) && val.length > 0 && val[0].language_tag && val[0].value !== undefined) {
                    return val[0].value;
                }
                // If it's a direct object with value property
                if (val.value !== undefined) {
                    return val.value;
                }
            }
            return val;
        };

        // Display title and description of the main property
        return (
            <div className="border border-gray-700 rounded-md p-3 bg-gray-800/50">
                {/* Display title and description */}
                <div className="mb-2">
                    <div className="font-semibold text-gray-200">
                        {selectedPropertySchema.title || selectedProperty}
                    </div>
                    <div className="text-xs text-gray-400">
                        {selectedPropertySchema.description || 'No description available.'}
                    </div>
                </div>

                {/* Check if the schema has items property (for array types) */}
                {selectedPropertySchema.items && selectedPropertySchema.items.properties && (
                    <div className="mt-2">
                        <h4 className="font-semibold mb-1 text-sm">Items:</h4>
                        <ul className="list-none p-0 m-0 flex flex-col gap-2 pl-2">
                            {Object.entries(selectedPropertySchema.items.properties).map(([name, details]: [string, any]) => {
                                const isRequired = (selectedPropertySchema.items.required || []).includes(name);

                                // Get the value from the generated JSON if available
                                let value = null;
                                if (generatedValues && generatedValues[0] && generatedValues[0][name] !== undefined) {
                                    const rawValue = generatedValues[0][name];
                                    const processedValue = extractValue(rawValue);
                                    value = typeof processedValue === 'object' ?
                                        JSON.stringify(processedValue, null, 2) :
                                        String(processedValue);
                                }

                                return (
                                    <li className="pb-2 border-b border-gray-700 last:border-b-0 last:pb-0" key={name}>
                                        <div className="font-semibold text-gray-200 text-sm">
                                            {details.title || name}
                                            {isRequired && <span className="text-red-400 font-bold ml-1">*</span>}
                                        </div>
                                        <div className="text-xs text-gray-400">
                                            {details.description || 'No description available.'}
                                        </div>

                                        {value !== null && (
                                            <div className="mt-1 p-2 bg-blue-900/30 border border-blue-700 rounded text-sm">
                                                <div className="font-medium text-blue-300 mb-1">Value:</div>
                                                <pre
                                                    className="whitespace-pre-wrap break-words m-0 text-gray-200 font-medium">{value}</pre>
                                            </div>
                                        )}

                                        {/* Handle nested array items */}
                                        {details.items && details.items.properties && (
                                            <div className="mt-1 pl-2">
                                                <h5 className="font-medium text-gray-300 text-xs mb-1">Nested Items:</h5>
                                                <ul className="list-none p-0 m-0 flex flex-col gap-1">
                                                    {Object.entries(details.items.properties).map(([nestedName, nestedDetails]: [string, any]) => {
                                                        const isNestedRequired = (details.items.required || []).includes(nestedName);

                                                        // Skip language_tag properties
                                                        if (nestedName === 'language_tag') return null;

                                                        return (
                                                            <li className="pb-1 border-b border-gray-700 last:border-b-0 last:pb-0"
                                                                key={nestedName}>
                                                                <div className="font-medium text-gray-200 text-xs">
                                                                    {nestedDetails.title || nestedName}
                                                                    {isNestedRequired && <span
                                                                        className="text-red-400 font-bold ml-1">*</span>}
                                                                </div>
                                                                <div className="text-xs text-gray-400">
                                                                    {nestedDetails.description || 'No description available.'}
                                                                </div>
                                                            </li>
                                                        );
                                                    })}
                                                </ul>
                                            </div>
                                        )}
                                    </li>
                                );
                            })}
                        </ul>
                    </div>
                )}

                {/* If it's not an array type, display properties as before */}
                {!selectedPropertySchema.items && selectedPropertySchema.properties && (
                    <ul className="list-none p-0 m-0 flex flex-col gap-2">
                        {Object.entries(selectedPropertySchema.properties).map(([name, details]: [string, any]) => {
                            const isRequired = (selectedPropertySchema.required || []).includes(name);

                            // Skip language_tag properties
                            if (name === 'language_tag') return null;

                            // Get the value from the generated JSON if available
                            let value = null;
                            if (generatedValues[name] !== undefined) {
                                const rawValue = generatedValues[name];
                                const processedValue = extractValue(rawValue);
                                value = typeof processedValue === 'object' ?
                                    JSON.stringify(processedValue, null, 2) :
                                    String(processedValue);
                            }

                            return (
                                <li className="pb-2 border-b border-gray-700 last:border-b-0 last:pb-0" key={name}>
                                    <div className="font-semibold text-gray-200 text-sm">
                                        {details.title || name}
                                        {isRequired && <span className="text-red-400 font-bold ml-1">*</span>}
                                    </div>
                                    <div className="text-xs text-gray-400">
                                        {details.description || 'No description available.'}
                                    </div>
                                    {value !== null && (
                                        <div className="mt-1 p-2 bg-blue-900/30 border border-blue-700 rounded text-sm">
                                            <div className="font-medium text-blue-300 mb-1">Value:</div>
                                            <pre
                                                className="whitespace-pre-wrap break-words m-0 text-gray-200 font-medium">{value}</pre>
                                        </div>
                                    )}
                                </li>
                            );
                        })}
                    </ul>
                )}
            </div>
        );
    };

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
                    <p className="text-xl text-gray-400">基于JSON Schema和您的输入，智能生成精准的产品数据。</p>
                </div>

                <div className="flex flex-col gap-6">
                    {/* Step 1: Select Template */}
                    <div className="p-8 rounded-2xl" style={{ background: 'rgba(30, 41, 59, 0.5)', backdropFilter: 'blur(10px)', border: '1px solid rgba(51, 65, 85, 0.5)' }}>
                        <div className="flex flex-col gap-5">
                            {/* Site and Product Type Selection Row */}
                            <div className="flex flex-row gap-4">
                                {/* Site Selection Dropdown */}
                                <div className="flex flex-col gap-2 w-1/2">
                                    <label htmlFor="site-select" className="font-medium text-gray-200">Select a Site</label>
                                    <div className="relative" ref={siteDropdownRef}>
                                        <div
                                            className="w-full p-3 text-base border border-gray-700 rounded-md bg-gray-800/50 text-gray-200 transition-colors focus:outline-none focus:border-cyan-500 focus:ring-3 focus:ring-cyan-500/25 cursor-pointer flex justify-between items-center"
                                            onClick={() => setIsSiteDropdownOpen(!isSiteDropdownOpen)}
                                            tabIndex={0}
                                            role="combobox"
                                            aria-expanded={isSiteDropdownOpen}
                                            aria-haspopup="listbox"
                                            aria-controls="site-listbox"
                                            aria-label="Select a site"
                                        >
                                            <span>{selectedSite || 'Select a site'}</span>
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

                                                {filteredSiteList.length > 0 ? (
                                                    <ul className="py-1 m-0" role="presentation">
                                                        {filteredSiteList.map((site, index) => (
                                                            <li
                                                                key={site}
                                                                className={`px-3 py-2 cursor-pointer hover:bg-gray-700 hover:text-gray-200 ${
                                                                    selectedSite === site
                                                                        ? 'bg-primary/10 text-primary font-medium'
                                                                        : siteFocusedIndex === index
                                                                            ? 'bg-gray-700 text-gray-200'
                                                                            : ''
                                                                }`}
                                                                onClick={() => handleSiteSelect(site)}
                                                                onMouseEnter={() => setSiteFocusedIndex(index)}
                                                                onMouseLeave={() => setSiteFocusedIndex(-1)}
                                                                role="option"
                                                                aria-selected={selectedSite === site}
                                                                id={`site-option-${index}`}
                                                            >
                                                                {site}
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
                                    <label htmlFor="product-type-select" className="font-medium text-gray-200">Select a Product Type</label>
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
                                            <span>{selectedProductType || 'Select a product type'}</span>
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
                                                                className={`px-3 py-2 cursor-pointer hover:bg-gray-700 hover:text-gray-200 ${
                                                                    selectedProductType === productType
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
                                disabled={isLoading || !selectedSite || !selectedProductType}
                            >
                                {isLoading ? (
                                    <>
                                        <div className="spinner"></div>
                                        <span>Loading...</span>
                                    </>
                                ) : (
                                    <span>Load Schema</span>
                                )}
                            </button>
                        </div>
                    </div>
                </div>

                {schema && (
                    <div className="p-8 rounded-2xl mt-4" style={{ background: 'rgba(30, 41, 59, 0.5)', backdropFilter: 'blur(10px)', border: '1px solid rgba(51, 65, 85, 0.5)' }}>
                        <div className="flex flex-col gap-5">
                            <div className="flex flex-col gap-3">
                                <label htmlFor="property-search" className="font-medium text-gray-200">Select a Property</label>
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
                                        <span>{selectedProperty || 'Select a property'}</span>
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
                                                    placeholder="Search properties..."
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
                                                            className={`px-3 py-2 cursor-pointer hover:bg-gray-700 hover:text-gray-200 ${
                                                                selectedProperty === prop
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
                                <label htmlFor="user-reference" className="font-medium text-gray-200">Reference Value (Optional)</label>
                                <textarea
                                    id="user-reference"
                                    className="w-full p-3 text-base border border-gray-700 rounded-md bg-gray-800/50 text-gray-200 min-h-20 resize-y transition-colors focus:outline-none focus:border-cyan-500 focus:ring-3 focus:ring-cyan-500/25 font-inherit"
                                    placeholder="e.g., 'a red cotton t-shirt for men' or a partial JSON object"
                                    value={userReference}
                                    onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setUserReference(e.target.value)}
                                />
                            </div>

                            <button
                                className="inline-flex items-center justify-center gap-2 px-6 py-3 text-base font-semibold text-white bg-gradient-to-r from-cyan-400 to-blue-500 border-none rounded-md cursor-pointer transition-all hover:opacity-90 disabled:bg-gray-600 disabled:cursor-not-allowed disabled:opacity-70 mt-2"
                                onClick={handleGenerate}
                                disabled={isLoading || !selectedProperty}
                            >
                                {isLoading && <div className="spinner"></div>}
                                <span>{isLoading ? 'Generating...' : 'Generate JSON'}</span>
                            </button>
                        </div>
                    </div>
                )}

                {error && (
                    <div className="text-red-300 bg-red-900/30 border border-red-700 p-4 rounded-2xl text-center">
                        {error}
                    </div>
                )}

                {generatedJson && (
                    <div className="mt-6 flex flex-row gap-6">
                        {/* Property Details Section */}
                        <div className="w-1/2">
                            <div className="p-6 rounded-2xl h-full" style={{ background: 'rgba(30, 41, 59, 0.5)', backdropFilter: 'blur(10px)', border: '1px solid rgba(51, 65, 85, 0.5)' }}>
                                <h3 className="text-lg font-semibold mb-3 text-gray-200">Property Details</h3>
                                {renderPropertyDetails()}
                            </div>
                        </div>

                        {/* Generated JSON Section */}
                        <div className="w-1/2 flex flex-col gap-3">
                            <div className="rounded-2xl overflow-hidden h-full" style={{ background: 'rgba(30, 41, 59, 0.5)', backdropFilter: 'blur(10px)', border: '1px solid rgba(51, 65, 85, 0.5)' }}>
                                <div className="flex justify-between items-center px-6 py-4 border-b border-gray-700">
                                    <div className="flex items-center gap-3">
                                        <h3 className="text-lg font-semibold text-gray-200">Generated JSON</h3>
                                        {/* 验证状态指示器 */}
                                        {isValidating && (
                                            <div className="flex items-center gap-2 text-yellow-400">
                                                <div className="spinner w-4 h-4"></div>
                                                <span className="text-sm">验证中...</span>
                                            </div>
                                        )}
                                        {!isValidating && isValidationValid === true && (
                                            <div className="flex items-center gap-1 text-green-400">
                                                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"></path>
                                                </svg>
                                                <span className="text-sm font-medium">验证通过</span>
                                            </div>
                                        )}
                                        {!isValidating && isValidationValid === false && (
                                            <div className="flex items-center gap-1 text-red-400">
                                                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd"></path>
                                                </svg>
                                                <span className="text-sm font-medium">验证失败</span>
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button
                                            className="px-3 py-1 text-sm font-medium text-white bg-gradient-to-r from-purple-400 to-purple-600 border-none rounded cursor-pointer transition-all hover:opacity-90 disabled:cursor-default disabled:opacity-70"
                                            onClick={() => validateGeneratedJson(generatedJson)}
                                            disabled={isValidating || !generatedJson}
                                        >
                                            {isValidating ? '验证中...' : '重新验证'}
                                        </button>
                                        <button
                                            className="px-3 py-1 text-sm font-medium text-white bg-gradient-to-r from-cyan-400 to-blue-500 border-none rounded cursor-pointer transition-all hover:opacity-90 disabled:cursor-default disabled:opacity-70"
                                            onClick={handleCopy}
                                            disabled={isCopied}
                                        >
                                            {isCopied ? 'Copied!' : 'Copy'}
                                        </button>
                                    </div>
                                </div>
                                
                                {/* 验证错误显示 */}
                                {validationErrors.length > 0 && (
                                    <div className="px-6 py-3 bg-red-900/30 border-b border-red-700">
                                        <h4 className="text-sm font-semibold text-red-300 mb-2">验证错误:</h4>
                                        <div className="max-h-24 overflow-y-auto scrollbar-hide">
                                            {validationErrors.map((error, index) => (
                                                <div key={index} className="text-xs text-red-200 mb-1">
                                                    <span className="font-medium">{error.instancePath || '根路径'}</span>: {error.message}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                                
                                <div className="bg-[#1a202c] text-[#e2e8f0] p-5 overflow-x-auto max-h-[500px] min-h-[200px]">
                                    <pre className="m-0 w-full font-mono text-sm whitespace-pre-wrap break-words leading-relaxed">
                                        <code>{generatedJson}</code>
                                    </pre>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {!generatedJson && schema && (
                    <div className="mt-6">
                        <div className="rounded-2xl overflow-hidden" style={{ background: 'rgba(30, 41, 59, 0.5)', backdropFilter: 'blur(10px)', border: '1px solid rgba(51, 65, 85, 0.5)' }}>
                            <div className="px-6 py-4 border-b border-gray-700">
                                <h3 className="text-lg font-semibold text-gray-200">Generated JSON</h3>
                            </div>
                            <div className="bg-[#1a202c] text-[#718096] p-5 overflow-x-auto min-h-[200px] font-mono">
                                <div className="flex items-center justify-center h-32 text-center italic">
                                    {isLoading ? 'AI is thinking...' : 'Your generated JSON will appear here.'}
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default IntelligentPropertyParsing;
