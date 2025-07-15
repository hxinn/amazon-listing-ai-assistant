/**
 * Configuration for the application
 */
export const config = {
  /**
   * API base URL
   * Using a relative URL to leverage the proxy configuration in vite.config.ts
   */
  API_BASE_URL: '/api/sale-publish-amazon',

  /**
   * AI API rate limiting configuration
   * Maximum number of concurrent requests allowed per second
   */
  AI_API_RATE_LIMIT: 1,

  /**
   * OpenAI API configuration
   * Base URL for OpenAI API calls
   */
  OPENAI_API_URL: 'https://tubiemesazjz.ap-southeast-1.clawcloudrun.com/v1',

  /**
   * Anthropic Claude API configuration
   * Base URL for Claude API calls
   */
  CLAUDE_API_URL: 'https://api.gptapi.us/v1',
};
