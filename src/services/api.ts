import axios from 'axios';
import { SitesProductTypesResponse, JsonSchema, AdapterPropertiesResponse, PropertyProductTypeResponse } from '../types/amazon';
import { config } from '../config';

/**
 * API service for Amazon Listing AI Assistant
 */
export const amazonApi = {
  /**
   * Fetch sites and product types
   * @returns Promise with sites and product types
   */
  getSitesAndProductTypes: async (): Promise<SitesProductTypesResponse> => {
    try {
      const response = await axios.post(`${config.API_BASE_URL}/amazonCategorySpProductType/getSiteProductTypes`, {});

      if (response.data.success && response.data.result) {
        return response.data.result;
      } else {
        throw new Error(response.data.errorMsg || 'Failed to fetch sites and product types');
      }
    } catch (error: any) {
      throw new Error(`Error fetching sites and product types: ${error.message}`);
    }
  },

  /**
   * Fetch schema URL based on selected site and product type
   * @param site - Selected site
   * @param productType - Selected product type
   * @returns Promise with schema URL
   */
  getSchemaUrl: async (site: string, productType: string): Promise<string> => {
    try {
      const response = await axios.get(
        `${config.API_BASE_URL}/amazonCategorySpProductType/${site}/${productType}`
      );

      if (response.data.success && response.data.result && response.data.result.schemaUrl) {
        return response.data.result.schemaUrl;
      } else {
        throw new Error(response.data.errorMsg || 'Failed to fetch schema URL');
      }
    } catch (error: any) {
      throw new Error(`Error fetching schema URL: ${error.message}`);
    }
  },

  /**
   * Fetch schema from URL
   * @param url - Schema URL
   * @returns Promise with schema
   */
  fetchSchema: async (url: string): Promise<JsonSchema> => {
    try {
      const response = await axios.get(url);

      if (response.data && typeof response.data.properties === 'object') {
        return response.data;
      } else {
        throw new Error("Invalid schema: 'properties' object not found.");
      }
    } catch (error: any) {
      throw new Error(`Error fetching schema: ${error.message}`);
    }
  },

  /**
   * Get adapter properties
   * @returns Promise with adapter properties
   */
  getAdapterProperties: async (): Promise<string[]> => {
    try {
      const response = await axios.get(
        `${config.API_BASE_URL}/productTypeTemplateJsonAttr/getAdapterProperties`
      );

      if (response.data.success && Array.isArray(response.data.result)) {
        return response.data.result;
      } else {
        throw new Error(response.data.msg || 'Failed to fetch adapter properties');
      }
    } catch (error: any) {
      throw new Error(`Error fetching adapter properties: ${error.message}`);
    }
  },

  /**
   * Find product types by property
   * @param property - Property key
   * @returns Promise with product types by site
   */
  findProductTypesByProperty: async (property: string): Promise<Record<string, string>> => {
    try {
      const response = await axios.post(
        `${config.API_BASE_URL}/amazonCategorySpProductType/find/${property}/productType`
      );

      if (response.data.success && response.data.result) {
        return response.data.result;
      } else {
        throw new Error(response.data.msg || 'Failed to find product types by property');
      }
    } catch (error: any) {
      throw new Error(`Error finding product types by property: ${error.message}`);
    }
  }
};
