document.addEventListener('DOMContentLoaded', () => {

    /* ==========================================================================
       1. MENU MOBILE E NAVEGAÇÃO
       ========================================================================== */
    const mobileMenuBtn = document.querySelector('.mobile-menu-btn');
    const navMenu = document.querySelector('.nav-menu');
    const navLinks = document.querySelectorAll('.nav-link');
    const header = document.querySelector('.header');

    // Abre e fecha o menu mobile ao clicar no botão
    if (mobileMenuBtn && navMenu) {
        mobileMenuBtn.addEventListener('click', () => {
            navMenu.classList.toggle('open');
            mobileMenuBtn.classList.toggle('active');
            
            // Animando as barras do menu hamburger
            const bars = mobileMenuBtn.querySelectorAll('.bar');
            if (bars.length >= 3) {
                if (navMenu.classList.contains('open')) {
                    bars[0].style.transform = 'rotate(45deg) translate(6px, 6px)';
                    bars[1].style.opacity = '0';
                    bars[2].style.transform = 'rotate(-45deg) translate(6px, -6px)';
                } else {
                    bars[0].style.transform = 'none';
                    bars[1].style.opacity = '1';
                    bars[2].style.transform = 'none';
                }
            }
        });
    }

    // Fecha o menu mobile ao clicar em algum link
    if (navLinks.length > 0 && navMenu && mobileMenuBtn) {
        navLinks.forEach(link => {
            link.addEventListener('click', () => {
                navMenu.classList.remove('open');
                mobileMenuBtn.classList.remove('active');
                const bars = mobileMenuBtn.querySelectorAll('.bar');
                if (bars.length >= 3) {
                    bars[0].style.transform = 'none';
                    bars[1].style.opacity = '1';
                    bars[2].style.transform = 'none';
                }
            });
        });
    }

    // Adiciona sombra e encolhe o header ao rolar a página
    if (header) {
        window.addEventListener('scroll', () => {
            if (window.scrollY > 50) {
                header.classList.add('scrolled');
            } else {
                header.classList.remove('scrolled');
            }
        });
    }


    /* ==========================================================================
       2. EFEITO 3D TILT NOS CARDS
       ========================================================================== */
    const tiltCards = document.querySelectorAll('[data-tilt]');

    tiltCards.forEach(card => {
        card.addEventListener('mousemove', (e) => {
            const cardRect = card.getBoundingClientRect();
            const cardWidth = cardRect.width;
            const cardHeight = cardRect.height;
            
            // Posição do mouse relativa ao card (-0.5 a 0.5)
            const mouseX = (e.clientX - cardRect.left) / cardWidth - 0.5;
            const mouseY = (e.clientY - cardRect.top) / cardHeight - 0.5;
            
            // Intensidade máxima da rotação (em graus)
            const maxTilt = 8;
            
            // Calcula os ângulos de rotação
            const rotateX = -mouseY * maxTilt;
            const rotateY = mouseX * maxTilt;
            
            // Aplica as transformações com transição leve
            card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(1.02, 1.02, 1.02)`;
        });

        card.addEventListener('mouseleave', () => {
            card.style.transform = 'perspective(1000px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)';
            card.style.transition = 'transform 0.5s ease';
        });

        card.addEventListener('mouseenter', () => {
            card.style.transition = 'none';
        });
    });


    /* ==========================================================================
       3. PLAYER DE DEPOIMENTOS REGIONAIS POR ABAS
       ========================================================================== */
    const tabs = document.querySelectorAll('.player-tab');
    const tabContents = document.querySelectorAll('.testimonial-content-wrapper');

    // Gerenciador de Abas dos Depoimentos
    if (tabs.length > 0 && tabContents.length > 0) {
        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                const selectedTab = tab.getAttribute('data-tab');
                
                // Atualiza abas ativas
                tabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                
                // Atualiza conteúdos exibidos
                tabContents.forEach(content => {
                    if (content.id === `tab-content-${selectedTab}`) {
                        content.classList.remove('hidden');
                    } else {
                        content.classList.add('hidden');
                    }
                });
            });
        });
    }


    /* ==========================================================================
       4. INTERATIVIDADE NOS CARDS DE VANTAGENS
       ========================================================================== */
    
    // Card 2: Calculadora de Custos Logísticos
    const calcRange = document.getElementById('calc-range');
    const calcQty = document.getElementById('calc-qty');
    const calcSavings = document.getElementById('calc-savings');

    if (calcRange) {
        calcRange.addEventListener('input', (e) => {
            const qty = parseInt(e.target.value);
            calcQty.textContent = qty;
            
            // Fórmula da economia estimada: Qty * 80 + 50 (Rondon / Paraná Médias)
            const savings = qty * 80 + 50;
            calcSavings.textContent = `R$ ${savings.toLocaleString('pt-BR')},00`;
        });
    }

    // Card 3: Toggle Noite e Relógio Noturno
    const nightCard = document.getElementById('night-card');
    const moonToggle = document.getElementById('moon-mode-toggle');
    const toggleThumb = document.getElementById('toggle-thumb');
    const toggleText = document.getElementById('toggle-text');
    const clockDisplay = document.getElementById('clock-display');

    if (moonToggle) {
        moonToggle.addEventListener('click', () => {
            nightCard.classList.toggle('dark-activated');
            toggleThumb.classList.toggle('active');
            
            if (toggleThumb.classList.contains('active')) {
                toggleThumb.textContent = '🌙';
                toggleText.textContent = 'Ativo (Noite)';
                animateClock('23:30');
            } else {
                toggleThumb.textContent = '☀️';
                toggleText.textContent = 'Ativar Noite';
                animateClock('18:00');
            }
        });
    }

    function animateClock(targetTime) {
        let currentHour = parseInt(clockDisplay.textContent.split(':')[0]);
        const targetHour = parseInt(targetTime.split(':')[0]);
        
        let interval = setInterval(() => {
            if (currentHour === targetHour) {
                clearInterval(interval);
                clockDisplay.textContent = targetTime;
            } else {
                currentHour = currentHour < targetHour ? currentHour + 1 : currentHour - 1;
                const minText = targetTime.split(':')[1];
                clockDisplay.textContent = `${currentHour.toString().padStart(2, '0')}:${minText}`;
            }
        }, 80);
    }


    /* ==========================================================================
       5. INTERATIVIDADE DO MAPA REGIONAL (GPS MAPS)
       ========================================================================== */
    const gpsNodes = document.querySelectorAll('.gps-node');
    const gpsMarker = document.getElementById('gps-motoboy-marker');
    const gpsClock = document.getElementById('gps-clock');

    // Atualiza relógio do GPS com o horário do sistema
    function updateGpsTime() {
        const now = new Date();
        const hrs = now.getHours().toString().padStart(2, '0');
        const mins = now.getMinutes().toString().padStart(2, '0');
        if (gpsClock) gpsClock.textContent = `${hrs}:${mins}`;
    }
    updateGpsTime();
    setInterval(updateGpsTime, 60000);

    // Mover o motoboy do GPS para a cidade ao passar o mouse
    gpsNodes.forEach(node => {
        node.addEventListener('mouseenter', () => {
            const x = node.getAttribute('data-x');
            const y = node.getAttribute('data-y');
            
            if (gpsMarker && x && y) {
                // Posiciona o motoboy nas coordenadas da cidade
                gpsMarker.setAttribute('transform', `translate(${x}, ${y})`);
                gpsMarker.style.opacity = '1';
            }
        });
        
        node.addEventListener('mouseleave', () => {
            // Retorna o motoboy para Rondon (Sede Central)
            if (gpsMarker) {
                gpsMarker.setAttribute('transform', 'translate(300, 200)');
            }
        });
    });


    /* ==========================================================================
       6. ANIMAÇÕES DE REVELAÇÃO AO ROLAR (SCROLL REVEAL)
       ========================================================================== */
    const revealElements = document.querySelectorAll('.reveal');

    const revealOnScroll = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('active');
                observer.unobserve(entry.target);
            }
        });
    }, {
        threshold: 0.15,
        rootMargin: '0px 0px -50px 0px'
    });

    revealElements.forEach(element => {
        revealOnScroll.observe(element);
    });

    setTimeout(() => {
        const heroSection = document.querySelector('.hero-content');
        const heroImg = document.querySelector('.hero-image-container');
        if (heroSection) heroSection.classList.add('active');
        if (heroImg) heroImg.classList.add('active');
    }, 150);


    /* ==========================================================================
       7. CONTROLE DO MOTOBOY DO SCROLL COM PARTÍCULAS DE POEIRA
       ========================================================================== */
    const motoboy = document.getElementById('scrolling-motoboy');
    const footer = document.querySelector('.footer');
    let lastScrollTop = 0;

    if (motoboy) {
        window.addEventListener('scroll', () => {
            const scrollTop = window.scrollY;
            const scrollHeight = document.documentElement.scrollHeight - window.innerHeight;
            
            if (scrollHeight <= 0) return;
            
            const scrollPercent = scrollTop / scrollHeight;
            const minTop = 115;
            const maxTop = window.innerHeight - 80;
            
            const currentTop = minTop + scrollPercent * (maxTop - minTop);
            motoboy.style.top = `${currentTop}px`;
            
            const footerRect = footer ? footer.getBoundingClientRect() : null;
            const isNearFooter = footerRect ? footerRect.top < (window.innerHeight - 40) : false;
            
            if (scrollTop > 220 && !isNearFooter) {
                motoboy.style.opacity = '1';
                
                // Cria poeira apenas quando há movimento ativo de scroll
                if (Math.abs(scrollTop - lastScrollTop) > 6) {
                    createDustParticle();
                }
            } else {
                motoboy.style.opacity = '0';
            }
            
            lastScrollTop = scrollTop;
        });
    }

    function createDustParticle() {
        if (!motoboy) return;
        
        // Obtém o bounding box do motoboy flutuante
        const rect = motoboy.getBoundingClientRect();
        
        // Cria a partícula
        const particle = document.createElement('div');
        particle.className = 'dust-particle';
        
        // Posiciona a poeira na roda traseira (lado esquerdo/traseiro do motoboy)
        const leftOffset = rect.left + 8; // Roda traseira
        const topOffset = rect.top + 34;  // Posição vertical da roda
        
        particle.style.left = `${leftOffset}px`;
        particle.style.top = `${topOffset}px`;
        
        // Adiciona espalhamento aleatório sutil no início da animação
        const randomY = (Math.random() * 8 - 4);
        particle.style.marginTop = `${randomY}px`;
        
        document.body.appendChild(particle);
        
        // Remove a partícula do DOM após o fim da animação do CSS (700ms)
        setTimeout(() => {
            particle.remove();
        }, 700);
    }

});
