import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Navigation from './components/Navigation';
import IntelligentPropertyParsing from './pages/IntelligentPropertyParsing';
import AutomatedPropertyVerification from './pages/AutomatedPropertyVerification';

const App: React.FC = () => {

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
            // @ts-ignore
            setSchemaUrl(url);
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

    // Scroll to focused item
    useEffect(() => {
        if (focusedIndex >= 0 && isDropdownOpen) {
            const listItems = dropdownRef.current?.querySelectorAll('li');
            if (listItems && listItems[focusedIndex]) {
                listItems[focusedIndex].scrollIntoView({block: 'nearest'});
            }
        }
    }, [focusedIndex, isDropdownOpen]);

    const handlePropertySelect = (property: string) => {
        setSelectedProperty(property);
        setSearchTerm('');
        setIsDropdownOpen(false);
    };

    // Handle site selection
    const handleSiteSelect = (site: string) => {
        setSelectedSite(site);
        setIsSiteDropdownOpen(false);

        // Update product types based on selected site
        setProductTypes(sites[site] || []);

        // Reset selected product type
        if (sites[site]?.length > 0) {
            setSelectedProductType(sites[site][0]);
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

        // Reset schema
        setSchema(null);
        setProperties([]);
        setSelectedProperty('');
        setFilteredProperties([]);
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

    const handleGenerate = async () => {
        if (!selectedProperty || !schema) {
            setError("Please select a property and ensure a schema is loaded.");
            return;
        }

        setIsLoading(true);
        setError(null);
        setGeneratedJson('');
        setIsCopied(false);

        const subSchema = schema.properties[selectedProperty];

        try {
            const jsonStr = await aiService.generateJson(selectedProperty, subSchema, userReference);
            setGeneratedJson(jsonStr);
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
            <div className="border border-border rounded-md p-2 bg-gray-50">
                {/* Display title and description */}
                <div className="mb-2">
                    <div className="font-semibold text-text">
                        {selectedPropertySchema.title || selectedProperty}
                    </div>
                    <div className="text-xs text-secondary">
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
                                    <li className="pb-2 border-b border-gray-200 last:border-b-0 last:pb-0" key={name}>
                                        <div className="font-semibold text-text text-sm">
                                            {details.title || name}
                                            {isRequired && <span className="text-error font-bold ml-1">*</span>}
                                        </div>
                                        <div className="text-xs text-secondary">
                                            {details.description || 'No description available.'}
                                        </div>

                                        {value !== null && (
                                            <div className="mt-1 p-2 bg-blue-50 border border-primary rounded text-sm">
                                                <div className="font-medium text-primary mb-1">Value:</div>
                                                <pre
                                                    className="whitespace-pre-wrap break-words m-0 text-black font-medium">{value}</pre>
                                            </div>
                                        )}

                                        {/* Handle nested array items */}
                                        {details.items && details.items.properties && (
                                            <div className="mt-1 pl-2">
                                                <h5 className="font-medium text-xs mb-1">Nested Items:</h5>
                                                <ul className="list-none p-0 m-0 flex flex-col gap-1">
                                                    {Object.entries(details.items.properties).map(([nestedName, nestedDetails]: [string, any]) => {
                                                        const isNestedRequired = (details.items.required || []).includes(nestedName);

                                                        // Skip language_tag properties
                                                        if (nestedName === 'language_tag') return null;

                                                        return (
                                                            <li className="pb-1 border-b border-gray-100 last:border-b-0 last:pb-0"
                                                                key={nestedName}>
                                                                <div className="font-medium text-text text-xs">
                                                                    {nestedDetails.title || nestedName}
                                                                    {isNestedRequired && <span
                                                                        className="text-error font-bold ml-1">*</span>}
                                                                </div>
                                                                <div className="text-xs text-secondary">
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
                                <li className="pb-2 border-b border-gray-200 last:border-b-0 last:pb-0" key={name}>
                                    <div className="font-semibold text-text text-sm">
                                        {details.title || name}
                                        {isRequired && <span className="text-error font-bold ml-1">*</span>}
                                    </div>
                                    <div className="text-xs text-secondary">
                                        {details.description || 'No description available.'}
                                    </div>
                                    {value !== null && (
                                        <div className="mt-1 p-2 bg-blue-50 border border-primary rounded text-sm">
                                            <div className="font-medium text-primary mb-1">Value:</div>
                                            <pre
                                                className="whitespace-pre-wrap break-words m-0 text-black font-medium">{value}</pre>
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
        <div className="min-h-screen bg-background p-8 flex justify-center">
            <div className="w-full" style={{width: '80%'}}>
                <div className="bg-surface rounded-lg shadow-lg p-8 flex flex-col gap-6">
                    <div className="text-center">
                        <h1 className="text-3xl font-bold text-text mb-2">Amazon Listing AI Assistant</h1>
                        <p className="text-secondary">Generate product data based on a JSON Schema and your input.</p>
                    </div>

                    <div className="flex flex-col gap-4">
                        {/* Site and Product Type Selection Row */}
                        <div className="flex flex-row gap-4">
                            {/* Site Selection Dropdown */}
                            <div className="flex flex-col gap-2 w-1/2">
                                <label htmlFor="site-select" className="font-medium text-text">Select a Site</label>
                                <div className="relative" ref={siteDropdownRef}>
                                    <div
                                        className="w-full p-3 text-base border border-border rounded-md bg-surface transition-colors focus:outline-none focus:border-primary focus:ring-3 focus:ring-primary/25 cursor-pointer flex justify-between items-center"
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
                                            className="absolute z-10 w-full mt-1 bg-white border border-border rounded-md shadow-lg max-h-60 overflow-y-auto"
                                            id="site-listbox"
                                            role="listbox"
                                            aria-label="Sites"
                                        >
                                            {siteList.length > 0 ? (
                                                <ul className="py-1 m-0" role="presentation">
                                                    {siteList.map((site) => (
                                                        <li
                                                            key={site}
                                                            className={`px-3 py-2 cursor-pointer hover:bg-gray-100 ${
                                                                selectedSite === site
                                                                    ? 'bg-primary/10 text-primary font-medium'
                                                                    : ''
                                                            }`}
                                                            onClick={() => handleSiteSelect(site)}
                                                            role="option"
                                                            aria-selected={selectedSite === site}
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
                                <label htmlFor="product-type-select" className="font-medium text-text">Select a Product Type</label>
                                <div className="relative" ref={productTypeDropdownRef}>
                                    <div
                                        className="w-full p-3 text-base border border-border rounded-md bg-surface transition-colors focus:outline-none focus:border-primary focus:ring-3 focus:ring-primary/25 cursor-pointer flex justify-between items-center"
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
                                            className="absolute z-10 w-full mt-1 bg-white border border-border rounded-md shadow-lg max-h-60 overflow-y-auto"
                                            id="product-type-listbox"
                                            role="listbox"
                                            aria-label="Product Types"
                                        >
                                            {productTypes.length > 0 ? (
                                                <ul className="py-1 m-0" role="presentation">
                                                    {productTypes.map((productType) => (
                                                        <li
                                                            key={productType}
                                                            className={`px-3 py-2 cursor-pointer hover:bg-gray-100 ${
                                                                selectedProductType === productType
                                                                    ? 'bg-primary/10 text-primary font-medium'
                                                                    : ''
                                                            }`}
                                                            onClick={() => handleProductTypeSelect(productType)}
                                                            role="option"
                                                            aria-selected={selectedProductType === productType}
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
                            className="inline-flex items-center justify-center gap-2 px-6 py-3 text-base font-semibold text-white bg-primary border-none rounded-md cursor-pointer transition-colors hover:bg-primary-hover disabled:bg-secondary disabled:cursor-not-allowed disabled:opacity-70"
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

                    {schema && (
                        <>
                            <div className="flex flex-col gap-2">
                                <label htmlFor="property-search" className="font-medium text-text">Select a
                                    Property</label>
                                <div className="relative" ref={dropdownRef} onKeyDown={handleKeyDown}>
                                    <div
                                        className="w-full p-3 text-base border border-border rounded-md bg-surface transition-colors focus:outline-none focus:border-primary focus:ring-3 focus:ring-primary/25 cursor-pointer flex justify-between items-center"
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
                                            className="absolute z-10 w-full mt-1 bg-white border border-border rounded-md shadow-lg max-h-60 overflow-y-auto"
                                            id="property-listbox"
                                            role="listbox"
                                            aria-label="Properties"
                                        >
                                            <div className="sticky top-0 bg-white p-2 border-b border-border">
                                                <input
                                                    id="property-search"
                                                    ref={searchInputRef}
                                                    type="text"
                                                    className="w-full p-2 text-base border border-border rounded-md bg-surface transition-colors focus:outline-none focus:border-primary focus:ring-3 focus:ring-primary/25"
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
                                                            className={`px-3 py-2 cursor-pointer hover:bg-gray-100 ${
                                                                selectedProperty === prop
                                                                    ? 'bg-primary/10 text-primary font-medium'
                                                                    : focusedIndex === index
                                                                        ? 'bg-gray-100'
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
                                                <div className="px-3 py-2 text-gray-500" role="status">No properties
                                                    found</div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="flex flex-col gap-2">
                                <label htmlFor="user-reference" className="font-medium text-text">Reference Value
                                    (Optional)</label>
                                <textarea
                                    id="user-reference"
                                    className="w-full p-3 text-base border border-border rounded-md bg-surface min-h-20 resize-y transition-colors focus:outline-none focus:border-primary focus:ring-3 focus:ring-primary/25 font-inherit"
                                    placeholder="e.g., 'a red cotton t-shirt for men' or a partial JSON object"
                                    value={userReference}
                                    onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setUserReference(e.target.value)}
                                />
                            </div>

                            <button
                                className="inline-flex items-center justify-center gap-2 px-6 py-3 text-base font-semibold text-white bg-primary border-none rounded-md cursor-pointer transition-colors hover:bg-primary-hover disabled:bg-secondary disabled:cursor-not-allowed disabled:opacity-70"
                                onClick={handleGenerate}
                                disabled={isLoading || !selectedProperty}
                            >
                                {isLoading && <div className="spinner"></div>}
                                <span>{isLoading ? 'Generating...' : 'Generate JSON'}</span>
                            </button>
                        </>
                    )}

                    {error && (
                        <div className="text-error bg-red-50 border border-error p-4 rounded-md text-center">
                            {error}
                        </div>
                    )}

                    {generatedJson && (
                        <div className="mt-4 flex flex-row gap-4">
                            {/* Property Details Section */}
                            <div className="w-1/2">
                                {renderPropertyDetails()}
                            </div>

                            {/* Generated JSON Section */}
                            <div className="w-1/2 flex flex-col gap-2">
                                <div className="relative border border-gray-300 rounded-lg overflow-hidden">
                                    <div
                                        className="bg-gray-100 px-4 py-2 border-b border-gray-300 text-sm text-gray-600 font-medium">
                                        JSON
                                    </div>
                                    <div
                                        className="bg-gray-50 text-gray-800 p-4 overflow-x-auto max-h-96 min-h-32 font-mono text-sm">
                    <pre className="m-0 w-full text-gray-800">
                      <code className="block whitespace-pre-wrap break-words">{generatedJson}</code>
                    </pre>
                                    </div>
                                </div>
                                <div className="flex justify-end items-center">
                                    <button
                                        className="px-3 py-1 text-sm font-medium text-secondary bg-transparent border border-border rounded cursor-pointer transition-colors hover:bg-secondary hover:text-white disabled:cursor-default disabled:text-primary disabled:border-transparent"
                                        onClick={handleCopy}
                                        disabled={isCopied}
                                    >
                                        {isCopied ? 'Copied!' : 'Copy'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {!generatedJson && (
                        <div className="mt-4 flex flex-col gap-2">
                            <div className="flex justify-between items-center">
                                <label className="font-medium text-text">Generated JSON</label>
                            </div>
                            <div className="relative border border-gray-300 rounded-lg overflow-hidden">
                                <div
                                    className="bg-gray-100 px-4 py-2 border-b border-gray-300 text-sm text-gray-600 font-medium">
                                    JSON
                                </div>
                                <div
                                    className="bg-gray-50 text-gray-800 p-4 overflow-x-auto max-h-96 min-h-32 font-mono text-sm">
                                    <div className="text-gray-500 text-center flex items-center justify-center h-24">
                                        {isLoading ? 'AI is thinking...' : 'Your generated JSON will appear here.'}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default App; 
