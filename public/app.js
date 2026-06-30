const form = document.getElementById('form');
const situationEl = document.getElementById('situation');
const submitBtn = document.getElementById('submitBtn');
const errorEl = document.getElementById('error');
const loadingEl = document.getElementById('loading');
const resultsEl = document.getElementById('results');
const template = document.getElementById('resultTemplate');

let currentUtterance = null;

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((err) => {
      console.error('Service worker registration failed:', err);
    });
  });
}

function showError(msg) {
  errorEl.textContent = msg;
  errorEl.hidden = false;
}

function clearError() {
  errorEl.hidden = true;
  errorEl.textContent = '';
}

function stopSpeaking() {
  speechSynthesis.cancel();
  document.querySelectorAll('.speakBtn.active').forEach(b => {
    b.classList.remove('active');
    b.textContent = '🔊 Listen';
  });
}

function renderResults(analogies) {
  resultsEl.innerHTML = '';
  analogies.forEach((a, i) => {
    const node = template.content.cloneNode(true);
    const card = node.querySelector('.card');
    node.querySelector('.card-title').textContent = a.title || `Analogy ${i + 1}`;
    node.querySelector('.card-text').textContent = a.text || '';

    const copyBtn = node.querySelector('.copyBtn');
    copyBtn.addEventListener('click', async () => {
      await navigator.clipboard.writeText(a.text || '');
      copyBtn.textContent = 'Copied!';
      setTimeout(() => (copyBtn.textContent = 'Copy'), 1500);
    });

    const speakBtn = node.querySelector('.speakBtn');
    speakBtn.addEventListener('click', () => {
      const isActive = speakBtn.classList.contains('active');
      stopSpeaking();
      if (isActive) return; // was playing, now stopped

      const utter = new SpeechSynthesisUtterance(a.text || '');
      utter.onend = () => {
        speakBtn.classList.remove('active');
        speakBtn.textContent = '🔊 Listen';
      };
      currentUtterance = utter;
      speakBtn.classList.add('active');
      speakBtn.textContent = '⏸ Stop';
      speechSynthesis.speak(utter);
    });

    resultsEl.appendChild(card);
  });
  resultsEl.hidden = false;
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  clearError();
  stopSpeaking();
  resultsEl.hidden = true;

  const situation = situationEl.value.trim();
  if (!situation) {
    showError('Please describe a situation first.');
    return;
  }

  submitBtn.disabled = true;
  loadingEl.hidden = false;

  try {
    const res = await fetch('/api/analogize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ situation }),
    });
    const data = await res.json();

    if (!res.ok) {
      showError(data.error || 'Something went wrong. Please try again.');
      return;
    }

    if (!data.analogies || !data.analogies.length) {
      showError('No analogies could be generated. Try rephrasing your situation.');
      return;
    }

    renderResults(data.analogies);
  } catch (err) {
    showError('Network error. Please check your connection and try again.');
  } finally {
    submitBtn.disabled = false;
    loadingEl.hidden = true;
  }
});
