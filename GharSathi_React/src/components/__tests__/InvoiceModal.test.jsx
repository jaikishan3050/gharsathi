import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { InvoiceModal } from '../Common.jsx';

describe('InvoiceModal Component', () => {
  const mockBooking = {
    id: 'GS-8821001',
    customerName: 'Ramesh Sharma',
    phone: '9876543210',
    area: 'Maner',
    address: 'House No 14, Near Primary School, Maner',
    serviceName: 'AC Service & Repair',
    subcategoryName: 'Split AC Foam Jet Service',
    price: 499,
    date: '2026-10-17',
    status: 'Completed',
    servicePin: '4829',
    technicianName: 'Manoj Kumar',
    technicianPhone: '9876500001',
    completedAt: '2026-10-17T11:45:00.000Z',
  };

  it('does not render when booking is null', () => {
    const { container } = render(<InvoiceModal booking={null} onClose={() => {}} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders invoice details, customer name, and itemized charges', () => {
    render(<InvoiceModal booking={mockBooking} onClose={() => {}} />);

    expect(screen.getByText(/Tax Invoice & Service Receipt/i)).toBeInTheDocument();
    expect(screen.getByText(/Ramesh Sharma/i)).toBeInTheDocument();
    expect(screen.getAllByText(/AC Service & Repair/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/INV-8821001/i)).toBeInTheDocument();
  });

  it('calls onClose when close button is clicked', () => {
    const handleClose = vi.fn();
    render(<InvoiceModal booking={mockBooking} onClose={handleClose} />);

    const closeBtn = screen.getByRole('button', { name: /Close invoice/i });
    fireEvent.click(closeBtn);

    expect(handleClose).toHaveBeenCalledTimes(1);
  });
});
