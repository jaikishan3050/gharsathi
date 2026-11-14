import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import EmailLinkForm from '../EmailLinkForm.jsx';

const linkCustomerEmail = vi.fn();
vi.mock('../../services/api.js', () => ({
  default: { linkCustomerEmail: (...args) => linkCustomerEmail(...args) },
}));

describe('EmailLinkForm', () => {
  beforeEach(() => linkCustomerEmail.mockReset());

  it('does not mark an email linked until the verification code is confirmed', async () => {
    linkCustomerEmail.mockResolvedValue({ success: true });
    const onLinked = vi.fn();
    render(<EmailLinkForm onLinked={onLinked} />);
    fireEvent.change(screen.getByLabelText('Email address'), { target: { value: 'test@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: /Send Email Verification Code/i }));
    await waitFor(() => expect(linkCustomerEmail).toHaveBeenCalledWith('test@example.com', ''));
    expect(onLinked).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText('6-digit email code'), { target: { value: '123456' } });
    fireEvent.click(screen.getByRole('button', { name: /Verify & Link Email/i }));
    await waitFor(() => expect(onLinked).toHaveBeenCalledWith('test@example.com'));
    expect(linkCustomerEmail).toHaveBeenCalledWith('test@example.com', '123456');
  });

  it('shows delivery errors without advancing to verification', async () => {
    linkCustomerEmail.mockRejectedValue(new Error('Email delivery unavailable.'));
    render(<EmailLinkForm />);
    fireEvent.change(screen.getByLabelText('Email address'), { target: { value: 'test@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: /Send Email Verification Code/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Email delivery unavailable.');
    expect(screen.queryByLabelText('6-digit email code')).not.toBeInTheDocument();
  });
});
