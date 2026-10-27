import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import OtpModal from '../OtpModal.jsx';

describe('OtpModal Component', () => {
  it('does not render when isOpen is false', () => {
    const { container } = render(<OtpModal isOpen={false} onClose={() => {}} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders phone input and login mode when isOpen is true', () => {
    render(
      <OtpModal
        isOpen={true}
        onClose={() => {}}
        initialPhone="9876543210"
        role="customer"
        defaultMode="login"
      />
    );

    expect(screen.getByText(/CUSTOMER AUTHENTICATION · WEBSITE OTP/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/9876543210/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Website par OTP dikhayein/i })).toBeInTheDocument();
  });

  it('switches between Login and Registration tabs', () => {
    render(<OtpModal isOpen={true} onClose={() => {}} role="customer" />);

    const signupTab = screen.getByRole('button', { name: /New Registration/i });
    fireEvent.click(signupTab);

    expect(screen.getByPlaceholderText(/Apna poora naam/i)).toBeInTheDocument();
    expect(screen.getByText(/Service Area/i)).toBeInTheDocument();
  });

  it('calls onClose when close button is clicked', () => {
    const handleClose = vi.fn();
    render(<OtpModal isOpen={true} onClose={handleClose} />);

    const closeBtn = screen.getByRole('button', { name: /Close/i });
    fireEvent.click(closeBtn);

    expect(handleClose).toHaveBeenCalledTimes(1);
  });
});
