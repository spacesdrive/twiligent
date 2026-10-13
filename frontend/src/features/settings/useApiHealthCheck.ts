import { useState } from 'react';
import { api } from '../../services/api';
import { healthCheckFailure, healthCheckResult } from './settingsData';

export function useApiHealthCheck() {
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await api.health();
      setTestResult(healthCheckResult(res));
    } catch (err) {
      setTestResult(healthCheckFailure(err));
    } finally {
      setTesting(false);
    }
  };

  return { testing, testResult, handleTest };
}
