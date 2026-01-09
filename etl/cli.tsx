import React, { useState, useEffect } from 'react';
import { render, Box, Text, useInput, useApp } from 'ink';
import SelectInput from 'ink-select-input';
import 'dotenv/config';

// ============================================================================
// TYPES
// ============================================================================

type Screen =
  | 'checking_env'
  | 'env_error'
  | 'initial_menu'
  | 'validating'
  | 'validation_error'
  | 'post_validation_menu'
  | 'preprocessing'
  | 'preprocess_error'
  | 'prompt_output_path'
  | 'saving_preprocessed'
  | 'post_preprocess_menu'
  | 'prompt_load_path'
  | 'prompt_clean_db'
  | 'loading_to_db'
  | 'load_error'
  | 'load_success';

interface LoadStats {
  locations: number;
  categories: number;
  products: number;
  product_variations: number;
  product_aliases: number;
  orders: number;
  order_items: number;
  payments: number;
}

interface EnvConfig {
  LOCATIONS_PATH: string;
  VARIATION_PATTERNS_PATH: string;
  PRODUCT_GROUPS_PATH: string;
  DOORDASH_ORDERS_PATH: string;
  TOAST_POS_PATH: string;
  SQUARE_CATALOG_PATH: string;
  SQUARE_LOCATIONS_PATH: string;
  SQUARE_ORDERS_PATH: string;
  SQUARE_PAYMENTS_PATH: string;
}

// ============================================================================
// ENV VALIDATION
// ============================================================================

const REQUIRED_ENV_VARS = [
  'LOCATIONS_PATH',
  'VARIATION_PATTERNS_PATH',
  'PRODUCT_GROUPS_PATH',
  'DOORDASH_ORDERS_PATH',
  'TOAST_POS_PATH',
  'SQUARE_CATALOG_PATH',
  'SQUARE_LOCATIONS_PATH',
  'SQUARE_ORDERS_PATH',
  'SQUARE_PAYMENTS_PATH',
] as const;

function checkEnvVars(): { valid: boolean; missing: string[]; config?: EnvConfig } {
  const missing: string[] = [];

  for (const key of REQUIRED_ENV_VARS) {
    if (!process.env[key]) {
      missing.push(key);
    }
  }

  if (missing.length > 0) {
    return { valid: false, missing };
  }

  return {
    valid: true,
    missing: [],
    config: {
      LOCATIONS_PATH: process.env.LOCATIONS_PATH!,
      VARIATION_PATTERNS_PATH: process.env.VARIATION_PATTERNS_PATH!,
      PRODUCT_GROUPS_PATH: process.env.PRODUCT_GROUPS_PATH!,
      DOORDASH_ORDERS_PATH: process.env.DOORDASH_ORDERS_PATH!,
      TOAST_POS_PATH: process.env.TOAST_POS_PATH!,
      SQUARE_CATALOG_PATH: process.env.SQUARE_CATALOG_PATH!,
      SQUARE_LOCATIONS_PATH: process.env.SQUARE_LOCATIONS_PATH!,
      SQUARE_ORDERS_PATH: process.env.SQUARE_ORDERS_PATH!,
      SQUARE_PAYMENTS_PATH: process.env.SQUARE_PAYMENTS_PATH!,
    },
  };
}

// ============================================================================
// COMPONENTS
// ============================================================================

function Header() {
  return (
    <Box flexDirection="column" marginBottom={1}>
      <Text bold color="cyan">╔══════════════════════════════╗</Text>
      <Text bold color="cyan">║     Clave - ETL Pipeline     ║</Text>
      <Text bold color="cyan">╚══════════════════════════════╝</Text>
    </Box>
  );
}

function ErrorBox({ title, message }: Readonly<{ title: string; message: string }>) {
  return (
    <Box flexDirection="column" marginTop={1}>
      <Text color="red" bold>✗ {title}</Text>
      <Box marginLeft={2} marginTop={1}>
        <Text color="red">{message}</Text>
      </Box>
    </Box>
  );
}

function SuccessBox({ message }: Readonly<{ message: string }>) {
  return (
    <Box marginTop={1}>
      <Text color="green">✓ {message}</Text>
    </Box>
  );
}

function Spinner({ message }: Readonly<{ message: string }>) {
  return (
    <Box marginTop={1}>
      <Text color="yellow">⏳ {message}</Text>
    </Box>
  );
}

function TextInput({
  value,
  onChange,
  onSubmit,
  placeholder,
}: Readonly<{
  value: string;
  onChange: (val: string) => void;
  onSubmit: () => void;
  placeholder?: string;
}>) {
  useInput((input, key) => {
    if (key.return) {
      onSubmit();
    } else if (key.backspace || key.delete) {
      onChange(value.slice(0, -1));
    } else if (input && !key.ctrl && !key.meta) {
      onChange(value + input);
    }
  });

  return (
    <Box>
      <Text color="cyan">&gt; </Text>
      <Text>{value || <Text dimColor>{placeholder || ''}</Text>}</Text>
      <Text color="cyan">█</Text>
    </Box>
  );
}

// ============================================================================
// MAIN APP
// ============================================================================

function App() {
  const { exit } = useApp();
  const [screen, setScreen] = useState<Screen>('checking_env');
  const [envConfig, setEnvConfig] = useState<EnvConfig | null>(null);
  const [missingEnvVars, setMissingEnvVars] = useState<string[]>([]);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [preprocessError, setPreprocessError] = useState<string>('');
  const [outputPath, setOutputPath] = useState<string>('./preprocessed_data.json');
  const [loadPath, setLoadPath] = useState<string>('');
  const [loadError, setLoadError] = useState<string>('');
  const [loadStats, setLoadStats] = useState<LoadStats | null>(null);
  const [loadProgress, setLoadProgress] = useState<string[]>([]);

  // Check env vars on mount
  useEffect(() => {
    const result = checkEnvVars();
    if (result.valid) {
      setEnvConfig(result.config!);
      setScreen('initial_menu');
    } else {
      setMissingEnvVars(result.missing);
      setScreen('env_error');
    }
  }, []);

  // Auto-exit on env error
  useEffect(() => {
    if (screen === 'env_error') {
      const timer = setTimeout(() => {
        exit();
        process.exit(1);
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [screen, exit]);

  // Handle validation
  const handleValidate = async () => {
    if (!envConfig) return;
    setScreen('validating');
    try {
      const { runValidation } = await import('./lib/cli-actions/index.js');
      const result = await runValidation(envConfig);
      if (result.success) {
        setScreen('post_validation_menu');
      } else {
        setValidationErrors(result.errors);
        setScreen('validation_error');
      }
    } catch (err) {
      setValidationErrors([err instanceof Error ? err.message : 'Unknown error']);
      setScreen('validation_error');
    }
  };

  // Handle preprocessing
  const handlePreprocess = async () => {
    if (!envConfig) return;
    setScreen('preprocessing');
    try {
      const { runPreprocess } = await import('./lib/cli-actions/index.js');
      const result = await runPreprocess(envConfig);
      if (result.success) {
        setScreen('prompt_output_path');
      } else {
        setPreprocessError(result.error || 'Unknown error');
        setScreen('preprocess_error');
      }
    } catch (err) {
      setPreprocessError(err instanceof Error ? err.message : 'Unknown error');
      setScreen('preprocess_error');
    }
  };

  // Handle save preprocessed data
  const handleSavePreprocessed = async () => {
    if (!envConfig) return;
    setScreen('saving_preprocessed');
    try {
      const { savePreprocessedData } = await import('./lib/cli-actions/index.js');
      await savePreprocessedData(envConfig, outputPath);
      setScreen('post_preprocess_menu');
    } catch (err) {
      setPreprocessError(err instanceof Error ? err.message : 'Unknown error');
      setScreen('preprocess_error');
    }
  };

  // Handle load to DB
  const handleLoadToDb = async (path: string, cleanDb: boolean) => {
    setLoadProgress([]);
    setScreen('loading_to_db');
    try {
      const { loadToDatabase } = await import('./lib/cli-actions/index.js');
      const result = await loadToDatabase(path, cleanDb, (message) => {
        setLoadProgress((prev) => [...prev, message]);
      });
      if (result.success) {
        setLoadStats(result.stats || null);
        setScreen('load_success');
      } else {
        setLoadError(result.error || 'Unknown error');
        setScreen('load_error');
      }
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Unknown error');
      setScreen('load_error');
    }
  };

  // Exit on error screens with Ctrl+C
  useInput((input, key) => {
    if (key.ctrl && input === 'c') {
      exit();
    }
  });

  return (
    <Box flexDirection="column" padding={1}>
      <Header />

      {/* Checking env vars */}
      {screen === 'checking_env' && (
        <Spinner message="Checking environment variables..." />
      )}

      {/* Env error */}
      {screen === 'env_error' && (
        <Box flexDirection="column">
          <ErrorBox
            title="Missing environment variables"
            message={'The following variables must be set in your .env file:\n\n  • ' + missingEnvVars.join('\n  • ') + '\n\nPlease add them and restart the CLI.'}
          />
        </Box>
      )}

      {/* Initial menu */}
      {screen === 'initial_menu' && (
        <Box flexDirection="column">
          <Text dimColor>Select an option:</Text>
          <Box marginTop={1}>
            <SelectInput
              items={[
                { label: '1. Validate data', value: 'validate' },
                { label: '2. Load preprocessed data', value: 'load' },
                { label: '3. Exit', value: 'exit' },
              ]}
              onSelect={(item) => {
                if (item.value === 'validate') {
                  handleValidate();
                } else if (item.value === 'load') {
                  setScreen('prompt_load_path');
                } else {
                  exit();
                }
              }}
            />
          </Box>
        </Box>
      )}

      {/* Validating */}
      {screen === 'validating' && (
        <Spinner message="Validating data against schemas..." />
      )}

      {/* Validation error */}
      {screen === 'validation_error' && (
        <Box flexDirection="column">
          <ErrorBox
            title="Validation failed"
            message={'The data files do not match the expected schema:\n\n  • ' + validationErrors.join('\n  • ') + '\n\nPlease fix the data files and try again.'}
          />
          <Box marginTop={2}>
            <Text dimColor>Press Ctrl+C to exit</Text>
          </Box>
        </Box>
      )}

      {/* Post validation menu */}
      {screen === 'post_validation_menu' && (
        <Box flexDirection="column">
          <SuccessBox message="Data validation passed!" />
          <Box marginTop={1}>
            <Text dimColor>Select an option:</Text>
          </Box>
          <Box marginTop={1}>
            <SelectInput
              items={[
                { label: '1. Preprocess data', value: 'preprocess' },
                { label: '2. Load preprocessed data', value: 'load' },
                { label: '3. Exit', value: 'exit' },
              ]}
              onSelect={(item) => {
                if (item.value === 'preprocess') {
                  handlePreprocess();
                } else if (item.value === 'load') {
                  setScreen('prompt_load_path');
                } else {
                  exit();
                }
              }}
            />
          </Box>
        </Box>
      )}

      {/* Preprocessing */}
      {screen === 'preprocessing' && (
        <Spinner message="Preprocessing data..." />
      )}

      {/* Preprocess error */}
      {screen === 'preprocess_error' && (
        <Box flexDirection="column">
          <ErrorBox title="Preprocessing failed" message={preprocessError} />
          <Box marginTop={2}>
            <Text dimColor>Press Ctrl+C to exit</Text>
          </Box>
        </Box>
      )}

      {/* Prompt for output path */}
      {screen === 'prompt_output_path' && (
        <Box flexDirection="column">
          <SuccessBox message="Data preprocessed successfully!" />
          <Box marginTop={1}>
            <Text>Enter path to save preprocessed data:</Text>
          </Box>
          <Box marginTop={1}>
            <TextInput
              value={outputPath}
              onChange={setOutputPath}
              onSubmit={handleSavePreprocessed}
              placeholder="./preprocessed_data.json"
            />
          </Box>
          <Box marginTop={1}>
            <Text dimColor>Press Enter to confirm</Text>
          </Box>
        </Box>
      )}

      {/* Saving preprocessed */}
      {screen === 'saving_preprocessed' && (
        <Spinner message={`Saving preprocessed data to ${outputPath}...`} />
      )}

      {/* Post preprocess menu */}
      {screen === 'post_preprocess_menu' && (
        <Box flexDirection="column">
          <SuccessBox message={`Preprocessed data saved to ${outputPath}`} />
          <Box marginTop={1}>
            <Text dimColor>Select an option:</Text>
          </Box>
          <Box marginTop={1}>
            <SelectInput
              items={[
                { label: '1. Load preprocessed data to DB', value: 'load_current' },
                { label: '2. Load another preprocessed data file', value: 'load_other' },
                { label: '3. Exit', value: 'exit' },
              ]}
              onSelect={(item) => {
                if (item.value === 'load_current') {
                  setLoadPath(outputPath);
                  setScreen('prompt_clean_db');
                } else if (item.value === 'load_other') {
                  setLoadPath('');
                  setScreen('prompt_load_path');
                } else {
                  exit();
                }
              }}
            />
          </Box>
        </Box>
      )}

      {/* Prompt for load path */}
      {screen === 'prompt_load_path' && (
        <Box flexDirection="column">
          <Text>Enter path to preprocessed data file:</Text>
          <Box marginTop={1}>
            <TextInput
              value={loadPath}
              onChange={setLoadPath}
              onSubmit={() => setScreen('prompt_clean_db')}
              placeholder="./preprocessed_data.json"
            />
          </Box>
          <Box marginTop={1}>
            <Text dimColor>Press Enter to confirm</Text>
          </Box>
        </Box>
      )}

      {/* Prompt for clean DB or insert */}
      {screen === 'prompt_clean_db' && (
        <Box flexDirection="column">
          <Text>How do you want to load the data?</Text>
          <Box marginTop={1}>
            <SelectInput
              items={[
                { label: '1. Replace existing data (clean database first)', value: 'clean' },
                { label: '2. Insert/update data (keep existing records)', value: 'insert' },
                { label: '3. Cancel', value: 'cancel' },
              ]}
              onSelect={(item) => {
                if (item.value === 'clean') {
                  handleLoadToDb(loadPath, true);
                } else if (item.value === 'insert') {
                  handleLoadToDb(loadPath, false);
                } else {
                  setScreen('initial_menu');
                }
              }}
            />
          </Box>
        </Box>
      )}

      {/* Loading to DB */}
      {screen === 'loading_to_db' && (
        <Box flexDirection="column">
          <Spinner message="Loading data to database..." />
          {loadProgress.length > 0 && (
            <Box flexDirection="column" marginTop={1} marginLeft={2}>
              {loadProgress.map((msg) => (
                <Text key={msg} dimColor>• {msg}</Text>
              ))}
            </Box>
          )}
        </Box>
      )}

      {/* Load error */}
      {screen === 'load_error' && (
        <Box flexDirection="column">
          <ErrorBox title="Failed to load data" message={loadError} />
          <Box marginTop={2}>
            <Text dimColor>Press Ctrl+C to exit</Text>
          </Box>
        </Box>
      )}

      {/* Load success */}
      {screen === 'load_success' && (
        <Box flexDirection="column">
          <SuccessBox message="Data loaded to database successfully!" />
          {loadStats && (
            <Box flexDirection="column" marginTop={1} marginLeft={2}>
              <Text dimColor>Records loaded:</Text>
              <Text>  Locations:          {loadStats.locations}</Text>
              <Text>  Categories:         {loadStats.categories}</Text>
              <Text>  Products:           {loadStats.products}</Text>
              <Text>  Product Variations: {loadStats.product_variations}</Text>
              <Text>  Product Aliases:    {loadStats.product_aliases}</Text>
              <Text>  Orders:             {loadStats.orders}</Text>
              <Text>  Order Items:        {loadStats.order_items}</Text>
              <Text>  Payments:           {loadStats.payments}</Text>
            </Box>
          )}
          <Box marginTop={2}>
            <Text dimColor>Press Ctrl+C to exit</Text>
          </Box>
        </Box>
      )}
    </Box>
  );
}

console.log(`________/\\\\\\\\\\\\\\\\\\__/\\\\\\_________________/\\\\\\\\\\\\\\\\\\_____/\\\\\\________/\\\\\\__/\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\_        
 _____/\\\\\\////////__\\/\\\\\\_______________/\\\\\\\\\\\\\\\\\\\\\\\\\\__\\/\\\\\\_______\\/\\\\\\_\\/\\\\\\///////////__       
  ___/\\\\\\/___________\\/\\\\\\______________/\\\\\\/////////\\\\\\_\\//\\\\\\______/\\\\\\__\\/\\\\\\_____________      
   __/\\\\\\_____________\\/\\\\\\_____________\\/\\\\\\_______\\/\\\\\\__\\//\\\\\\____/\\\\\\___\\/\\\\\\\\\\\\\\\\\\\\\\_____     
    _\\/\\\\\\_____________\\/\\\\\\_____________\\/\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\___\\//\\\\\\__/\\\\\\____\\/\\\\\\///////______    
     _\\//\\\\\\____________\\/\\\\\\_____________\\/\\\\\\/////////\\\\\\____\\//\\\\\\/\\\\\\_____\\/\\\\\\_____________   
      __\\///\\\\\\__________\\/\\\\\\_____________\\/\\\\\\_______\\/\\\\\\_____\\//\\\\\\\\\\______\\/\\\\\\_____________  
       ____\\////\\\\\\\\\\\\\\\\\\_\\/\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\_\\/\\\\\\_______\\/\\\\\\______\\//\\\\\\_______\\/\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\_ 
        _______\\/////////__\\///////////////__\\///________\\///________\\///________\\///////////////__`);

render(<App />);
