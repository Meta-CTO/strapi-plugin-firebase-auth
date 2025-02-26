import React, { useState, useEffect } from 'react';
import { 
  Main, 
  Box, 
  Button, 
  ContentLayout, 
  Stack, 
  Typography, 
  TextArea, 
  Alert 
} from '@strapi/design-system';
import { useFetch } from '../../hooks/useFetch';

const Settings: React.FC = () => {
  const [config, setConfig] = useState('');
  const [alert, setAlert] = useState<{ type: 'success' | 'error', message: string } | null>(null);
  const { get, put } = useFetch();

  useEffect(() => {
    const fetchConfig = async () => {
      const { data } = await get('/config');
      if (data?.firebase_config_json) {
        setConfig(JSON.stringify(data.firebase_config_json, null, 2));
      }
    };
    fetchConfig();
  }, []);

  const handleSubmit = async () => {
    try {
      const parsedConfig = JSON.parse(config);
      await put('/config', { firebase_config_json: parsedConfig });
      setAlert({ type: 'success', message: 'Configuration saved successfully' });
    } catch (error) {
      setAlert({ type: 'error', message: 'Invalid JSON configuration' });
    }
  };

  return (
    <Main>
      <ContentLayout>
        <Box padding={8}>
          <Stack spacing={4}>
            <Typography variant="beta">Firebase Service Account Configuration</Typography>
            {alert && (
              <Alert onClose={() => setAlert(null)} variant={alert.type}>
                {alert.message}
              </Alert>
            )}
            <TextArea
              placeholder="Paste your Firebase service account JSON here"
              value={config}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setConfig(e.target.value)}
              rows={15}
            />
            <Button onClick={handleSubmit}>Save Configuration</Button>
          </Stack>
        </Box>
      </ContentLayout>
    </Main>
  );
};

export { Settings }; 