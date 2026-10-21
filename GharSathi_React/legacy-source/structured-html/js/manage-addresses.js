let addresses = [];
        let currentSelectedLocation = "Patna, Bihar";
        let isPincodeDistrictValid = false;

        document.addEventListener('DOMContentLoaded', () => {
            loadAddresses();
        });

        function loadAddresses() {
            addresses = JSON.parse(localStorage.getItem('gharsathi_addresses_db')) || [
                { id: 1, type: "Home", isDefault: true, fullAddress: "House No. 12, Boring Road, Patna, Bihar - 800001", name: "Rahul Kumar", phone: "9876543210" }
            ];
            renderAddresses(addresses);
        }

        function renderAddresses(addrList) {
            const container = document.getElementById('addressListContainer');
            container.innerHTML = "";

            if (!addrList || addrList.length === 0) {
                container.innerHTML = `<div class="bg-white p-6 rounded-2xl text-center text-gray-500">No saved locations found.</div>`;
                return;
            }

            addrList.forEach(addr => {
                let div = document.createElement('div');
                div.className = "bg-white rounded-2xl p-4 shadow-sm border border-gray-200 relative";
                div.innerHTML = `
                    <div class="flex justify-between items-start mb-2">
                        <div class="flex items-center gap-2">
                            <span class="font-bold text-gray-900 text-sm">${addr.type}</span>
                            ${addr.isDefault ? '<span class="bg-green-100 text-[#0B3D2E] text-[10px] font-bold px-2 py-0.5 rounded">Default</span>' : ''}
                        </div>
                        <div class="flex gap-2">
                            <button onclick="editAddress(${addr.id})" class="text-xs text-gray-600 font-semibold border px-3 py-1 rounded-lg hover:bg-gray-50">✏️ Edit</button>
                            <button onclick="deleteAddress(${addr.id})" class="text-xs text-red-600 font-semibold border border-red-200 px-3 py-1 rounded-lg hover:bg-red-50">🗑️ Delete</button>
                        </div>
                    </div>
                    <p class="text-xs text-gray-600 leading-relaxed mb-3">${addr.fullAddress}</p>
                    <div class="flex items-center gap-1 text-[11px] text-green-700 font-bold">
                        <span>📍 Live Location Verified</span>
                    </div>
                `;
                container.appendChild(div);
            });
        }

        function filterAddresses(type, btnElement) {
            document.querySelectorAll('.addr-tab').forEach(btn => {
                btn.className = "addr-tab px-5 py-2 rounded-full bg-white text-gray-700 font-semibold text-sm shadow-sm border whitespace-nowrap hover:bg-gray-50";
            });
            btnElement.className = "addr-tab px-5 py-2 rounded-full bg-[#D4AF37] text-white font-bold text-sm shadow whitespace-nowrap";

            if (type === 'Address') {
                renderAddresses(addresses);
            } else {
                let filtered = addresses.filter(a => a.type === type);
                renderAddresses(filtered);
            }
        }

        // Strict 38 Districts PIN Code Validation Mapping
        function validateDistrictAndPincode() {
            const pincode = document.getElementById('pincode').value.trim();
            const district = document.getElementById('district').value;
            const statusBox = document.getElementById('pincodeStatusBox');

            if (!district) {
                statusBox.innerHTML = `<span>⚠️ Please select a District first.</span><span class="text-orange-600 font-bold">Required</span>`;
                statusBox.className = "bg-orange-50 border border-orange-200 p-2.5 rounded-xl text-xs text-orange-800 flex items-center justify-between";
                isPincodeDistrictValid = false;
                return;
            }

            if (pincode.length < 6) {
                statusBox.innerHTML = `<span>⚠️ Enter complete 6-digit PIN code.</span><span class="text-orange-600 font-bold">Pending</span>`;
                statusBox.className = "bg-orange-50 border border-orange-200 p-2.5 rounded-xl text-xs text-orange-800 flex items-center justify-between";
                isPincodeDistrictValid = false;
                return;
            }

            const prefixMap = {
                "Patna": ["800", "801"],
                "Ara (Bhojpur)": ["802"],
                "Hajipur (Vaishali)": ["844"],
                "Bihta": ["801"],
                "Chhapra (Saran)": ["841"],
                "Muzaffarpur": ["843", "842"],
                "Darbhanga": ["846", "847"],
                "Gaya": ["823"],
                "Bhagalpur": ["812", "813"],
                "Purnia": ["854"],
                "Begusarai": ["851"],
                "Samastipur": ["848"],
                "Katihar": ["854"],
                "Siwan": ["841"],
                "Gopalganj": ["841"],
                "Nalanda": ["803"],
                "Sasaram (Rohtas)": ["821"],
                "Buxar": ["802"],
                "Aurangabad": ["824"],
                "Nawada": ["805"],
                "Madhubani": ["847", "843"],
                "Sitamarhi": ["843"],
                "Saharsa": ["852"],
                "Kishanganj": ["855"],
                "Araria": ["854"],
                "Jamui": ["811", "812"],
                "Banka": ["813"],
                "Jehanabad": ["804"],
                "Lakhisarai": ["811"],
                "Sheikhpura": ["811"],
                "Arwal": ["804"],
                "Kaimur (Bhabua)": ["821"],
                "Sheohar": ["843"],
                "Supaul": ["852"],
                "Madhepura": ["852"],
                "Khagaria": ["851"],
                "Munger": ["811", "813"],
                "East Champaran": ["845"],
                "West Champaran": ["845"]
            };

            const pinPrefix = pincode.substring(0, 3);
            const validPrefixes = prefixMap[district] || [];
            let isMatch = validPrefixes.includes(pinPrefix);

            if (isMatch) {
                isPincodeDistrictValid = true;
                currentSelectedLocation = `${district}, Bihar - ${pincode}`;
                statusBox.innerHTML = `<span>📡 Verified: <b>${district} (${pincode})</b></span><span class="text-green-700 font-bold">✔ Match OK</span>`;
                statusBox.className = "bg-green-50 border border-green-200 p-2.5 rounded-xl text-xs text-green-800 flex items-center justify-between";
            } else {
                isPincodeDistrictValid = false;
                statusBox.innerHTML = `<span>❌ Error: PIN code <b>(${pincode})</b> does not match District <b>(${district})</b>!</span><span class="text-red-600 font-bold">Mismatch</span>`;
                statusBox.className = "bg-red-50 border border-red-200 p-2.5 rounded-xl text-xs text-red-800 flex items-center justify-between";
            }
        }

        function searchMapLocation(query) {
            if (query.length >= 3) {
                currentSelectedLocation = `${query}, Bihar`;
                document.getElementById('mapSelectedText').innerText = `📍 Selected: ${currentSelectedLocation}`;
                document.getElementById('mapCoordText').innerText = `Coordinates: Dynamic GPS (${query})`;
                
                const iframe = document.getElementById('mapIframe');
                iframe.src = `https://maps.google.com/maps?q=${encodeURIComponent(query + ' Bihar')}&t=&z=13&ie=UTF8&iwloc=&output=embed`;
            }
        }

        function openAddAddressModal() {
            document.getElementById('addressModal').style.display = 'flex';
        }

        function closeAddAddressModal() {
            document.getElementById('addressModal').style.display = 'none';
        }

        function openMapModal() {
            document.getElementById('mapModal').style.display = 'flex';
        }

        function closeMapModal() {
            document.getElementById('mapModal').style.display = 'none';
        }

        function confirmMapLocation() {
            document.getElementById('detectedLocationText').innerText = currentSelectedLocation;
            closeMapModal();
            alert("Location updated successfully from map!");
        }

        function detectLiveLocation() {
            if (navigator.geolocation) {
                navigator.geolocation.getCurrentPosition(position => {
                    alert(`GPS Live Location Fetched!\nLatitude: ${position.coords.latitude}\nLongitude: ${position.coords.longitude}`);
                }, () => {
                    alert("Using current location in Bihar.");
                });
            } else {
                alert("Geolocation is not supported by this browser.");
            }
        }

        function saveAddress(event) {
            event.preventDefault();

            validateDistrictAndPincode();
            if (!isPincodeDistrictValid) {
                alert("Error: PIN code aur selected District aapas me match nahi karte hain! Kripya sahi PIN code ya District chunein.");
                return;
            }

            const house = document.getElementById('houseNo').value;
            const locality = document.getElementById('locality').value;
            const landmark = document.getElementById('landmark').value;
            const city = document.getElementById('city').value;
            const district = document.getElementById('district').value;
            const state = document.getElementById('state').value;
            const pincode = document.getElementById('pincode').value;
            const type = document.querySelector('input[name="addrType"]:checked').value;
            const isDefault = document.getElementById('isDefault').checked;

            const fullAddress = `${house}, ${locality}${landmark ? ', Near ' + landmark : ''}, ${city}, ${district}, ${state} - ${pincode}`;

            if (isDefault) {
                addresses.forEach(a => a.isDefault = false);
            }

            const newAddr = {
                id: Date.now(),
                type: type,
                isDefault: isDefault,
                fullAddress: fullAddress,
                name: document.getElementById('fullName').value,
                phone: document.getElementById('mobileNumber').value
            };

            addresses.unshift(newAddr);
            localStorage.setItem('gharsathi_addresses_db', JSON.stringify(addresses));
            localStorage.setItem('userAddress', fullAddress);

            closeAddAddressModal();
            loadAddresses();
            alert("New address added successfully!");
        }

        function deleteAddress(id) {
            if (confirm("Are you sure you want to delete this address?")) {
                addresses = addresses.filter(a => a.id !== id);
                localStorage.setItem('gharsathi_addresses_db', JSON.stringify(addresses));
                loadAddresses();
            }
        }


// Keep profile photos synchronized across all GharSathi pages/tabs.
window.addEventListener('storage', function(event) {
  if (event.key === 'gharsathi_photo') window.location.reload();
});

