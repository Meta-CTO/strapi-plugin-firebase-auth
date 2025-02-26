import React, { useState, useEffect } from 'react';
import { api } from '../utils/api';

const HomePage = () => {
  const [config, setConfig] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadConfig = async () => {
      try {
        const data = await api.getConfig();
        if (data?.firebase_config_json) {
          setConfig(JSON.stringify(data.firebase_config_json, null, 2));
        }
      } catch (err) {
        setError('Failed to load configuration');
      } finally {
        setLoading(false);
      }
    };
    loadConfig();
  }, []);

  const handleSubmit = async () => {
    try {
      const parsedConfig = JSON.parse(config);
      await api.saveConfig(parsedConfig);
      alert('Configuration saved successfully');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid JSON format');
    }
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <div style={{ padding: '32px' }}>
      <h2 style={{ marginBottom: '16px' }}>Firebase Service Account Configuration</h2>
      <textarea
        style={{ 
          width: '100%', 
          minHeight: '300px',
          marginBottom: '16px',
          padding: '8px',
          fontFamily: 'monospace'
        }}
        placeholder="Paste your Firebase service account JSON here"
        value={config}
        onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setConfig(e.target.value)}
      />
      {error && (
        <div style={{ color: 'red', marginBottom: '16px' }}>{error}</div>
      )}
      <button 
        style={{ 
          padding: '8px 16px',
          backgroundColor: '#4945ff',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: 'pointer'
        }}
        onClick={handleSubmit}
      >
        Save Configuration
      </button>
    </div>
  );
};

export { HomePage };
