document.addEventListener('DOMContentLoaded', () => {
    const slidesContainer = document.querySelector('.carousel-slides');
    const dotsContainer = document.querySelector('.carousel-dots');
    const prevBtn = document.querySelector('.carousel-control.prev');
    const nextBtn = document.querySelector('.carousel-control.next');

    if (!slidesContainer) return;

    const images = [
        'https://images.unsplash.com/photo-1517649763962-0c623066013b?q=80&w=2070&auto=format&fit=crop', // Running
        'https://images.unsplash.com/photo-1541534741688-6078c6bfb5c5?q=80&w=2069&auto=format&fit=crop', // Gym / Crossfit
        'https://images.unsplash.com/photo-1552674605-db6ffd5e259b?q=80&w=2070&auto=format&fit=crop', // Basketball
        'https://images.unsplash.com/photo-1471295253337-3ceaa6ca4022?q=80&w=2070&auto=format&fit=crop', // Swimming
        'https://images.unsplash.com/photo-1565992441121-4367c2967103?q=80&w=1974&auto=format&fit=crop'  // Soccer
    ];

    let currentSlide = 0;
    let slideInterval;

    function createSlides() {
        slidesContainer.innerHTML = '';
        dotsContainer.innerHTML = '';
        images.forEach((src, index) => {
            // Crear slide
            const slide = document.createElement('div');
            slide.className = 'carousel-slide';
            slide.style.backgroundImage = `url('${src}')`;
            slidesContainer.appendChild(slide);

            // Crear dot
            const dot = document.createElement('button');
            dot.className = 'carousel-dot';
            dot.dataset.slide = index;
            dotsContainer.appendChild(dot);
        });
    }

    function showSlide(index) {
        const slides = document.querySelectorAll('.carousel-slide');
        const dots = document.querySelectorAll('.carousel-dot');

        slides.forEach(slide => slide.classList.remove('active'));
        dots.forEach(dot => dot.classList.remove('active'));

        slides[index].classList.add('active');
        dots[index].classList.add('active');

        currentSlide = index;
    }

    function nextSlide() {
        const nextIndex = (currentSlide + 1) % images.length;
        showSlide(nextIndex);
    }

    function prevSlide() {
        const prevIndex = (currentSlide - 1 + images.length) % images.length;
        showSlide(prevIndex);
    }

    function startCarousel() {
        stopCarousel(); // Asegurarse de que no haya intervalos duplicados
        slideInterval = setInterval(nextSlide, 5000); // Cambia de imagen cada 5 segundos
    }

    function stopCarousel() {
        clearInterval(slideInterval);
    }

    // --- Inicialización ---
    createSlides();
    showSlide(0);
    startCarousel();

    // --- Event Listeners ---
    nextBtn.addEventListener('click', () => {
        nextSlide();
        startCarousel(); // Reinicia el temporizador al cambiar manualmente
    });

    prevBtn.addEventListener('click', () => {
        prevSlide();
        startCarousel();
    });

    dotsContainer.addEventListener('click', (e) => {
        if (e.target.matches('.carousel-dot')) {
            const slideIndex = parseInt(e.target.dataset.slide, 10);
            showSlide(slideIndex);
            startCarousel();
        }
    });
});