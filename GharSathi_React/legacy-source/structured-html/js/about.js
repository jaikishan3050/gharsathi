// Check karein ki user logged in hai ya nahi
    const isLoggedIn = localStorage.getItem('isLoggedIn');
    if (!isLoggedIn || isLoggedIn !== 'true') {
        window.location.href = 'login.html';
    }


document.getElementById("currentYear").textContent =
            new Date().getFullYear();

        /* Customer profile menu and photo controls */
        (function () {
          const wrap=document.getElementById("customerProfileWrap");
          const button=document.getElementById("customerProfileLink");
          const menu=document.getElementById("customerProfileDropdown");
          const nameEl=document.getElementById("aboutProfileName");
          const large=document.getElementById("aboutProfileLargeAvatar");
          const small=document.getElementById("profileInitial");
          const input=document.getElementById("aboutProfileImageInput");
          const remove=document.getElementById("aboutRemovePhoto");
          function render(){
            const name=localStorage.getItem("userName")||localStorage.getItem("customerName")||localStorage.getItem("name")||"Customer";
            const photo=localStorage.getItem("gharsathi_photo")||localStorage.getItem("userAvatar")||localStorage.getItem("profilePhoto")||localStorage.getItem("profileImage")||"";
            const initial=(name.trim().charAt(0)||"C").toUpperCase();
            small.textContent=initial; small.style.display="inline";
            large.innerHTML="";
            if(photo){ const a=document.createElement("img"); a.src=photo; a.alt="Customer profile photo"; large.appendChild(a); small.style.display="none"; const b=document.createElement("img"); b.src=photo; b.alt="Customer profile photo"; button.appendChild(b); }
            else { const old=button.querySelector("img"); if(old)old.remove(); large.textContent=initial; }
            nameEl.textContent=name; remove.hidden=!photo;
          }
          button.addEventListener("click",e=>{e.stopPropagation();menu.hidden=!menu.hidden;button.setAttribute("aria-expanded",String(!menu.hidden));});
          document.addEventListener("click",e=>{if(wrap&&!wrap.contains(e.target)){menu.hidden=true;button.setAttribute("aria-expanded","false");}});
          input.addEventListener("change",e=>{const file=e.target.files&&e.target.files[0];if(!file)return;if(!file.type.startsWith("image/")){alert("Please select an image file.");return;}const reader=new FileReader();reader.onload=ev=>{["userAvatar","profilePhoto","profileImage"].forEach(k=>localStorage.setItem(k,ev.target.result));render();};reader.readAsDataURL(file);});
          remove.addEventListener("click",()=>{["userAvatar","profilePhoto","profileImage"].forEach(k=>localStorage.removeItem(k));input.value="";const old=button.querySelector("img");if(old)old.remove();render();});
          document.getElementById("aboutLogout").addEventListener("click",()=>{localStorage.removeItem("isLoggedIn");localStorage.removeItem("user");window.location.href="index.html";});
          render();
        })();


// Keep profile photos synchronized across all GharSathi pages/tabs.
window.addEventListener('storage', function(event) {
  if (event.key === 'gharsathi_photo') window.location.reload();
});

