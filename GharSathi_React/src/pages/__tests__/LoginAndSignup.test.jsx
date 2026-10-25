import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import { AppDataProvider } from '../../context/AppDataContext.jsx';
import Login from '../Login.jsx';
import Signup from '../Signup.jsx';
import api from '../../services/api.js';

// Mock the API client
vi.mock('../../services/api.js', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    checkBackendHealth: vi.fn().mockResolvedValue({ online: false }),
    default: {
      ...actual.default,
      sendEmailOtp: vi.fn(),
      verifyEmailOtp: vi.fn(),
      googleAuth: vi.fn(),
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

describe('Login Page (Email OTP & Google Sign-In)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders Email input field at top and Sign in with Google directly below', () => {
    renderWithProviders(<Login />);

    // 1. Email input field and submit button
    const emailInput = screen.getByLabelText(/Email Address/i);
    expect(emailInput).toBeInTheDocument();
    expect(emailInput).toHaveAttribute('type', 'email');

    const continueBtn = screen.getByRole('button', { name: /Continue with Email/i });
    expect(continueBtn).toBeInTheDocument();

    // 2. Directly below: Prominent 1-click "Sign in with Google" button
    const googleBtn = screen.getByRole('button', { name: /Sign in with Google/i });
    expect(googleBtn).toBeInTheDocument();

    // 3. Link to Signup page
    expect(screen.getByText(/Create an account/i)).toBeInTheDocument();
  });

  it('allows toggling between Customer and Technician Partner roles', () => {
    renderWithProviders(<Login />);

    const customerTab = screen.getByRole('tab', { name: /Customer/i });
    const techTab = screen.getByRole('tab', { name: /Technician Partner/i });

    expect(customerTab).toHaveAttribute('aria-selected', 'true');
    expect(techTab).toHaveAttribute('aria-selected', 'false');

    fireEvent.click(techTab);

    expect(techTab).toHaveAttribute('aria-selected', 'true');
    expect(customerTab).toHaveAttribute('aria-selected', 'false');
    expect(screen.getByText(/Access your technician jobs/i)).toBeInTheDocument();
  });

  it('submits email and transitions to 6-digit OTP verification screen', async () => {
    api.sendEmailOtp.mockResolvedValueOnce({
      success: true,
      message: 'OTP sent to user@example.com',
    });

    renderWithProviders(<Login />);

    const emailInput = screen.getByLabelText(/Email Address/i);
    fireEvent.change(emailInput, { target: { value: 'user@example.com' } });

    const continueBtn = screen.getByRole('button', { name: /Continue with Email/i });
    fireEvent.click(continueBtn);

    await waitFor(() => {
      expect(api.sendEmailOtp).toHaveBeenCalledWith('user@example.com', 'customer');
    });

    // Verify OTP input screen appears
    expect(await screen.findByText(/Enter 6-Digit Verification Code/i)).toBeInTheDocument();
    expect(screen.getAllByText(/user@example.com/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByRole('button', { name: /Verify & Continue/i })).toBeInTheDocument();
  });
});

describe('Signup Page (Email, Phone & Email OTP)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders required signup fields (Email, Phone, Name, Area)', () => {
    renderWithProviders(<Signup />);

    expect(screen.getByLabelText(/Full Name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Email Address/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Mobile Number/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Service Area/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Send Verification Code to Email/i })).toBeInTheDocument();
  });

  it('shows ₹0.00 wallet balance note when Technician Partner is selected', () => {
    renderWithProviders(<Signup />);

    const techTab = screen.getByRole('tab', { name: /Technician Partner/i });
    fireEvent.click(techTab);

    expect(screen.getByText(/Become a Verified Service Partner/i)).toBeInTheDocument();
    expect(screen.getByText(/All newly registered partner accounts strictly start with ₹0.00 wallet balance/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Primary Skill/i)).toBeInTheDocument();
  });

  it('sends OTP on signup and transitions to verification step', async () => {
    api.sendEmailOtp.mockResolvedValueOnce({
      success: true,
      message: 'OTP sent to partner@gharsathi.in',
    });

    renderWithProviders(<Signup />);

    fireEvent.change(screen.getByLabelText(/Full Name/i), { target: { value: 'Sunil Sharma' } });
    fireEvent.change(screen.getByLabelText(/Email Address/i), { target: { value: 'partner@gharsathi.in' } });
    fireEvent.change(screen.getByLabelText(/Mobile Number/i), { target: { value: '9876543210' } });

    const submitBtn = screen.getByRole('button', { name: /Send Verification Code to Email/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(api.sendEmailOtp).toHaveBeenCalledWith('partner@gharsathi.in', 'customer');
    });

    expect(await screen.findByText(/Email Verification Code/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Verify & Create Account/i })).toBeInTheDocument();
  });
});
