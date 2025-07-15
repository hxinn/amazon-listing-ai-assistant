/**
 * Interface for the schema URL response
 */
export interface SchemaUrlResponse {
  accountSite: string;
  productType: string;
  displayName: string;
  schemaUrl: string;
}

/**
 * Interface for the sites and product types response
 */
export interface SitesProductTypesResponse {
  [site: string]: string[];
}

/**
 * Interface for the JSON schema
 */
export interface JsonSchema {
  $defs: any;
  properties: {
    [key: string]: any;
  };
  required?: string[];
  type: string;
  title?: string;
  description?: string;
}

/**
 * PropertyTemplateAttrResponse
 */
export interface PropertyTemplateAttrResponse {
  id: number;
  site: string;
  productType: string;
  attributeName: string;
  attributeValue: string;
  type: number;
  applicableAttributeType: number;
  adapterType: number;
}