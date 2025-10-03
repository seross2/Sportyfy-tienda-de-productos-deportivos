document.addEventListener('DOMContentLoaded', () => {
    const contactForm = document.getElementById('contact-form');
    const messageDiv = document.getElementById('message');

    if (contactForm) {
        contactForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const submitButton = contactForm.querySelector('button[type="submit"]');
            submitButton.disabled = true;
            submitButton.textContent = 'Enviando...';

            const formData = new FormData(contactForm);
            const data = {
                name: formData.get('name'),
                email: formData.get('email'),
                message: formData.get('message'),
            };

            try {
                const response = await fetch('/api/send-email', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data),
                });

                const result = await response.json();
                if (!response.ok) throw new Error(result.error || 'Error al enviar el mensaje.');

                messageDiv.textContent = result.success;
                messageDiv.style.backgroundColor = '#28a745'; // Verde
                contactForm.reset();
            } catch (error) {
                messageDiv.textContent = `Error: ${error.message}`;
                messageDiv.style.backgroundColor = '#dc3545'; // Rojo
            } finally {
                messageDiv.style.display = 'block';
                submitButton.disabled = false;
                submitButton.textContent = 'Enviar Mensaje';
                setTimeout(() => { messageDiv.style.display = 'none'; }, 5000);
            }
        });
    }
});