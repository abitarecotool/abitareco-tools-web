// js/modules/promptbuilder.js
(function(){
  'use strict';
  const TEMPLATE_URL = './assets/prompts/prompt-scheda-immobiliare.txt';
  const PLACEHOLDER = '{{DESCRIZIONE_UTENTE}}';
  function status(message, type){
    const el = document.getElementById('PromptBuilderStatus');
    if (!el) return;
    el.textContent = message || '';
    el.classList.toggle('is-error', type === 'error');
    el.classList.toggle('is-success', type === 'success');
  }
  function fileName(){
    const d = new Date();
    const pad = n => String(n).padStart(2,'0');
    return `prompt-scheda-immobiliare-${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}.txt`;
  }
  async function loadTemplate(){
    const response = await fetch(TEMPLATE_URL, { cache:'no-store' });
    if (!response.ok) throw new Error('Impossibile caricare il modello del prompt.');
    return response.text();
  }
  window.generatePromptBuilder = async function(){
    const input = document.getElementById('PromptBuilderInput');
    const description = String(input?.value || '').trim();
    if (!description){
      status('Inserisci una descrizione prima di generare il prompt.', 'error');
      input?.focus();
      throw new Error('Inserisci una descrizione prima di generare il prompt.');
    }
    status('Preparazione del file in corso…');
    const template = await loadTemplate();
    if (!template.includes(PLACEHOLDER)) throw new Error('Segnaposto non trovato nel modello del prompt.');
    const output = template.replace(PLACEHOLDER, description).replace(/\r\n/g,'\n');
    const blob = new Blob(['\ufeff', output], { type:'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = fileName();
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    status('Prompt generato e scaricato correttamente.', 'success');
  };
  document.addEventListener('input', e => {
    if (e.target?.id === 'PromptBuilderInput') status('');
  });
})();
