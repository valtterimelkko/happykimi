/**
 * Kimi Configuration Utilities
 * 
 * Utilities for reading and writing Kimi CLI configuration files,
 * including API keys, tokens, and model settings.
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { logger } from '@/ui/logger';
import { KIMI_MODEL_ENV, DEFAULT_KIMI_MODEL } from '../constants';

/**
 * Result of reading Kimi local configuration
 */
export interface KimiLocalConfig {
  token: string | null;
  model: string | null;
}

/**
 * Simple TOML parser for basic key-value pairs
 * Parses lines like: key = "value" or key = 'value' or key = value
 */
function parseToml(content: string): Record<string, string> {
  const result: Record<string, string> = {};
  const lines = content.split('\n');
  
  for (const line of lines) {
    const trimmed = line.trim();
    // Skip comments and empty lines
    if (!trimmed || trimmed.startsWith('#')) continue;
    
    // Parse key = value
    const match = trimmed.match(/^([^=]+)=\s*(.+)$/);
    if (match) {
      const key = match[1].trim();
      let value = match[2].trim();
      
      // Remove quotes if present
      if ((value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      
      result[key] = value;
    }
  }
  
  return result;
}

/**
 * Serialize object to TOML format
 */
function serializeToml(obj: Record<string, string>): string {
  const lines: string[] = [];
  for (const [key, value] of Object.entries(obj)) {
    // Use double quotes and escape internal double quotes
    const escapedValue = value.replace(/"/g, '\\"');
    lines.push(`${key} = "${escapedValue}"`);
  }
  return lines.join('\n') + '\n';
}

/**
 * Try to read Kimi OAuth credentials from ~/.kimi/credentials/ directory
 * Kimi CLI stores OAuth tokens in JSON files like kimi-code.json
 */
function readKimiOAuthCredentials(): string | null {
  const kimiDir = join(homedir(), '.kimi');
  const credentialsDir = join(kimiDir, 'credentials');
  
  // Try common credential file names
  const credentialFiles = ['kimi-code.json', 'kimi.json'];
  
  for (const filename of credentialFiles) {
    const credPath = join(credentialsDir, filename);
    if (existsSync(credPath)) {
      try {
        const content = readFileSync(credPath, 'utf-8');
        const creds = JSON.parse(content);
        
        // Check for access_token in OAuth credentials
        if (creds.access_token && typeof creds.access_token === 'string') {
          logger.debug(`[Kimi] Found OAuth access_token in ${credPath}`);
          return creds.access_token;
        }
      } catch (error) {
        logger.debug(`[Kimi] Failed to read credentials from ${credPath}:`, error);
      }
    }
  }
  
  return null;
}

/**
 * Try to read Kimi config (auth token and model) from local Kimi CLI config
 * Kimi CLI stores config in ~/.kimi/config.toml
 * OAuth credentials are stored in ~/.kimi/credentials/
 */
export function readKimiLocalConfig(): KimiLocalConfig {
  let token: string | null = null;
  let model: string | null = null;
  
  // First, try to read OAuth credentials from credentials directory
  token = readKimiOAuthCredentials();
  
  // Kimi CLI stores config in ~/.kimi/config.toml
  const configPath = join(homedir(), '.kimi', 'config.toml');

  if (existsSync(configPath)) {
    try {
      const content = readFileSync(configPath, 'utf-8');
      const config = parseToml(content);
      
      // If no OAuth token found, try different possible token field names in config
      if (!token) {
        const foundToken = config.api_key || config.token;
        if (foundToken && typeof foundToken === 'string' && foundToken.length > 0) {
          token = foundToken;
          logger.debug(`[Kimi] Found token in ${configPath}`);
        }
      }
      
      // Try to read model from config
      const foundModel = config.default_model || config.model;
      if (foundModel && typeof foundModel === 'string') {
        model = foundModel;
        logger.debug(`[Kimi] Found model in ${configPath}: ${model}`);
      }
    } catch (error) {
      logger.debug(`[Kimi] Failed to read config from ${configPath}:`, error);
    }
  } else {
    logger.debug(`[Kimi] Config file not found at ${configPath}`);
  }

  return { token, model };
}

/**
 * Determine the model to use based on priority:
 * 1. Explicit model parameter (if provided)
 * 2. Environment variable (KIMI_MODEL)
 * 3. Local config file
 * 4. Default model
 * 
 * @param explicitModel - Model explicitly provided (undefined = check sources, null = skip config)
 * @param localConfig - Local config result from readKimiLocalConfig()
 * @returns The model string to use
 */
export function determineKimiModel(
  explicitModel: string | null | undefined,
  localConfig: KimiLocalConfig
): string {
  if (explicitModel !== undefined) {
    if (explicitModel === null) {
      // Explicitly null - use env or default, skip local config
      return process.env[KIMI_MODEL_ENV] || DEFAULT_KIMI_MODEL;
    } else {
      // Model explicitly provided - use it
      return explicitModel;
    }
  } else {
    // No explicit model - check env var first (user override), then local config, then default
    const envModel = process.env[KIMI_MODEL_ENV];
    logger.debug(`[Kimi] Model selection: env[KIMI_MODEL_ENV]=${envModel}, localConfig.model=${localConfig.model}, DEFAULT=${DEFAULT_KIMI_MODEL}`);
    const model = envModel || localConfig.model || DEFAULT_KIMI_MODEL;
    logger.debug(`[Kimi] Selected model: ${model}`);
    return model;
  }
}

/**
 * Save model to Kimi config file
 * 
 * @param model - The model name to save
 */
export function saveKimiModelToConfig(model: string): void {
  try {
    const configDir = join(homedir(), '.kimi');
    const configPath = join(configDir, 'config.toml');
    
    // Create directory if it doesn't exist
    if (!existsSync(configDir)) {
      mkdirSync(configDir, { recursive: true });
    }
    
    // Read existing config or create new one
    let config: Record<string, string> = {};
    if (existsSync(configPath)) {
      try {
        const content = readFileSync(configPath, 'utf-8');
        config = parseToml(content);
      } catch (error) {
        logger.debug(`[Kimi] Failed to read existing config, creating new one`);
        config = {};
      }
    }
    
    // Update model in config
    config.model = model;
    
    // Write config back
    writeFileSync(configPath, serializeToml(config), 'utf-8');
    logger.debug(`[Kimi] Saved model "${model}" to ${configPath}`);
  } catch (error) {
    logger.debug(`[Kimi] Failed to save model to config:`, error);
    // Don't throw - this is not critical
  }
}

/**
 * Get the initial model value for UI display
 * Priority: env var > local config > default
 * 
 * @returns The initial model string
 */
export function getInitialKimiModel(): string {
  const localConfig = readKimiLocalConfig();
  return process.env[KIMI_MODEL_ENV] || localConfig.model || DEFAULT_KIMI_MODEL;
}

/**
 * Determine the source of the model for logging purposes
 * 
 * @param explicitModel - Model explicitly provided (undefined = check sources, null = skip config)
 * @param localConfig - Local config result from readKimiLocalConfig()
 * @returns Source identifier: 'explicit' | 'env-var' | 'local-config' | 'default'
 */
export function getKimiModelSource(
  explicitModel: string | null | undefined,
  localConfig: KimiLocalConfig
): 'explicit' | 'env-var' | 'local-config' | 'default' {
  if (explicitModel !== undefined && explicitModel !== null) {
    return 'explicit';
  } else if (process.env[KIMI_MODEL_ENV]) {
    return 'env-var';
  } else if (localConfig.model) {
    return 'local-config';
  } else {
    return 'default';
  }
}
