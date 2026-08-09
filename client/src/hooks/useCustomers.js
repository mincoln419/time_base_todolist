import { useState, useEffect, useCallback } from 'react';
import { fetchCustomers, createCustomer, deleteCustomer } from '../api/customers';

export function useCustomers() {
  const [customers, setCustomers] = useState([]);

  const load = useCallback(async () => {
    setCustomers(await fetchCustomers());
  }, []);

  useEffect(() => { load(); }, [load]);

  const addCustomer = useCallback(async (name) => {
    const customer = await createCustomer(name);
    setCustomers((prev) => [...prev, customer]);
    return customer;
  }, []);

  const removeCustomer = useCallback(async (id) => {
    await deleteCustomer(id);
    setCustomers((prev) => prev.filter((c) => c.id !== id));
  }, []);

  return { customers, addCustomer, removeCustomer };
}
