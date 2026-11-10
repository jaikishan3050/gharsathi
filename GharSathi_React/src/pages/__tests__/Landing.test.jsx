import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import { AppDataProvider } from '../../context/AppDataContext.jsx';
import Landing from '../Landing.jsx';
import { MobileRoleLinks } from '../../components/Common.jsx';

// Mock the API client
vi.mock('../../services/api.js', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    checkBackendHealth: vi.fn().mockResolvedValue({ online: false }),
    default: {
      ...actual.default,
      getMe: vi.fn().mockResolvedValue({ success: false }),
    },
  };
});

function renderWithProviders(ui) {
  return render(
    <BrowserRouter>
      <AppDataProvider>{ui}</AppDataProvider>
    </BrowserRouter>
  );
}

describe('Public Landing Page & Navigation - No Admin Exposure', () => {
  it('renders Customer and Technician cards without any public Admin card or link', () => {
    const { container } = renderWithProviders(<Landing />);

    // Customer and Technician panels are present
    expect(screen.getByText('Customer Panel')).toBeInTheDocument();
    expect(screen.getByText('Technician Panel')).toBeInTheDocument();

    // No Admin Dashboard or Admin Login link
    expect(screen.queryByText(/Admin Dashboard/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Open admin dashboard/i)).not.toBeInTheDocument();

    // Verify there are no anchors pointing to /admin
    const adminLinks = container.querySelectorAll('a[href="/admin"], a[href^="/admin"]');
    expect(adminLinks.length).toBe(0);
  });

  it('MobileRoleLinks does not contain link to /admin', () => {
    const { container } = renderWithProviders(<MobileRoleLinks />);

    expect(screen.getByText('Customer')).toBeInTheDocument();
    expect(screen.getByText('Technician')).toBeInTheDocument();
    expect(screen.queryByText('Admin')).not.toBeInTheDocument();

    const adminLinks = container.querySelectorAll('a[href="/admin"], a[href^="/admin"]');
    expect(adminLinks.length).toBe(0);
  });
});
