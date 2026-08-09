import { useState } from 'react';
import { useCustomers } from '../../hooks/useCustomers';
import { useTickets } from '../../hooks/useTickets';
import CustomerList from './CustomerList';
import TicketPanel from './TicketPanel';

export default function CustomerTickets({ onTaskAdd }) {
  const { customers, addCustomer, removeCustomer } = useCustomers();
  const [selectedId, setSelectedId] = useState(null);
  const { tickets, addTicket, toggle, setDesiredDate, removeTicket } = useTickets(selectedId);

  const selectedCustomer = customers.find((c) => c.id === selectedId) ?? null;

  const handleDeleteCustomer = async (id) => {
    await removeCustomer(id);
    if (id === selectedId) setSelectedId(null);
  };

  const handleAddTicket = async (title, desiredDate) => {
    await addTicket(title, desiredDate);
    if (selectedCustomer) {
      onTaskAdd(`[${selectedCustomer.name}] ${title}`).catch(() => {});
    }
  };

  return (
    <div className="flex-1 flex min-h-0 overflow-hidden">
      <CustomerList
        customers={customers}
        selectedId={selectedId}
        onSelect={setSelectedId}
        onAdd={addCustomer}
        onDelete={handleDeleteCustomer}
      />
      <TicketPanel
        customer={selectedCustomer}
        tickets={tickets}
        onAdd={handleAddTicket}
        onToggle={toggle}
        onSetDesiredDate={setDesiredDate}
        onDelete={removeTicket}
      />
    </div>
  );
}
