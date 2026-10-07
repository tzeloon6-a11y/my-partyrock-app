// SmartMed Cycle — frontend application logic
// Handles markdown-line streaming render, file uploads, and all widget wiring.

const API_KEY = 'JDVUCGISBKDGCIUVUGDM';

const STREAM_URLS = {
  extract_from_photo: 'https://cmctzcoiqgy7kfnobf4oks2hke0hwovl.lambda-url.ap-southeast-1.on.aws/',
  medicine_card: 'https://67kwx5o7at7pwkdz4aawjimhf40mcsgf.lambda-url.ap-southeast-1.on.aws/',
  my_medicine_summary: 'https://e5kmcru3qrdjmykrtni6odtfzu0qcyet.lambda-url.ap-southeast-1.on.aws/',
  my_return_plan: 'https://6mdiivzhfrmii3d43bg6bl646q0aucvv.lambda-url.ap-southeast-1.on.aws/',
  smartmed_help: 'https://pyjpj4mrzcd5yo7j7nc2cigfai0tprmo.lambda-url.ap-southeast-1.on.aws/',
};

// ---------------------------------------------------------------------
// Markdown-per-line renderer
// ---------------------------------------------------------------------

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function renderInlineMarkdown(text) {
  let out = escapeHtml(text);
  out = out.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  out = out.replace(/(?<!\*)\*([^*]+?)\*(?!\*)/g, '<em>$1</em>');
  out = out.replace(/`([^`]+?)`/g, '<code class="md-inline-code">$1</code>');
  // bare links
  out = out.replace(/(https?:\/\/[^\s)]+)(?![^<]*>)/g, '<a href="$1" target="_blank" rel="noopener">$1</a>');
  // markdown links [text](url)
  out = out.replace(/\[([^\]]+)\]\((https?:[^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
  return out;
}

function classifyLine(line) {
  const trimmed = line.trim();
  if (trimmed === '') return { cls: 'md-empty', html: '&nbsp;' };
  if (/^---+$/.test(trimmed)) return { cls: 'md-hr', html: '' };
  if (/^###\s+/.test(trimmed)) return { cls: 'md-h3', html: renderInlineMarkdown(trimmed.replace(/^###\s+/, '')) };
  if (/^##\s+/.test(trimmed)) return { cls: 'md-h2', html: renderInlineMarkdown(trimmed.replace(/^##\s+/, '')) };
  if (/^#\s+/.test(trimmed)) return { cls: 'md-h1', html: renderInlineMarkdown(trimmed.replace(/^#\s+/, '')) };
  if (/^[-*]\s+/.test(trimmed)) return { cls: 'md-li', html: '• ' + renderInlineMarkdown(trimmed.replace(/^[-*]\s+/, '')) };
  if (/^\d+\.\s+/.test(trimmed)) return { cls: 'md-li', html: renderInlineMarkdown(trimmed) };
  return { cls: 'md-plain', html: renderInlineMarkdown(trimmed) };
}

/**
 * Appends a single line of markdown as an animated span to the container.
 */
function appendMarkdownLine(container, line) {
  const { cls, html } = classifyLine(line);
  const span = document.createElement('span');
  span.className = `md-line ${cls}`;
  span.innerHTML = html;
  container.appendChild(span);
  container.scrollTop = container.scrollHeight;
  return span;
}

function removeCursor(container) {
  const cursor = container.querySelector('.cursor-blink');
  if (cursor) cursor.remove();
}

function ensureCursorOnLastLine(container) {
  removeCursor(container);
  const lines = container.querySelectorAll('.md-line');
  const last = lines[lines.length - 1];
  const cursor = document.createElement('span');
  cursor.className = 'cursor-blink';
  if (last) {
    last.appendChild(cursor);
  } else {
    container.appendChild(cursor);
  }
}

// ---------------------------------------------------------------------
// Streaming fetch helper
// ---------------------------------------------------------------------

/**
 * Streams a POST request body line-by-line into a container element using
 * the markdown line renderer, calling onDone(fullText) when finished.
 */
async function streamToContainer(url, body, container, { onDone, onError } = {}) {
  container.innerHTML = '';
  let buffer = '';
  let fullText = '';
  let currentLineSpan = null;

  try {
    if (!url || url.startsWith('__URL_')) {
      throw new Error('This Lambda URL has not been configured yet. Deploy via GitHub Actions first.');
    }

    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': API_KEY },
      body: JSON.stringify(body),
    });

    if (!resp.ok) {
      throw new Error(`Request failed (${resp.status})`);
    }

    const reader = resp.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value, { stream: true });
      fullText += chunk;
      buffer += chunk;

      let newlineIdx;
      while ((newlineIdx = buffer.indexOf('\n')) !== -1) {
        const line = buffer.slice(0, newlineIdx);
        buffer = buffer.slice(newlineIdx + 1);
        currentLineSpan = appendMarkdownLine(container, line);
        ensureCursorOnLastLine(container);
      }
    }

    // flush remaining buffer as the final line
    if (buffer.length > 0) {
      currentLineSpan = appendMarkdownLine(container, buffer);
    }
    removeCursor(container);

    if (onDone) onDone(fullText);
  } catch (err) {
    removeCursor(container);
    const errDiv = document.createElement('div');
    errDiv.className = 'error-text';
    errDiv.textContent = `⚠️ ${err.message || 'Something went wrong. Please try again.'}`;
    container.appendChild(errDiv);
    if (onError) onError(err);
  }
}

function showLoading(container) {
  container.innerHTML = '';
  const row = document.createElement('div');
  row.className = 'loading-row';
  row.innerHTML = '<span class="spinner"></span><span>Thinking…</span>';
  container.appendChild(row);
}

// ---------------------------------------------------------------------
// File upload (drag & drop) widgets
// ---------------------------------------------------------------------

function setupDropzone({ zoneId, inputId, previewId }) {
  const zone = document.getElementById(zoneId);
  const input = document.getElementById(inputId);
  const preview = document.getElementById(previewId);

  const state = { fileData: null, fileMime: null, fileName: null };

  function handleFile(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result;
      const match = /^data:([^;]+);base64,(.*)$/.exec(dataUrl);
      if (!match) return;
      state.fileMime = match[1];
      state.fileData = match[2];
      state.fileName = file.name;

      preview.innerHTML = '';
      const label = document.createElement('div');
      label.textContent = `✅ ${file.name} ready`;
      preview.appendChild(label);
      if (state.fileMime.startsWith('image/')) {
        const img = document.createElement('img');
        img.src = dataUrl;
        img.alt = file.name;
        preview.appendChild(img);
      }
    };
    reader.readAsDataURL(file);
  }

  zone.addEventListener('click', () => input.click());
  input.addEventListener('change', (e) => handleFile(e.target.files[0]));

  ['dragenter', 'dragover'].forEach((evt) =>
    zone.addEventListener(evt, (e) => {
      e.preventDefault();
      zone.classList.add('dragover');
    })
  );
  ['dragleave', 'drop'].forEach((evt) =>
    zone.addEventListener(evt, (e) => {
      e.preventDefault();
      zone.classList.remove('dragover');
    })
  );
  zone.addEventListener('drop', (e) => {
    const file = e.dataTransfer.files[0];
    handleFile(file);
  });

  return state;
}

// ---------------------------------------------------------------------
// Widget state refs
// ---------------------------------------------------------------------

const el = (id) => document.getElementById(id);

const medicinePhotoState = setupDropzone({
  zoneId: 'medicine-photo-zone',
  inputId: 'medicine-photo-input',
  previewId: 'medicine-photo-preview',
});

const returnPhotoState = setupDropzone({
  zoneId: 'return-photo-zone',
  inputId: 'return-photo-input',
  previewId: 'return-photo-preview',
});

// Keeps the latest full text of each AI panel so later widgets can reference
// earlier outputs, mirroring the PartyRock widget reference wiring.
const latestOutputs = {
  extract_from_photo: '',
  medicine_card: '',
  my_medicine_summary: '',
};

// ---------------------------------------------------------------------
// Section 1 — Understand My Medicine
// ---------------------------------------------------------------------

async function runExtractFromPhoto() {
  const container = el('extract-from-photo-output');
  showLoading(container);
  const body = {
    file_data: medicinePhotoState.fileData || undefined,
    file_mime: medicinePhotoState.fileMime || undefined,
  };
  await streamToContainer(STREAM_URLS.extract_from_photo, body, container, {
    onDone: (text) => { latestOutputs.extract_from_photo = text; },
  });
}

async function runMedicineCard() {
  const container = el('medicine-card-output');
  showLoading(container);
  const body = {
    preferred_language: el('preferred-language').value,
    medicine_details: el('medicine-details').value,
    extracted_from_photo: latestOutputs.extract_from_photo,
    file_data: medicinePhotoState.fileData || undefined,
    file_mime: medicinePhotoState.fileMime || undefined,
  };
  await streamToContainer(STREAM_URLS.medicine_card, body, container, {
    onDone: (text) => { latestOutputs.medicine_card = text; },
  });
}

// ---------------------------------------------------------------------
// Section 2 — Check My Precautions
// ---------------------------------------------------------------------

async function runMyMedicineSummary() {
  const container = el('my-medicine-summary-output');
  showLoading(container);
  const body = {
    preferred_language: el('preferred-language').value,
    medicine_card: latestOutputs.medicine_card,
    patient_age: el('patient-age').value,
    other_medicines: el('other-medicines').value,
    allergies: el('medicine-allergies').value,
  };
  await streamToContainer(STREAM_URLS.my_medicine_summary, body, container, {
    onDone: (text) => { latestOutputs.my_medicine_summary = text; },
  });
}

// ---------------------------------------------------------------------
// Section 4 — Return Unused Medicines
// ---------------------------------------------------------------------

async function runMyReturnPlan() {
  const container = el('my-return-plan-output');
  showLoading(container);
  const body = {
    preferred_language: el('preferred-language').value,
    return_item_details: el('return-item-details').value,
    location: el('your-location').value,
    file_data: returnPhotoState.fileData || undefined,
    file_mime: returnPhotoState.fileMime || undefined,
  };
  await streamToContainer(STREAM_URLS.my_return_plan, body, container);
}

// ---------------------------------------------------------------------
// Section 3 — Ask About My Medicines (chat)
// ---------------------------------------------------------------------

const chatHistory = [];

function appendChatBubble(role, text) {
  const box = el('chat-box');
  const bubble = document.createElement('div');
  bubble.className = `chat-bubble ${role}`;
  bubble.textContent = text;
  box.appendChild(bubble);
  box.scrollTop = box.scrollHeight;
  return bubble;
}

async function streamChatReply(message) {
  const box = el('chat-box');
  const bubble = document.createElement('div');
  bubble.className = 'chat-bubble assistant';
  box.appendChild(bubble);
  box.scrollTop = box.scrollHeight;

  const sendBtn = el('chat-send');
  sendBtn.disabled = true;

  let buffer = '';
  let fullText = '';

  const body = {
    preferred_language: el('preferred-language').value,
    medicine_card: latestOutputs.medicine_card,
    my_medicine_summary: latestOutputs.my_medicine_summary,
    history: chatHistory,
    message,
  };

  try {
    const url = STREAM_URLS.smartmed_help;
    if (!url || url.startsWith('__URL_')) {
      throw new Error('This Lambda URL has not been configured yet. Deploy via GitHub Actions first.');
    }
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': API_KEY },
      body: JSON.stringify(body),
    });
    if (!resp.ok) throw new Error(`Request failed (${resp.status})`);

    const reader = resp.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value, { stream: true });
      fullText += chunk;
      buffer += chunk;
      bubble.textContent = fullText;
      box.scrollTop = box.scrollHeight;
    }
    bubble.textContent = fullText;

    chatHistory.push({ role: 'user', content: message });
    chatHistory.push({ role: 'assistant', content: fullText });
  } catch (err) {
    bubble.classList.add('error-text');
    bubble.textContent = `⚠️ ${err.message || 'Something went wrong. Please try again.'}`;
  } finally {
    sendBtn.disabled = false;
  }
}

function wireChat() {
  const input = el('chat-input');
  const sendBtn = el('chat-send');

  function send() {
    const message = input.value.trim();
    if (!message) return;
    appendChatBubble('user', message);
    input.value = '';
    streamChatReply(message);
  }

  sendBtn.addEventListener('click', send);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  });
}

// ---------------------------------------------------------------------
// Run All
// ---------------------------------------------------------------------

async function runAll() {
  const btn = el('run-all-btn');
  btn.disabled = true;
  try {
    await Promise.all([
      runExtractFromPhoto(),
      runMedicineCard(),
      runMyMedicineSummary(),
      runMyReturnPlan(),
    ]);
  } finally {
    btn.disabled = false;
  }
}

// ---------------------------------------------------------------------
// Wire up individual Run buttons + init
// ---------------------------------------------------------------------

document.addEventListener('DOMContentLoaded', () => {
  el('run-all-btn').addEventListener('click', runAll);
  el('run-extract-from-photo').addEventListener('click', runExtractFromPhoto);
  el('run-medicine-card').addEventListener('click', runMedicineCard);
  el('run-my-medicine-summary').addEventListener('click', runMyMedicineSummary);
  el('run-my-return-plan').addEventListener('click', runMyReturnPlan);
  wireChat();
});
