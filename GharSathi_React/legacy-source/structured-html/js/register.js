let generatedOTP = null;
let isOtpSent = false;
let isOtpVerified = false;
let map, marker, geocoder, autocomplete;

// Bihar Default Center (Patna)
const defaultCenter = { lat: 25.5941, lng: 85.1376 };

// 1. Initialize Map, Geocoder, and Google Places Autocomplete
function initMap() {
    try {
        geocoder = new google.maps.Geocoder();
        
        map = new google.maps.Map(document.getElementById("map"), {
            center: defaultCenter,
            zoom: 13,
            mapTypeControl: false,
            streetViewControl: false
        });

        marker = new google.maps.Marker({
            position: defaultCenter,
            map: map,
            draggable: true,
            title: "Drag marker to change service spot"
        });

        document.getElementById("latitude").value = defaultCenter.lat;
        document.getElementById("longitude").value = defaultCenter.lng;

        // Marker Drag Event
        google.maps.event.addListener(marker, 'dragend', function (event) {
            const newLat = event.latLng.lat();
            const newLng = event.latLng.lng();
            
            document.getElementById("latitude").value = newLat;
            document.getElementById("longitude").value = newLng;

            geocodePosition(event.latLng);
        });

        // Initialize Google Places Autocomplete on Address Box
        initPlacesAutocomplete();

        // Detect GPS Position
        autoDetectGPS();
    } catch (e) {
        console.warn("Google Maps SDK failed or API key missing, fallback to manual typing:", e);
        document.getElementById("gpsStatus").innerText = "⚠️ Live Map preview disabled. Please enter address manually below.";
        document.getElementById("gpsStatus").style.color = "#842029";
    }
}

// 2. Attach Google Places Autocomplete to Address Input
function initPlacesAutocomplete() {
    const addressInput = document.getElementById("address");
    if (google && google.maps && google.maps.places) {
        autocomplete = new google.maps.places.Autocomplete(addressInput, {
            componentRestrictions: { country: "in" },
            fields: ["address_components", "geometry", "formatted_address"]
        });

        autocomplete.addListener("place_changed", function () {
            const place = autocomplete.getPlace();
            if (!place.geometry || !place.geometry.location) return;

            const loc = place.geometry.location;
            map.setCenter(loc);
            map.setZoom(16);
            marker.setPosition(loc);

            document.getElementById("latitude").value = loc.lat();
            document.getElementById("longitude").value = loc.lng();

            // Auto-fill Pincode if found
            if (place.address_components) {
                for (let i = 0; i < place.address_components.length; i++) {
                    if (place.address_components[i].types.includes("postal_code")) {
                        document.getElementById("pincode").value = place.address_components[i].long_name;
                        validatePincode();
                        break;
                    }
                }
            }
            
            const gpsStatus = document.getElementById("gpsStatus");
            gpsStatus.style.color = "#0f5132";
            gpsStatus.innerText = "✓ Location updated from landmark search.";
        });
    }
}

// 3. Automatic GPS Location Detection
function autoDetectGPS() {
    const gpsStatus = document.getElementById("gpsStatus");
    if ("geolocation" in navigator) {
        navigator.geolocation.getCurrentPosition((position) => {
            const userLat = position.coords.latitude;
            const userLng = position.coords.longitude;
            const pos = { lat: userLat, lng: userLng };

            if (map && marker) {
                map.setCenter(pos);
                map.setZoom(16);
                marker.setPosition(pos);
            }

            document.getElementById("latitude").value = userLat;
            document.getElementById("longitude").value = userLng;

            geocodePosition(pos);
            gpsStatus.style.color = "#0f5132";
            gpsStatus.innerText = "✓ Live GPS location detected automatically.";
        }, (error) => {
            gpsStatus.style.color = "#842029";
            gpsStatus.innerText = "⚠️ GPS access unavailable. Search landmark or drag marker manually.";
            if (map && marker) {
                map.setCenter(defaultCenter);
                marker.setPosition(defaultCenter);
            }
        }, { enableHighAccuracy: true, timeout: 10000 });
    } else {
        gpsStatus.style.color = "#842029";
        gpsStatus.innerText = "⚠️ Browser does not support automatic Geolocation.";
    }
}

// 4. Convert Lat/Lng to Address Text & Pincode
function geocodePosition(pos) {
    if (geocoder) {
        geocoder.geocode({ location: pos }, (results, status) => {
            if (status === "OK" && results[0]) {
                document.getElementById("address").value = results[0].formatted_address;

                const addressComponents = results[0].address_components;
                for (let i = 0; i < addressComponents.length; i++) {
                    if (addressComponents[i].types.includes("postal_code")) {
                        document.getElementById("pincode").value = addressComponents[i].long_name;
                        validatePincode();
                        break;
                    }
                }
            }
        });
    }
}

// 5. Update Map when Address is Typed
function searchAddressToMap() {
    const addressInput = document.getElementById("address").value.trim();
    const gpsStatus = document.getElementById("gpsStatus");

    if (addressInput.length > 3 && geocoder) {
        geocoder.geocode({ address: addressInput }, (results, status) => {
            if (status === "OK" && results[0]) {
                const newPos = results[0].geometry.location;

                map.setCenter(newPos);
                map.setZoom(16);
                marker.setPosition(newPos);

                document.getElementById("latitude").value = newPos.lat();
                document.getElementById("longitude").value = newPos.lng();

                const addressComponents = results[0].address_components;
                for (let i = 0; i < addressComponents.length; i++) {
                    if (addressComponents[i].types.includes("postal_code")) {
                        document.getElementById("pincode").value = addressComponents[i].long_name;
                        validatePincode();
                        break;
                    }
                }

                gpsStatus.style.color = "#0f5132";
                gpsStatus.innerText = "✓ Map updated to typed address location.";
            }
        });
    }
}

// 6. Pincode Validation Function (Bihar Region 80-85)
function validatePincode() {
    const pincodeInput = document.getElementById("pincode").value.trim();
    const pincodeNotice = document.getElementById("pincodeNotice");

    if (pincodeInput.length === 0) {
        pincodeNotice.innerText = "";
        return false;
    }

    if (pincodeInput.length < 6) {
        pincodeNotice.className = "status-msg msg-error";
        pincodeNotice.innerText = "Please enter complete 6-digit Pincode.";
        return false;
    }

    if (!/^[1-9][0-9]{5}$/.test(pincodeInput)) {
        pincodeNotice.className = "status-msg msg-error";
        pincodeNotice.innerText = "Invalid Pincode! Must be a valid 6-digit number.";
        return false;
    }

    const biharPrefixes = ["80", "81", "82", "83", "84", "85"];
    const prefix = pincodeInput.substring(0, 2);

    if (!biharPrefixes.includes(prefix)) {
        pincodeNotice.className = "status-msg msg-error";
        pincodeNotice.innerText = "Service Unavailable! Currently, service is only available in Bihar regions.";
        return false;
    }

    pincodeNotice.className = "status-msg msg-success";
    pincodeNotice.innerText = "✓ Service available in your pincode area.";
    return true;
}

window.onload = initMap;

// 7. Send OTP Handler
function sendOTP() {
    const phone = document.getElementById("phone").value.trim();
    const notice = document.getElementById("otpNotice");
    const sendBtn = document.getElementById("sendOtpBtn");

    if (!/^[6-9][0-9]{9}$/.test(phone)) {
        notice.className = "status-msg msg-error";
        notice.innerText = "Please enter a valid 10-digit mobile number!";
        return;
    }

    generatedOTP = "1234"; // Test OTP
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

// 8. Verify OTP Handler Function
function verifyOTP() {
    const userOtp = document.getElementById("otpInput").value.trim();
    const verifyNotice = document.getElementById("otpVerifyNotice");

    if (!isOtpSent) {
        alert("Please click 'Send OTP' first!");
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

// 9. Submit Form Event & Final Validation
document.getElementById("signupForm").addEventListener("submit", function(event) {
    event.preventDefault();

    const nameVal = document.getElementById("fullName").value.trim();
    const phoneVal = document.getElementById("phone").value.trim();
    const emailVal = document.getElementById("email").value.trim();
    const pincodeVal = document.getElementById("pincode").value.trim();
    const addressVal = document.getElementById("address").value.trim();
    const latVal = document.getElementById("latitude").value;
    const lngVal = document.getElementById("longitude").value;
    const userOtp = document.getElementById("otpInput").value.trim();

    if (!validatePincode()) {
        alert("Please enter a valid Bihar service pincode before proceeding.");
        return;
    }

    // Auto-verify if correct OTP typed but Verify button was not clicked
    if (isOtpSent && !isOtpVerified && userOtp === generatedOTP) {
        isOtpVerified = true;
    }

    if (!isOtpVerified) {
        alert("Please verify your mobile number with OTP before submitting the form!");
        return;
    }

    // Save Customer Record to Local Database
    let usersDatabase = JSON.parse(localStorage.getItem('gharsathi_users_db')) || [];

    const newCustomer = {
        id: "GS-" + Math.floor(100000 + Math.random() * 900000),
        fullName: nameVal,
        phone: "+91 " + phoneVal,
        email: emailVal || "Not Provided",
        pincode: pincodeVal,
        address: addressVal,
        lat: latVal,
        lng: lngVal,
        registeredAt: new Date().toLocaleString(),
        status: "Active / Logged In"
    };

    usersDatabase.push(newCustomer);
    localStorage.setItem('gharsathi_users_db', JSON.stringify(usersDatabase));

    // Active User Session
    localStorage.setItem('isLoggedIn', 'true');
    localStorage.setItem('userName', nameVal);
    localStorage.setItem('customerName', nameVal);
    localStorage.setItem('userPhone', '+91 ' + phoneVal);
    localStorage.setItem('userEmail', emailVal || '');
    localStorage.setItem('userPincode', pincodeVal);
    localStorage.setItem('userLat', latVal);
    localStorage.setItem('userLng', lngVal);
    localStorage.setItem('userAddress', addressVal);

    alert("Registration Successful! Welcome to Ghar Sathi.");

    // Redirect to Home Page
    window.location.href = 'Home.html';
});


(function(){
  function getFirst(keys){
    for (const key of keys) {
      const value = localStorage.getItem(key);
      if (value && value !== 'null' && value !== 'undefined') return value;
    }
    return '';
  }
  function avatarMarkup(target, name, photo, small){
    if (!target) return;
    if (photo) {
      target.innerHTML = '<img alt="Customer profile photo" src="' + photo.replace(/"/g, '&quot;') + '">';
    } else {
      target.textContent = (name.trim().charAt(0) || 'G').toUpperCase();
    }
  }
  window.gsToggleProfile = function(){
    const menu=document.getElementById('gsProfileDropdown');
    const button=document.getElementById('gsProfileButton');
    if(!menu || !button) return;
    menu.hidden=!menu.hidden;
    button.setAttribute('aria-expanded',String(!menu.hidden));
  };
  window.gsLogout = function(){
    localStorage.removeItem('isLoggedIn');
    window.location.href='index.html';
  };
  document.addEventListener('click', function(e){
    const wrap=document.getElementById('gsProfileWrap');
    const menu=document.getElementById('gsProfileDropdown');
    const button=document.getElementById('gsProfileButton');
    if(wrap && menu && button && !wrap.contains(e.target)){
      menu.hidden=true; button.setAttribute('aria-expanded','false');
    }
  });
  function init(){
    const name=getFirst(['userName','customerName','name']) || 'Customer';
    const phone=getFirst(['userPhone','phone','mobile']);
    const photo=getFirst(['userAvatar','profilePhoto','profileImage']);
    const small=document.getElementById('gsProfileButton');
    const large=document.getElementById('gsProfileLargeAvatar');
    if(small) avatarMarkup(small,name,photo,true);
    if(large) avatarMarkup(large,name,photo,false);
    const n=document.getElementById('gsProfileName');
    const p=document.getElementById('gsProfilePhone');
    if(n) n.textContent=name;
    if(p) p.textContent=phone;
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',init); else init();
})();

