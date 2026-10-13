import { useState } from 'react';
import { api } from '../../services/api';
import { healthCheckFailure, healthCheckResult } from './settingsData';
import type { HealthCheckResult } from './settingsData';

export function useApiHealthCheck() {
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<HealthCheckResult | null>(null);

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await api.health();
      setTestResult(healthCheckResult(res));
    } catch (err) {
      setTestResult(healthCheckFailure(err as Error));
    } finally {
      setTesting(false);
    }
  };

  return { testing, testResult, handleTest };
}
