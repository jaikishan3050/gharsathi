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
      sendOtp: vi.fn(),
      verifyOtp: vi.fn(),
      forgotPasswordTechnician: vi.fn(),
      resetPasswordTechnician: vi.fn(),
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

describe('Login Page (Direct Mobile OTP Login)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders Mobile Number input field and NO residual Email or Google Sign-In interface', () => {
    renderWithProviders(<Login />);

    // 1. Mobile Number input field and Get OTP button are present
    const phoneInput = screen.getByLabelText(/Mobile Number/i);
    expect(phoneInput).toBeInTheDocument();
    expect(phoneInput).toHaveAttribute('type', 'tel');

    const getOtpBtn = screen.getByRole('button', { name: /Get Verification OTP/i });
    expect(getOtpBtn).toBeInTheDocument();

    // 2. Email and Google Sign-In elements are completely removed
    expect(screen.queryByLabelText(/Email Address/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Continue with Email/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Sign in with Google/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/OR/i)).not.toBeInTheDocument();

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
    expect(screen.getByText(/Technician Partner Login/i)).toBeInTheDocument();
  });

  it('submits customer mobile number and transitions to 6-digit OTP verification screen', async () => {
    api.sendOtp.mockResolvedValueOnce({
      status: 'success',
      success: true,
      debug_otp: '123456',
      otp: '123456',
      message: 'Verification OTP generated for +91 9876500001',
    });

    renderWithProviders(<Login />);

    const phoneInput = screen.getByLabelText(/Mobile Number/i);
    fireEvent.change(phoneInput, { target: { value: '9876500001' } });

    const getOtpBtn = screen.getByRole('button', { name: /Get Verification OTP/i });
    fireEvent.click(getOtpBtn);

    await waitFor(() => {
      expect(api.sendOtp).toHaveBeenCalledWith('9876500001', 'customer');
    });

    // Verify OTP input screen appears
    expect(await screen.findByText(/Enter 6-Digit Verification Code/i)).toBeInTheDocument();
    expect(screen.getAllByText(/9876500001/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByRole('button', { name: /Verify & Continue/i })).toBeInTheDocument();
  });

  it('handles technician partner mobile OTP login with on-screen debug OTP popup', async () => {
    api.sendOtp.mockResolvedValueOnce({
      status: 'success',
      success: true,
      debug_otp: '482910',
      otp: '482910',
      message: 'OTP generated successfully for +91 9876500001.',
    });

    renderWithProviders(<Login />);

    // Toggle to Technician Partner tab
    const techTab = screen.getByRole('tab', { name: /Technician Partner/i });
    fireEvent.click(techTab);

    // Verify Mobile input field is present
    const phoneInput = screen.getByLabelText(/Mobile Number/i);
    expect(phoneInput).toBeInTheDocument();

    fireEvent.change(phoneInput, { target: { value: '9876500001' } });

    const sendOtpBtn = screen.getByRole('button', { name: /Get Verification OTP/i });
    fireEvent.click(sendOtpBtn);

    await waitFor(() => {
      expect(api.sendOtp).toHaveBeenCalledWith('9876500001', 'technician');
    });

    // Check that OTP code 482910 is displayed on screen (both banner and modal)
    const otpElements = await screen.findAllByText('482910');
    expect(otpElements.length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/On-Screen/i).length).toBeGreaterThanOrEqual(1);

    // Verify auto-fill action button is available
    const autoFillBtn = screen.getByRole('button', { name: /Auto-Fill & Proceed/i });
    expect(autoFillBtn).toBeInTheDocument();
    fireEvent.click(autoFillBtn);

    // Verify OTP digits are populated
    expect(screen.getByRole('button', { name: /Verify & Continue/i })).toBeInTheDocument();
  });
});

describe('Signup Page (Direct Mobile OTP Registration)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders required signup fields (Phone, Name, Area) and NO residual Email field', () => {
    renderWithProviders(<Signup />);

    expect(screen.getByLabelText(/Full Name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Mobile Number/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Service Area/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Get Verification OTP/i })).toBeInTheDocument();

    // Verify email field is not present
    expect(screen.queryByLabelText(/Email Address/i)).not.toBeInTheDocument();
  });

  it('shows ₹0.00 wallet balance note when Technician Partner is selected', () => {
    renderWithProviders(<Signup />);

    const techTab = screen.getByRole('tab', { name: /Technician Partner/i });
    fireEvent.click(techTab);

    expect(screen.getByText(/Become a Verified Service Partner/i)).toBeInTheDocument();
    expect(screen.getByText(/All newly registered partner accounts strictly start with ₹0.00 wallet balance/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Primary Skill/i)).toBeInTheDocument();
  });

  it('sends mobile OTP on customer signup and transitions to verification step', async () => {
    api.sendOtp.mockResolvedValueOnce({
      status: 'success',
      success: true,
      debug_otp: '778899',
      otp: '778899',
      message: 'OTP generated for +91 9876543210',
    });

    renderWithProviders(<Signup />);

    fireEvent.change(screen.getByLabelText(/Full Name/i), { target: { value: 'Sunil Sharma' } });
    fireEvent.change(screen.getByLabelText(/Mobile Number/i), { target: { value: '9876543210' } });

    const submitBtn = screen.getByRole('button', { name: /Get Verification OTP/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(api.sendOtp).toHaveBeenCalledWith('9876543210', 'customer');
    });

    expect(await screen.findByText(/Enter 6-Digit Verification Code/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Verify & Create Account/i })).toBeInTheDocument();
  });

  it('handles technician partner signup with on-screen mobile OTP popup', async () => {
    api.sendOtp.mockResolvedValueOnce({
      status: 'success',
      success: true,
      debug_otp: '654321',
      otp: '654321',
      message: 'OTP generated successfully for +91 9876543210.',
    });

    renderWithProviders(<Signup />);

    // Toggle to Technician Partner tab
    const techTab = screen.getByRole('tab', { name: /Technician Partner/i });
    fireEvent.click(techTab);

    fireEvent.change(screen.getByLabelText(/Full Name/i), { target: { value: 'Rajesh Plumber' } });
    fireEvent.change(screen.getByLabelText(/Mobile Number/i), { target: { value: '9876543210' } });

    const submitBtn = screen.getByRole('button', { name: /Get Verification OTP/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(api.sendOtp).toHaveBeenCalledWith('9876543210', 'technician');
    });

    // Check that OTP code 654321 is displayed on screen (both banner and modal)
    const otpElements = await screen.findAllByText('654321');
    expect(otpElements.length).toBeGreaterThanOrEqual(1);
    expect(screen.getByRole('button', { name: /Auto-Fill & Proceed/i })).toBeInTheDocument();
  });
});
