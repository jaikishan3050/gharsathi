// FIREBASE CONFIGURATION & INITIALIZATION
    const firebaseConfig = {
      apiKey: "AIzaSyCcgjW83IMt6l2qF2jVjcrxrRFmZrkkEZk",
      databaseURL: "https://gharsathi-live-default-rtdb.asia-southeast1.firebasedatabase.app/"
    };
    firebase.initializeApp(firebaseConfig);
    const dbRef = firebase.database().ref("bookings");

    // BIHAR DISTRICTS AND THEIR CITIES MAPPING WITH PINCODE PREFIXES
    const biharData = {
      "Patna": {
        cities: ["Patna City", "Danapur", "Kankarbagh", "Boring Road", "Rajendra Nagar", "Phulwari Sharif", "Bikram", "Bihta"],
        pincodePrefixes: ["800", "801", "803"]
      },
      "Muzaffarpur": {
        cities: ["Muzaffarpur Sadar", "Kanti", "Motipur", "Minapur", "Sakra", "Bochaha"],
        pincodePrefixes: ["842", "843"]
      },
      "Gaya": {
        cities: ["Gaya Sadar", "Bodh Gaya", "Sherghati", "Manpur", "Tekari"],
        pincodePrefixes: ["823", "824"]
      },
      "Bhagalpur": {
        cities: ["Bhagalpur Sadar", "Naugachhia", "Kahalgaon", "Sultanganj"],
        pincodePrefixes: ["812", "813"]
      },
      "Darbhanga": {
        cities: ["Darbhanga Sadar", "Benipur", "Biraul", "Jale", "Keoti"],
        pincodePrefixes: ["846", "847"]
      },
      "Purnia": {
        cities: ["Purnia Sadar", "Banmankhi", "Kasba", "Dhamdaha"],
        pincodePrefixes: ["854"]
      },
      "Begusarai": {
        cities: ["Begusarai Sadar", "Barauni", "Teghra", "Ballia", "Bachhwara"],
        pincodePrefixes: ["851"]
      },
      "Nalanda": {
        cities: ["Bihar Sharif", "Rajgir", "Hilsa", "Nalanda", "Islampur"],
        pincodePrefixes: ["803", "811"]
      },
      "Rohtas": {
        cities: ["Sasaram", "Dehri", "Bikramganj", "Kargahar"],
        pincodePrefixes: ["821"]
      },
      "Bhojpur": {
        cities: ["Arrah", "Piro", "Jagdishpur", "Koilwar"],
        pincodePrefixes: ["802"]
      },
      "Saran": {
        cities: ["Chapra", "Marhaura", "Sonepur", "Revelganj"],
        pincodePrefixes: ["841"]
      },
      "Samastipur": {
        cities: ["Samastipur", "Rosera", "Dalsingsarai", "Tajpur"],
        pincodePrefixes: ["848"]
      },
      "Madhubani": {
        cities: ["Madhubani", "Jhanjharpur", "Benipatti", "Phulparas"],
        pincodePrefixes: ["847"]
      },
      "Sitamarhi": {
        cities: ["Sitamarhi", "Pupri", "Belsand", "Bathnaha"],
        pincodePrefixes: ["843"]
      },
      "Vaishali": {
        cities: ["Hajipur", "Mahnar", "Lalganj", "Rajapakar"],
        pincodePrefixes: ["844"]
      },
      "Bettiah (West Champaran)": {
        cities: ["Bettiah", "Narkatiaganj", "Bagaha", "Chanpatia"],
        pincodePrefixes: ["845"]
      },
      "Motihari (East Champaran)": {
        cities: ["Motihari", "Raxaul", "Dhaka", "Areraj", "Chakia"],
        pincodePrefixes: ["845"]
      },
      "Katihar": {
        cities: ["Katihar", "Barari", "Kora", "Manihari"],
        pincodePrefixes: ["854"]
      },
      "Saharsa": {
        cities: ["Saharsa", "Simri Bakhtiyarpur", "Kahra", "Sonbarsa"],
        pincodePrefixes: ["852"]
      },
      "Siwan": {
        cities: ["Siwan", "Maharajganj", "Guthani", "Darauli"],
        pincodePrefixes: ["841"]
      },
      "Buxar": {
        cities: ["Buxar", "Dumraon", "Simri", "Nawanagar"],
        pincodePrefixes: ["802"]
      },
      "Kaimur (Bhabua)": {
        cities: ["Bhabua", "Mohania", "Adhaura", "Ramgarh"],
        pincodePrefixes: ["821"]
      },
      "Aurangabad": {
        cities: ["Aurangabad", "Daudnagar", "Rafiganj", "Nabinagar"],
        pincodePrefixes: ["824"]
      },
      "Nawada": {
        cities: ["Nawada", "Rajauli", "Hisua", "Warsaliganj"],
        pincodePrefixes: ["805"]
      },
      "Jehanabad": {
        cities: ["Jehanabad", "Makhdumpur", "Kako", "Ghosi"],
        pincodePrefixes: ["804"]
      },
      "Arwal": {
        cities: ["Arwal", "Kenkhar", "Kurtha", "Karpi"],
        pincodePrefixes: ["804"]
      },
      "Sheikhpura": {
        cities: ["Sheikhpura", "Barbigha", "Chewara", "Ariari"],
        pincodePrefixes: ["811"]
      },
      "Lakhisarai": {
        cities: ["Lakhisarai", "Barahiya", "Suryagarha", "Ramgarh Chowk"],
        pincodePrefixes: ["811"]
      },
      "Jamui": {
        cities: ["Jamui", "Jhhajha", "Sikandra", "Gidhaur"],
        pincodePrefixes: ["811"]
      },
      "Banka": {
        cities: ["Banka", "Amarpur", "Belhar", "Katoria"],
        pincodePrefixes: ["813"]
      },
      "Munger": {
        cities: ["Munger", "Jamalpur", "Tarapur", "Haveli Kharagpur"],
        pincodePrefixes: ["811"]
      },
      "Khagaria": {
        cities: ["Khagaria", "Gogri", "Alauli", "Chautham"],
        pincodePrefixes: ["851"]
      },
      "Madhepura": {
        cities: ["Madhepura", "Murliganj", "Singheshwar", "Uda Kishanganj"],
        pincodePrefixes: ["852"]
      },
      "Supaul": {
        cities: ["Supaul", "Birpur", "Triveniganj", "Nirmali"],
        pincodePrefixes: ["852"]
      },
      "Araria": {
        cities: ["Araria", "Forbesganj", "Farbisganj", "Raniganj"],
        pincodePrefixes: ["854"]
      },
      "Kishanganj": {
        cities: ["Kishanganj", "Thakurganj", "Bahadurganj", "Pothia"],
        pincodePrefixes: ["855"]
      },
      "Gopalganj": {
        cities: ["Gopalganj", "Hathwa", "Mirganj", "Bhorey"],
        pincodePrefixes: ["841"]
      }
    };

    // SERVICE DATA WITH PRICES
    const serviceData = {
      "AC Service & Repair": {
        options: [
          { name: "General AC Service", price: 499 },
          { name: "AC Installation", price: 799 },
          { name: "AC Uninstallation", price: 399 },
          { name: "AC Repair", price: 349 },
          { name: "AC Gas Check / Refill", price: 1199 }
        ]
      },
      "Washing Machine": {
        options: [
          { name: "General Service", price: 399 },
          { name: "Washing Machine Repair", price: 499 },
          { name: "Installation", price: 499 },
          { name: "Water Drainage Problem", price: 299 },
          { name: "Spin or Noise Problem", price: 449 }
        ]
      },
      "Fridge & Refrigerator": {
        options: [
          { name: "General Check-up", price: 399 },
          { name: "Fridge Repair", price: 599 },
          { name: "Cooling Problem", price: 649 },
          { name: "Water Leakage", price: 349 },
          { name: "Installation", price: 499 }
        ]
      },
      "RO Service & Repair": {
        options: [
          { name: "RO Service", price: 399 },
          { name: "Filter Replacement", price: 499 },
          { name: "Water Leakage", price: 299 },
          { name: "Low Water Flow", price: 349 },
          { name: "RO Repair", price: 449 }
        ]
      },
      "Cooler Repair": {
        options: [
          { name: "Cooler Service", price: 299 },
          { name: "Pump Repair", price: 249 },
          { name: "Motor Repair", price: 499 },
          { name: "Water Leakage", price: 199 },
          { name: "Cooling Problem", price: 349 }
        ]
      },
      "Electrician": {
        options: [
          { name: "Switch or Socket Repair", price: 199 },
          { name: "Fan Installation", price: 249 },
          { name: "Light Installation", price: 199 },
          { name: "Wiring Check", price: 349 },
          { name: "Electrical Fault", price: 399 }
        ]
      },
      "Geyser Service": {
        options: [
          { name: "Geyser Service", price: 399 },
          { name: "Geyser Repair", price: 449 },
          { name: "Installation", price: 499 },
          { name: "Heating Problem", price: 399 },
          { name: "Water Leakage", price: 349 }
        ]
      },
      "Kitchen Chimney": {
        options: [
          { name: "Chimney Cleaning", price: 749 },
          { name: "Chimney Service", price: 599 },
          { name: "Suction Problem", price: 499 },
          { name: "Motor Check", price: 449 },
          { name: "Chimney Repair", price: 549 }
        ]
      },
      "Other Home Repairs": {
        options: [
          { name: "Door or Handle Repair", price: 199 },
          { name: "Minor Plumbing", price: 249 },
          { name: "Furniture Repair", price: 299 },
          { name: "Drilling or Fitting", price: 199 },
          { name: "Other Repair", price: 99 }
        ]
      },
      "All Home Cleaning": {
        options: [
          { name: "Room Cleaning", price: 599 },
          { name: "Kitchen Cleaning", price: 699 },
          { name: "Bathroom Cleaning", price: 499 },
          { name: "Full Home Cleaning", price: 1299 },
          { name: "Other Cleaning", price: 399 }
        ]
      },
      "OTHER WORK": {
        options: [
          { name: "General Home Maintenance Work", price: 99 },
          { name: "Custom Handyman Task", price: 199 }
        ]
      }
    };

    const serviceSelect = document.getElementById("service");
    const subServicesContainer = document.getElementById("subServicesCheckboxContainer");
    const priceDisplay = document.getElementById("priceDisplay");
    const bookingForm = document.getElementById("bookingForm");
    const successMessage = document.getElementById("successMessage");
    
    const districtSelect = document.getElementById("district");
    const citySelect = document.getElementById("city");
    const pincodeInput = document.getElementById("pincode");

    // Populate Districts
    Object.keys(biharData).sort().forEach(function(dist) {
      const opt = document.createElement("option");
      opt.value = dist;
      opt.textContent = dist;
      districtSelect.appendChild(opt);
    });

    // Update Cities based on District selection
    districtSelect.addEventListener("change", function() {
      const selectedDist = districtSelect.value;
      citySelect.innerHTML = '<option value="">Select City / Area</option>';
      
      if (biharData[selectedDist]) {
        biharData[selectedDist].cities.forEach(function(city) {
          const opt = document.createElement("option");
          opt.value = city;
          opt.textContent = city;
          citySelect.appendChild(opt);
        });
      }
    });

    // Set minimum date to today
    const today = new Date();
    const localToday = [
      today.getFullYear(),
      String(today.getMonth() + 1).padStart(2, "0"),
      String(today.getDate()).padStart(2, "0")
    ].join("-");
    document.getElementById("bookingDate").min = localToday;

    // Populate service dropdown
    Object.keys(serviceData).forEach(function(serviceName) {
      const option = document.createElement("option");
      option.value = serviceName;
      option.textContent = serviceName;
      serviceSelect.appendChild(option);
    });

    // Handle URL parameter or localStorage
    const urlParams = new URLSearchParams(window.location.search);
    const serviceParam = urlParams.get("service");
    const savedService = serviceParam || localStorage.getItem("selectedService") || "AC Service & Repair";

    if (serviceData[savedService]) {
      serviceSelect.value = savedService;
    }

    function updateSubServices() {
      const selectedService = serviceSelect.value;
      const details = serviceData[selectedService] || { options: [] };

      subServicesContainer.innerHTML = "";

      details.options.forEach(function(opt) {
        const div = document.createElement("div");
        div.className = "flex items-center justify-between p-2 bg-white rounded-lg border border-gray-200 cursor-pointer";
        
        div.innerHTML = `
          <label class="flex items-center gap-3 cursor-pointer w-full font-normal m-0">
            <input type="checkbox" name="subServices" value="${opt.name}" data-price="${opt.price}" class="w-4 h-4 accent-[#0b3d2e]" onchange="calculateTotal()">
            <span class="text-sm text-gray-800">${opt.name}</span>
          </label>
          <span class="text-sm font-bold text-[#0b3d2e] whitespace-nowrap">₹${opt.price}</span>
        `;
        subServicesContainer.appendChild(div);
      });

      if (subServicesContainer.querySelector('input[type="checkbox"]')) {
        subServicesContainer.querySelector('input[type="checkbox"]').checked = true;
      }

      calculateTotal();
    }

    function calculateTotal() {
      let total = 0;
      const checkboxes = subServicesContainer.querySelectorAll('input[name="subServices"]:checked');
      checkboxes.forEach(function(cb) {
        total += Number(cb.getAttribute("data-price")) || 0;
      });
      priceDisplay.textContent = "₹" + total;
    }

    serviceSelect.addEventListener("change", updateSubServices);
    updateSubServices();

    // PINCODE VALIDATION
    pincodeInput.addEventListener("blur", function() {
      const pin = pincodeInput.value.trim();
      const selectedDist = districtSelect.value;

      if (pin.length !== 6) return;

      if (!selectedDist) {
        alert("Pehle kripya District select karein!");
        pincodeInput.value = "";
        return;
      }

      const allowedPrefixes = biharData[selectedDist].pincodePrefixes;
      const matches = allowedPrefixes.some(prefix => pin.startsWith(prefix));

      if (!matches) {
        alert("Error: Yeh Pin Code selected District (" + selectedDist + ") se match nahi karta hai!");
        pincodeInput.value = "";
        return;
      }

    });

    // Load saved customer addresses and let the customer choose one for this booking.
    function loadSavedBookingAddresses() {
      const container = document.getElementById("savedAddressOptions");
      if (!container) return;
      let saved = [];
      try {
        saved = JSON.parse(localStorage.getItem("gharsathi_addresses_db") || "[]");
        if (!Array.isArray(saved)) saved = [];
      } catch (e) { saved = []; }

      container.innerHTML = "";
      if (!saved.length) {
        container.innerHTML = '<div class="muted" style="padding:14px;border:1px dashed #cbd8d0;border-radius:10px;">No saved addresses found. Add an address to your account, or enter your address manually in Your Details below.</div>';
        return;
      }

      saved.forEach(function(addr, index) {
        const label = document.createElement("label");
        label.className = "saved-address-option";
        label.style.cssText = "display:flex;gap:12px;align-items:flex-start;padding:14px;border:1px solid #dce6e0;border-radius:12px;cursor:pointer;background:#fff;";
        const radio = document.createElement("input");
        radio.type = "radio";
        radio.name = "savedAddressChoice";
        radio.value = String(addr.id ?? index);
        radio.style.cssText = "width:auto;margin-top:4px;flex-shrink:0;";
        radio.addEventListener("change", function() { applySavedBookingAddress(addr); });
        const content = document.createElement("span");
        content.style.cssText = "display:block;min-width:0;";
        const title = document.createElement("strong");
        title.textContent = (addr.type || "Address") + (addr.isDefault ? " · Default" : "");
        title.style.cssText = "display:block;color:#0b3d2e;margin-bottom:4px;";
        const addressText = document.createElement("span");
        addressText.textContent = addr.fullAddress || addr.address || "Saved address";
        addressText.style.cssText = "display:block;font-size:13px;line-height:1.5;overflow-wrap:anywhere;";
        const contact = document.createElement("span");
        contact.textContent = [addr.name, addr.phone].filter(Boolean).join(" · ");
        contact.style.cssText = "display:block;font-size:12px;color:#65736b;margin-top:5px;";
        content.appendChild(title);
        content.appendChild(addressText);
        if (contact.textContent) content.appendChild(contact);
        label.appendChild(radio);
        label.appendChild(content);
        container.appendChild(label);
      });

      const preferred = saved.find(a => a.isDefault) || saved[0];
      if (preferred) {
        const preferredRadio = Array.from(container.querySelectorAll('input[name="savedAddressChoice"]'))
          .find(r => r.value === String(preferred.id ?? saved.indexOf(preferred)));
        if (preferredRadio) {
          preferredRadio.checked = true;
          applySavedBookingAddress(preferred);
        }
      }
    }

    function applySavedBookingAddress(addr) {
      const setValue = (id, value) => {
        const el = document.getElementById(id);
        if (el && value != null && String(value).trim()) {
          el.value = String(value).trim();
          el.dispatchEvent(new Event("change", { bubbles: true }));
        }
      };
      setValue("customerName", addr.name);
      setValue("mobile", String(addr.phone || "").replace(/^\+91\s*/, "").replace(/\D/g, "").slice(-10));
      setValue("address", addr.fullAddress || addr.address || "");

      // Older saved addresses store a single formatted fullAddress string.
      const parts = String(addr.fullAddress || addr.address || "").split(",").map(s => s.trim()).filter(Boolean);
      if (parts.length >= 4) {
        const last = parts[parts.length - 1].match(/^(.+?)\s*-\s*(\d{6})$/);
        if (last) {
          setValue("state", last[1]);
          setValue("pincode", last[2]);
          const district = parts[parts.length - 2];
          const city = parts[parts.length - 3];
          const districtOption = Array.from(districtSelect.options).find(o => o.value.toLowerCase() === district.toLowerCase());
          if (districtOption) {
            districtSelect.value = districtOption.value;
            districtSelect.dispatchEvent(new Event("change", { bubbles: true }));
            const cityOption = Array.from(citySelect.options).find(o => o.value.toLowerCase() === city.toLowerCase());
            if (cityOption) citySelect.value = cityOption.value;
          }
        }
      }
    }

    loadSavedBookingAddresses();
    window.addEventListener("storage", function(event) {
      if (event.key === "gharsathi_addresses_db") loadSavedBookingAddresses();
    });

    // BOOKING FORM SUBMISSION
    bookingForm.addEventListener("submit", function(event) {
      event.preventDefault();

      if (!bookingForm.reportValidity()) return;
      
      const selectedDist = districtSelect.value;
      const pin = pincodeInput.value.trim();
      const allowedPrefixes = biharData[selectedDist].pincodePrefixes;
      if (!allowedPrefixes.some(prefix => pin.startsWith(prefix))) {
        alert("Error: Pin Code aur District match nahi ho rahe hain!");
        pincodeInput.focus();
        return;
      }

      const selectedSubServices = [];
      const checkboxes = subServicesContainer.querySelectorAll('input[name="subServices"]:checked');
      
      checkboxes.forEach(function(cb) {
        selectedSubServices.push({
          name: cb.value,
          price: Number(cb.getAttribute("data-price"))
        });
      });

      if (selectedSubServices.length === 0) {
        alert("Please select at least one sub-service.");
        return;
      }

      const paymentMethod = document.querySelector('input[name="paymentMethod"]:checked');
      if (!paymentMethod) {
        alert("Please select a payment method.");
        return;
      }

      const bookingPayload = {
        service: serviceSelect.value,
        subServices: selectedSubServices,
        totalPrice: priceDisplay.textContent,
        customerName: document.getElementById("customerName").value.trim(),
        mobile: document.getElementById("mobile").value.trim(),
        state: document.getElementById("state").value,
        district: selectedDist,
        city: citySelect.value,
        pincode: pin,
        address: document.getElementById("address").value.trim(),
        bookingDate: document.getElementById("bookingDate").value,
        bookingTime: document.getElementById("bookingTime").value,
        status: "Pending",
        paymentMethod: paymentMethod.value,
        createdAt: new Date().toISOString()
      };

      dbRef.push(bookingPayload)
        .then(() => {
          successMessage.style.display = "block";
          successMessage.textContent = "Booking submitted successfully! Your service request has been received.";
          successMessage.scrollIntoView({ behavior: "smooth", block: "center" });
          bookingForm.reset();
        })
        .catch((error) => {
          alert("Database me save karte samay error aayi: " + error.message);
        });
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
  window.gsUpdateProfilePhoto = function(event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { alert('Please select an image file.'); return; }
    const reader = new FileReader();
    reader.onload = function(e) {
      ['gharsathi_photo','userAvatar','profilePhoto','profileImage'].forEach(k => localStorage.setItem(k, e.target.result));
      init();
    };
    reader.readAsDataURL(file);
  };
  window.gsRemoveProfilePhoto = function() {
    ['gharsathi_photo','userAvatar','profilePhoto','profileImage'].forEach(k => localStorage.removeItem(k));
    const input = document.getElementById('gsProfileImageInput');
    if (input) input.value = '';
    init();
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
    const photo=getFirst(['gharsathi_photo','userAvatar','profilePhoto','profileImage']);
    const small=document.getElementById('gsProfileButton');
    const large=document.getElementById('gsProfileLargeAvatar');
    if(small) avatarMarkup(small,name,photo,true);
    if(large) avatarMarkup(large,name,photo,false);
    const n=document.getElementById('gsProfileName');
    const p=document.getElementById('gsProfilePhone');
    if(n) n.textContent=name;
    if(p) p.textContent=phone || 'Manage your Ghar Sathi account';
    const remove = document.getElementById('gsRemoveProfilePhoto');
    if(remove) remove.style.display = photo ? 'block' : 'none';
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',init); else init();
})();


// Keep profile photos synchronized across all GharSathi pages/tabs.
window.addEventListener('storage', function(event) {
  if (event.key === 'gharsathi_photo') window.location.reload();
});

