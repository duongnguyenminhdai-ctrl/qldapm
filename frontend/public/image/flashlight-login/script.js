const passwordInput = document.getElementById('password');
const toggleButton = document.getElementById('show-password');
const statusMessage = document.getElementById('status');
const beam = document.getElementById('flash-beam');
const passwordOverlay = document.getElementById('password-reveal');
const passwordChars = document.getElementById('reveal-text');
const flashlight = document.getElementById('flashlight');
const owl = document.getElementById('email-owl');

let nightMode = false;
let pointer = { x: 0, y: 0 };
let angleRad = Math.PI;

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function updateOwlGaze(dx, dy, lit) {
  const distance = Math.max(1, Math.hypot(dx, dy));
  const x = lit ? dx / distance : 0;
  const y = lit ? dy / distance : 0;
  owl.classList.toggle('is-lit', lit);
  owl.style.setProperty('--owl-gaze-x', `${x * 3.2}px`);
  owl.style.setProperty('--owl-gaze-y', `${y * 2.6}px`);
  owl.style.setProperty('--owl-head-x', `${x * 2}px`);
  owl.style.setProperty('--owl-head-y', `${y * 1.2}px`);
  owl.style.setProperty('--owl-tilt', `${x * 9}deg`);
}

function renderPassword() {
  passwordChars.replaceChildren(...Array.from(passwordInput.value, (letter) => {
    const character = document.createElement('span');
    character.className = 'reveal-char';
    const masked = document.createElement('span');
    masked.className = 'masked-char';
    masked.textContent = '•';
    const plain = document.createElement('span');
    plain.className = 'plain-char';
    plain.textContent = letter;
    character.append(masked, plain);
    return character;
  }));
}

function updateFlashlight() {
  if (!nightMode) return;

  const eyeRect = toggleButton.getBoundingClientRect();
  const fieldRect = passwordInput.getBoundingClientRect();
  const eyeX = eyeRect.left + eyeRect.width / 2;
  const eyeY = eyeRect.top + eyeRect.height / 2;
  const pointerDistance = Math.hypot(pointer.x - eyeX, pointer.y - eyeY);
  if (pointerDistance > 24) {
    angleRad = Math.atan2(pointer.y - eyeY, pointer.x - eyeX);
  }
  const angleDeg = angleRad * 180 / Math.PI;
  const unitX = Math.cos(angleRad);
  const unitY = Math.sin(angleRad);
  const originX = eyeX + unitX * 13;
  const originY = eyeY + unitY * 13;
  const beamLength = clamp(pointerDistance * 1.65, 160, 1600);
  const beamHeight = beamLength * .38;

  beam.style.left = `${originX}px`;
  beam.style.top = `${originY - beamHeight / 2}px`;
  beam.style.width = `${beamLength}px`;
  beam.style.height = `${beamHeight}px`;
  beam.style.transform = `rotate(${angleDeg}deg)`;
  flashlight.style.left = `${eyeX - 17}px`;
  flashlight.style.top = `${eyeY - 17}px`;
  flashlight.style.transform = `rotate(${angleDeg}deg)`;

  passwordOverlay.style.left = `${fieldRect.left}px`;
  passwordOverlay.style.top = `${fieldRect.top}px`;
  passwordOverlay.style.width = `${Math.max(0, fieldRect.width - 45)}px`;
  passwordOverlay.style.height = `${fieldRect.height}px`;
  passwordChars.style.transform = `translateX(${-passwordInput.scrollLeft}px)`;
  
  function getLightLevel(x, y) { 
    const offsetX = x - originX;
    const offsetY = y - originY;
    const along = offsetX * unitX + offsetY * unitY;
    const sideways = Math.abs(-offsetX * unitY + offsetY * unitX);
    const halfBeam = beamHeight * (.01 + .49 * Math.max(0, along) / beamLength);
    const edgeFade = clamp((halfBeam - sideways + 4) / 16, 0, 1);
    const tail = clamp((along / beamLength - .55) / .41, 0, 1);
    const endFade = 1 - tail * tail * (3 - 2 * tail);
    return along >= 0 ? edgeFade * endFade : 0;
  }
  for (const character of passwordChars.children) {
    const bounds = character.getBoundingClientRect();
    character.style.setProperty('--lit', String(getLightLevel(bounds.left + bounds.width / 2, fieldRect.top + fieldRect.height / 2)));
  }
  const owlBounds = owl.getBoundingClientRect();
  const owlX = owlBounds.left + owlBounds.width / 2;
  const owlY = owlBounds.top + owlBounds.height / 2;
  const owlLight = getLightLevel(owlX, owlY);
  owl.style.opacity = String(owlLight);
  updateOwlGaze(originX - owlX, originY - (owlBounds.top + owlBounds.height * .36), owlLight > .08);
}

function setNightMode(enabled) {
  nightMode = enabled;
  document.body.classList.toggle('night', enabled);
  toggleButton.setAttribute('aria-pressed', String(enabled));
  toggleButton.setAttribute('aria-label', enabled ? 'Turn off flashlight' : 'Show password with flashlight');
  if (enabled) {
    renderPassword();
    const fieldRect = passwordInput.getBoundingClientRect();
    angleRad = Math.PI;
    pointer = { x: fieldRect.left, y: fieldRect.top + fieldRect.height / 2 };
    updateFlashlight();
  } else {
    passwordChars.replaceChildren();
    owl.style.opacity = '0';
    updateOwlGaze(0, 0, false);
  }
}

document.addEventListener('pointermove', (event) => {
  if (!nightMode) return;
  pointer = { x: event.clientX, y: event.clientY };
  updateFlashlight();
});

passwordInput.addEventListener('input', () => {
  if (nightMode) renderPassword();
  updateFlashlight();
});

passwordInput.addEventListener('scroll', updateFlashlight);
window.addEventListener('resize', updateFlashlight);
window.addEventListener('scroll', updateFlashlight, true);
toggleButton.addEventListener('click', () => {
  setNightMode(!nightMode);
});

document.getElementById('forgot-password').addEventListener('click', () => {
  statusMessage.textContent = 'Password reset is not configured.';
});

document.getElementById('signup').addEventListener('click', () => {
  statusMessage.textContent = 'Registration is not configured.';
});

document.getElementById('login-form').addEventListener('submit', (event) => {
  event.preventDefault();
  statusMessage.textContent = 'Sign-in is not configured.';
});