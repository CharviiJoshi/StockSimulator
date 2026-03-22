const form = document.getElementById('profileForm');
const avatarInput = document.getElementById('avatarInput');
const avatarPreview = document.getElementById('avatarPreview');
const message = document.getElementById('formMessage');
const resetBtn = document.getElementById('resetBtn');
const cancelBtn = document.getElementById('cancelBtn');

function showMessage(type, text) {
    message.className = `message ${type}`;
    message.textContent = text;
}

avatarInput.addEventListener('change', (event) => {
    const [file] = event.target.files;
    if (!file) return;

    const isValidType = ['image/jpeg', 'image/png', 'image/webp'].includes(file.type);
    const isValidSize = file.size <= 2 * 1024 * 1024;

    if (!isValidType || !isValidSize) {
    showMessage('error', 'Avatar must be PNG/JPG/WEBP and under 2MB.');
    avatarInput.value = '';
    return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
    avatarPreview.src = e.target.result;
    showMessage('success', 'Avatar updated locally. Click Save Profile to confirm.');
    };
    reader.readAsDataURL(file);
});

form.addEventListener('submit', (event) => {
    event.preventDefault();

    const firstName = form.firstName.value.trim();
    const lastName = form.lastName.value.trim();
    const email = form.email.value.trim();
    const username = form.username.value.trim();

    if (!firstName || !lastName || !email || !username) {
    showMessage('error', 'Please fill all required fields.');
    return;
    }

    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(email)) {
    showMessage('error', 'Please enter a valid email address.');
    return;
    }

    showMessage('success', 'Profile saved successfully.');
    console.log('Profile payload:', {
    firstName,
    lastName,
    email,
    phone: form.phone.value.trim(),
    username,
    timezone: form.timezone.value,
    bio: form.bio.value.trim()
    });
});

resetBtn.addEventListener('click', () => {
    form.reset();
    message.className = 'message';
    message.textContent = '';
});

cancelBtn.addEventListener('click', () => {
    window.history.back();
});