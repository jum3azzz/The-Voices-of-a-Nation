(function () {

  const SUPABASE_URL = 'https://dzdtwcsmznviitayttxe.supabase.co';
  const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR6ZHR3Y3Ntem52aWl0YXl0dHhlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI1MzM4ODgsImV4cCI6MjEwODEwOTg4OH0.9J40sNaQ4iHSb0bGMSltb_V1U39upTZBbKECVRYgShY';

  const client = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  const form = document.getElementById('suggest-form');
  if (!form) return;

  const nameInput = document.getElementById('suggest-name');
  const messageInput = document.getElementById('suggest-message');
  const honeypot = document.getElementById('suggest-website');
  const status = document.getElementById('suggest-status');
  const button = form.querySelector('button');

  form.addEventListener('submit', async e => {
    e.preventDefault();

    // Hidden field: real visitors leave it empty, many bots fill it in
    if (honeypot.value) return;

    const message = messageInput.value.trim();
    const name = nameInput.value.trim();

    if (!message) {
      status.textContent = 'Please write the artist name and a short note.';
      return;
    }

    button.disabled = true;
    status.textContent = 'Sending...';

    const { error } = await client
      .from('suggestions')
      .insert({ name: name || null, message });

    button.disabled = false;

    if (error) {
      status.textContent = 'Could not send. Please try again.';
      console.error('Suggestion failed:', error.message);
      return;
    }

    form.reset();
    status.textContent = 'Thank you. Your suggestion was sent.';
  });

})();
