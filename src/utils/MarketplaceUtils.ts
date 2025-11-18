/**
 * Amazon SP-API Marketplace 工具类
 * 包含所有区域的市场ID、国家代码和相关工具方法
 */

export interface MarketplaceInfo {
    region: string;
    country: string;
    marketplaceId: string;
    countryCode: string;
}

export class MarketplaceUtils {
    // 市场数据
    private static readonly MARKETPLACES: MarketplaceInfo[] = [
        // 北美
        { region: 'North America', country: 'Canada', marketplaceId: 'A2EUQ1WTGCTBG2', countryCode: 'CA' },
        { region: 'North America', country: 'United States of America', marketplaceId: 'ATVPDKIKX0DER', countryCode: 'US' },
        { region: 'North America', country: 'Mexico', marketplaceId: 'A1AM78C64UM0Y8', countryCode: 'MX' },
        { region: 'North America', country: 'Brazil', marketplaceId: 'A2Q3Y263D00KWC', countryCode: 'BR' },

        // Europe
        { region: 'Europe', country: 'Ireland', marketplaceId: 'A28R8C7NBKEWEA', countryCode: 'IE' },
        { region: 'Europe', country: 'Spain', marketplaceId: 'A1RKKUPIHCS9HS', countryCode: 'ES' },
        { region: 'Europe', country: 'United Kingdom', marketplaceId: 'A1F83G8C2ARO7P', countryCode: 'UK' },
        { region: 'Europe', country: 'France', marketplaceId: 'A13V1IB3VIYZZH', countryCode: 'FR' },
        { region: 'Europe', country: 'Belgium', marketplaceId: 'AMEN7PMS3EDWL', countryCode: 'BE' },
        { region: 'Europe', country: 'Netherlands', marketplaceId: 'A1805IZSGTT6HS', countryCode: 'NL' },
        { region: 'Europe', country: 'Germany', marketplaceId: 'A1PA6795UKMFR9', countryCode: 'DE' },
        { region: 'Europe', country: 'Italy', marketplaceId: 'APJ6JRA9NG5V4', countryCode: 'IT' },
        { region: 'Europe', country: 'Sweden', marketplaceId: 'A2NODRKZP88ZB9', countryCode: 'SE' },
        { region: 'Europe', country: 'South Africa', marketplaceId: 'AE08WJ6YKNBMCZA', countryCode: 'ZA' },
        { region: 'Europe', country: 'Poland', marketplaceId: 'A1C3SOZRARQ6R3', countryCode: 'PL' },

        // 中东
        { region: 'Middle East', country: 'Egypt', marketplaceId: 'ARBP9OOSHTCHU', countryCode: 'EG' },
        { region: 'Middle East', country: 'Turkey', marketplaceId: 'A33AVAJ2PDY3EV', countryCode: 'TR' },
        { region: 'Middle East', country: 'Saudi Arabia', marketplaceId: 'A17E79C6D8DWNP', countryCode: 'SA' },
        { region: 'Middle East', country: 'United Arab Emirates', marketplaceId: 'A2VIGQ35RCS4UG', countryCode: 'AE' },
        { region: 'Middle East', country: 'India', marketplaceId: 'A21TJRUUN4KGVIN', countryCode: 'IN' },
        // Far East
        { region: 'Far East', country: 'Singapore', marketplaceId: 'A19VAU5U5O7RUS', countryCode: 'SG' },
        { region: 'Far East', country: 'Australia', marketplaceId: 'A39IBJ37TRP1C6', countryCode: 'AU' },
        { region: 'Far East', country: 'Japan', marketplaceId: 'A1VC38T7YXB528', countryCode: 'JP' },
    ];

    /**
     * 获取所有市场信息
     */
    static getAllMarketplaces(): MarketplaceInfo[] {
        return [...this.MARKETPLACES];
    }

    /**
     * 根据国家代码获取市场信息
     */
    static getByCountryCode(countryCode: string): MarketplaceInfo | undefined {
        return this.MARKETPLACES.find(m => m.countryCode === countryCode.toUpperCase());
    }

    /**
     * 根据市场ID获取市场信息
     */
    static getByMarketplaceId(marketplaceId: string): MarketplaceInfo | undefined {
        return this.MARKETPLACES.find(m => m.marketplaceId === marketplaceId);
    }

    /**
     * 根据区域获取市场列表
     */
    static getByRegion(region: string): MarketplaceInfo[] {
        return this.MARKETPLACES.filter(m => m.region === region);
    }

    /**
     * 根据国家名称获取市场信息
     */
    static getByCountry(country: string): MarketplaceInfo | undefined {
        return this.MARKETPLACES.find(m => m.country === country);
    }

    /**
     * 获取所有区域列表
     */
    static getRegions(): string[] {
        return [...new Set(this.MARKETPLACES.map(m => m.region))];
    }

    /**
     * 获取所有国家代码列表
     */
    static getCountryCodes(): string[] {
        return this.MARKETPLACES.map(m => m.countryCode);
    }

    /**
     * 获取所有市场ID列表
     */
    static getMarketplaceIds(): string[] {
        return this.MARKETPLACES.map(m => m.marketplaceId);
    }

    /**
     * 验证市场ID是否有效
     */
    static isValidMarketplaceId(marketplaceId: string): boolean {
        return this.MARKETPLACES.some(m => m.marketplaceId === marketplaceId);
    }

    /**
     * 验证国家代码是否有效
     */
    static isValidCountryCode(countryCode: string): boolean {
        return this.MARKETPLACES.some(m => m.countryCode === countryCode.toUpperCase());
    }

    /**
     * 格式化市场信息为显示文本
     */
    static formatMarketplace(marketplace: MarketplaceInfo): string {
        return `${marketplace.country} (${marketplace.countryCode}) - ${marketplace.marketplaceId}`;
    }

    /**
     * 获取市场选择器选项
     */
    static getSelectOptions(): Array<{ value: string; label: string; region: string }> {
        return this.MARKETPLACES.map(m => ({
            value: m.marketplaceId,
            label: `${m.country} (${m.countryCode})`,
            region: m.region
        }));
    }

    /**
     * 按区域分组的市场选择器选项
     */
    static getGroupedSelectOptions(): Record<string, Array<{ value: string; label: string }>> {
        const grouped: Record<string, Array<{ value: string; label: string }>> = {};

        this.MARKETPLACES.forEach(m => {
            if (!grouped[m.region]) {
                grouped[m.region] = [];
            }
            grouped[m.region].push({
                value: m.marketplaceId,
                label: `${m.country} (${m.countryCode})`
            });
        });

        return grouped;
    }

}

export default MarketplaceUtils;