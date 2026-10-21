let generatedOTP = null;
let isOtpSent = false;
let isOtpVerified = false;

// Send OTP Function
function sendOTP() {
    const phone = document.getElementById("phone").value.trim();
    const notice = document.getElementById("otpNotice");
    const sendBtn = document.getElementById("sendOtpBtn");

    if (!/^[6-9][0-9]{9}$/.test(phone)) {
        notice.className = "status-msg msg-error";
        notice.innerText = "Please enter a valid 10-digit mobile number!";
        return;
    }

    // Default Test OTP
    generatedOTP = "1234";
    isOtpSent = true;
    isOtpVerified = false;

    document.getElementById("otpGroup").style.display = "block";
    notice.className = "status-msg msg-success";
    notice.innerText = "OTP sent successfully! (Use Test OTP: 1234)";

    let countdown = 30;
    sendBtn.disabled = true;
    const timer = setInterval(() => {
        sendBtn.innerText = `Resend (${countdown}s)`;
        countdown--;
        if (countdown < 0) {
            clearInterval(timer);
            sendBtn.disabled = false;
            sendBtn.innerText = "Resend OTP";
        }
    }, 1000);
}

// Verify OTP Function
function verifyOTP() {
    const userOtp = document.getElementById("otpInput").value.trim();
    const verifyNotice = document.getElementById("otpVerifyNotice");

    if (!isOtpSent) {
        alert("Please send OTP first!");
        return;
    }

    if (userOtp === generatedOTP) {
        isOtpVerified = true;
        verifyNotice.className = "status-msg msg-success";
        verifyNotice.innerText = "✓ OTP Verified Successfully!";
        document.getElementById("otpInput").disabled = true;
    } else {
        isOtpVerified = false;
        verifyNotice.className = "status-msg msg-error";
        verifyNotice.innerText = "❌ Invalid OTP! Please enter correct code (1234).";
    }
}

// Login Form Submit Event & Database Check
document.getElementById("loginForm").addEventListener("submit", function(event) {
    event.preventDefault();

    const nameVal = document.getElementById("fullName").value.trim();
    const phoneVal = document.getElementById("phone").value.trim();

    if (!isOtpVerified) {
        alert("Please verify your mobile number with OTP before logging in!");
        return;
    }

    // Access Local Database (gharsathi_users_db)
    let usersDatabase = JSON.parse(localStorage.getItem('gharsathi_users_db')) || [];
    let existingUser = usersDatabase.find(user => user.phone.includes(phoneVal));

    if (existingUser) {
        // If user already exists in database, use their stored details
        localStorage.setItem("userName", existingUser.fullName);
        localStorage.setItem("userPhone", existingUser.phone);
        localStorage.setItem("userPincode", existingUser.pincode || "");
        localStorage.setItem("userLat", existingUser.lat || "");
        localStorage.setItem("userLng", existingUser.lng || "");
        localStorage.setItem("userAddress", existingUser.address || "");
    } else {
        // If user is not in database, create a new record and save it
        const newUser = {
            id: "GS-" + Math.floor(100000 + Math.random() * 900000),
            fullName: nameVal,
            phone: "+91 " + phoneVal,
            email: "Not Provided",
            pincode: "",
            address: "",
            lat: "",
            lng: "",
            registeredAt: new Date().toLocaleString(),
            status: "Active / Logged In"
        };
        usersDatabase.push(newUser);
        localStorage.setItem('gharsathi_users_db', JSON.stringify(usersDatabase));

        localStorage.setItem("userName", nameVal);
        localStorage.setItem("userPhone", "+91 " + phoneVal);
    }

    // Save Active User Session
    localStorage.setItem("isLoggedIn", "true");

    alert("Login Successful! Welcome to Ghar Sathi.");

    // Redirect straight to Home page
    window.location.href = "Home.html";
});

