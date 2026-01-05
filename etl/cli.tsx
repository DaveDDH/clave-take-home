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
  | 'loading_to_db'
  | 'load_error'
  | 'load_success'
  | 'prompt_load_path';

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
      <Text bold color="cyan">╔══════════════════════════════════════╗</Text>
      <Text bold color="cyan">║     Restaurant Data ETL Pipeline     ║</Text>
      <Text bold color="cyan">╚══════════════════════════════════════╝</Text>
    </Box>
  );
}

function ErrorBox({ title, message }: { title: string; message: string }) {
  return (
    <Box flexDirection="column" marginTop={1}>
      <Text color="red" bold>✗ {title}</Text>
      <Box marginLeft={2} marginTop={1}>
        <Text color="red">{message}</Text>
      </Box>
    </Box>
  );
}

function SuccessBox({ message }: { message: string }) {
  return (
    <Box marginTop={1}>
      <Text color="green">✓ {message}</Text>
    </Box>
  );
}

function Spinner({ message }: { message: string }) {
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
}: {
  value: string;
  onChange: (val: string) => void;
  onSubmit: () => void;
  placeholder?: string;
}) {
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

  // Check env vars on mount
  useEffect(() => {
    const result = checkEnvVars();
    if (!result.valid) {
      setMissingEnvVars(result.missing);
      setScreen('env_error');
    } else {
      setEnvConfig(result.config!);
      setScreen('initial_menu');
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
    setScreen('validating');
    try {
      const { runValidation } = await import('./lib/cli-actions.js');
      const result = await runValidation(envConfig!);
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
    setScreen('preprocessing');
    try {
      const { runPreprocess } = await import('./lib/cli-actions.js');
      const result = await runPreprocess(envConfig!);
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
    setScreen('saving_preprocessed');
    try {
      const { savePreprocessedData } = await import('./lib/cli-actions.js');
      await savePreprocessedData(envConfig!, outputPath);
      setScreen('post_preprocess_menu');
    } catch (err) {
      setPreprocessError(err instanceof Error ? err.message : 'Unknown error');
      setScreen('preprocess_error');
    }
  };

  // Handle load to DB
  const handleLoadToDb = async (path: string) => {
    setScreen('loading_to_db');
    try {
      const { loadToDatabase } = await import('./lib/cli-actions.js');
      const result = await loadToDatabase(path);
      if (result.success) {
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
            message={`The following variables must be set in your .env file:\n\n${missingEnvVars.map(v => `  • ${v}`).join('\n')}\n\nPlease add them and restart the CLI.`}
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
            message={`The data files do not match the expected schema:\n\n${validationErrors.map(e => `  • ${e}`).join('\n')}\n\nPlease fix the data files and try again.`}
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
                  handleLoadToDb(outputPath);
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
              onSubmit={() => handleLoadToDb(loadPath)}
              placeholder="./preprocessed_data.json"
            />
          </Box>
          <Box marginTop={1}>
            <Text dimColor>Press Enter to confirm</Text>
          </Box>
        </Box>
      )}

      {/* Loading to DB */}
      {screen === 'loading_to_db' && (
        <Spinner message="Loading data to database..." />
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
          <Box marginTop={2}>
            <Text dimColor>Press Ctrl+C to exit</Text>
          </Box>
        </Box>
      )}
    </Box>
  );
}

render(<App />);
