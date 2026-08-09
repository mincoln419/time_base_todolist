const BASE = '/api/customers';

export async function fetchCustomers() {
  const res = await fetch(BASE);
  if (!res.ok) throw new Error('고객사 목록 조회 실패');
  return res.json();
}

export async function createCustomer(name) {
  const res = await fetch(BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  });
  if (!res.ok) {
    const { error } = await res.json();
    throw new Error(error);
  }
  return res.json();
}

export async function deleteCustomer(id) {
  const res = await fetch(`${BASE}/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('삭제 실패');
}

export async function fetchTickets(customerId) {
  const res = await fetch(`${BASE}/${customerId}/tickets`);
  if (!res.ok) throw new Error('티켓 목록 조회 실패');
  return res.json();
}

export async function createTicket(customerId, title, desiredDate) {
  const res = await fetch(`${BASE}/${customerId}/tickets`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, desired_date: desiredDate || null }),
  });
  if (!res.ok) {
    const { error } = await res.json();
    throw new Error(error);
  }
  return res.json();
}
